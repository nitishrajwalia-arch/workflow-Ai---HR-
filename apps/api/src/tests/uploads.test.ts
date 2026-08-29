/**
 * Photos have to come back.
 *
 * `POST /people/:id/photo` returned a URL under `/uploads/` that nothing served,
 * so every photo uploaded — in development and in production alike — rendered as
 * a broken image. That is the kind of defect a green test suite happily reports
 * nothing about, because both halves worked and only the join was missing.
 */

import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { auth, makeApp, signIn } from './helpers.js';

let app: App;
let db: PrismaClient;
let token: string;

// The smallest valid PNG: 1×1, transparent. Real magic bytes, so the uploader's
// sniff test passes on content rather than on a filename.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const SUBJECT = 'MB-STR-0014';

beforeAll(async () => {
  ({ app, db } = await makeApp());
  ({ token } = await signIn(app));
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

/** Multipart by hand — the upload route does not go through the JSON parser. */
function multipart(buf: Buffer, filename: string, contentType: string) {
  const b = `----marbella${createHash('sha256').update(filename).digest('hex').slice(0, 16)}`;
  const head = Buffer.from(
    `--${b}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${b}--\r\n`);
  return {
    payload: Buffer.concat([head, buf, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${b}` },
  };
}

describe('a photo that has been uploaded', () => {
  it('is served back at the URL the upload returned', async () => {
    const { payload, headers } = multipart(PNG, 'staff.png', 'image/png');
    const up = await app.inject({
      method: 'POST',
      url: `/api/v1/people/${SUBJECT}/photo`,
      headers: { ...auth(token), ...headers },
      payload,
    });
    expect(up.statusCode).toBe(200);

    const url = up.json<{ photo: string }>().photo;
    expect(url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);

    // Not under /api/v1 — this is the URL stored against the person and the one
    // nginx proxies.
    const got = await app.inject({ method: 'GET', url });
    expect(got.statusCode).toBe(200);
    expect(got.headers['content-type']).toBe('image/png');
    expect(got.headers['x-content-type-options']).toBe('nosniff');
    expect(got.rawPayload.equals(PNG)).toBe(true);
  });

  it('refuses a filename that is not one this server generated', async () => {
    for (const name of [
      '../../../etc/passwd',
      '..%2f..%2fetc%2fpasswd',
      'not-a-uuid.png',
      '00000000-0000-0000-0000-000000000000.svg',
      '00000000-0000-0000-0000-000000000000.png', // well-formed, simply absent
    ]) {
      const res = await app.inject({ method: 'GET', url: `/uploads/${name}` });
      expect(res.statusCode, name).toBe(404);
    }
  });

  it('refuses a file that is not really an image, whatever it is called', async () => {
    const { payload, headers } = multipart(
      Buffer.from('<script>alert(1)</script>'),
      'staff.png',
      'image/png',
    );
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/people/${SUBJECT}/photo`,
      headers: { ...auth(token), ...headers },
      payload,
    });
    expect(res.statusCode).toBe(400);
  });
});
