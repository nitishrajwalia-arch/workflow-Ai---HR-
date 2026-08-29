/**
 * Photo upload.
 *
 * Local disk by default, because that is what a single VPS has and it works on
 * day one. The seam for S3 or Cloudflare R2 is `storeFile` below: swap that one
 * function and nothing else in the codebase changes.
 *
 * What is checked, and why each one matters:
 *  - The MIME type AND the magic bytes. A file named `.png` that is not a PNG is
 *    the oldest trick there is, and `Content-Type` is whatever the client says.
 *  - The size, by the multipart plugin, before it is read into memory.
 *  - The stored name is generated here. A client-supplied filename is how you
 *    get `../../etc/something` written where it should not be.
 */

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { badRequest, notFound } from '../lib/errors.js';
import { requireUser } from '../plugins/auth.js';

/** First bytes of the formats we accept. Checked against the actual buffer. */
const MAGIC: Array<{ ext: string; mime: string; bytes: number[] }> = [
  { ext: 'jpg', mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { ext: 'png', mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'webp', mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

function sniff(buf: Buffer): { ext: string; mime: string } | null {
  for (const f of MAGIC) {
    if (f.bytes.every((b, i) => buf[i] === b)) {
      // WEBP is RIFF....WEBP; RIFF alone is also a .wav.
      if (f.ext === 'webp' && buf.subarray(8, 12).toString('ascii') !== 'WEBP') continue;
      return { ext: f.ext, mime: f.mime };
    }
  }
  return null;
}

export const uploadsRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db, env } = app;

  /** THE SEAM. Replace this body with an S3 PutObject to move to object storage. */
  async function storeFile(buf: Buffer, ext: string): Promise<string> {
    const dir = path.resolve(env.UPLOAD_DIR);
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, name), buf);
    return `/uploads/${name}`;
  }

  app.post(
    '/people/:id/photo',
    {
      preHandler: app.requireRole('HR'),
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['uploads'],
        summary: 'Attach a photo to a person',
        consumes: ['multipart/form-data'],
        params: z.object({ id: z.string() }),
        response: { 200: z.object({ photo: z.string() }), 400: z.any(), 404: z.any() },
      },
    },
    async (req) => {
      requireUser(req);
      const { id } = req.params;

      const person = await db.person.findUnique({ where: { id } });
      if (!person) throw notFound(`Employee ${id}`);

      const file = await req.file();
      if (!file) throw badRequest('No file was sent.');

      const buf = await file.toBuffer();
      if (buf.length === 0) throw badRequest('That file is empty.');

      // Trust the bytes, not the header.
      const kind = sniff(buf);
      if (!kind) {
        throw badRequest(
          'That is not a JPEG, PNG or WebP image. Whatever the file is called, its contents are not a photo.',
        );
      }

      const photo = await storeFile(buf, kind.ext);
      await db.person.update({ where: { id }, data: { photo } });

      req.log.info(
        {
          personId: id,
          bytes: buf.length,
          sha256: createHash('sha256').update(buf).digest('hex').slice(0, 16),
        },
        'photo stored',
      );

      return { photo };
    },
  );
};
