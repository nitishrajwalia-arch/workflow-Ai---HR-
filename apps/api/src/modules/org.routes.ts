/**
 * Companies, projects and offices.
 *
 * Three tables, not one, because they are three different things:
 *   Company — who pays. Project — what is being built. Office — where you sit.
 * The Head Office is an office with no project; Manifest is a project with no
 * office. Collapsing them is what makes "who employs them" drift.
 */

import { gstinCheck, panCheck, reraCheck, schemas } from '@marbella/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { unprocessable } from '../lib/errors.js';
import { requireUser } from '../plugins/auth.js';
import { appendInTx } from '../services/ledger.js';

export const orgRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  /* ------------------------------------------------------------ companies */

  app.get(
    '/companies',
    {
      preHandler: app.authenticate,
      schema: { tags: ['org'], summary: 'Legal entities', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.company.findMany({ orderBy: { name: 'asc' } });
      return rows.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        gstin: c.gstin,
        pan: c.pan,
        addr: c.addr,
        // The API says what it thinks of the GSTIN, and it is a WARNING, never a
        // refusal. See validation.ts for why that is deliberate.
        gstinCheck: gstinCheck(c.gstin),
        panCheck: panCheck(c.pan),
      }));
    },
  );

  app.put(
    '/companies/:id',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['org'],
        summary: 'Create or update a legal entity',
        params: z.object({ id: schemas.slug }),
        body: schemas.companyBody.omit({ id: true }),
        response: { 200: z.any(), 422: schemas.errorBody },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { id } = req.params;
      const b = req.body;

      // Shape errors block. A disagreeing check character does not: only the GST
      // portal settles that, and a real registration must not be refused here.
      const g = gstinCheck(b.gstin);
      if (g.level === 'error' && b.gstin) {
        throw unprocessable(g.msg ?? 'That GSTIN is not a valid shape.', [
          { path: 'gstin', message: g.msg ?? '' },
        ]);
      }
      const p = panCheck(b.pan);
      if (p.level === 'error' && b.pan) {
        throw unprocessable(p.msg ?? 'That PAN is not a valid shape.', [
          { path: 'pan', message: p.msg ?? '' },
        ]);
      }

      const saved = await db.$transaction(async (tx) => {
        const existing = await tx.company.findUnique({ where: { id } });
        const row = await tx.company.upsert({
          where: { id },
          create: { id, ...b },
          update: b,
        });
        await appendInTx(tx, {
          kind: 'company',
          subject: id,
          detail: existing
            ? `${row.name} details updated.`
            : `${row.name} added as a legal entity.`,
          who: me.name,
        });
        return row;
      });

      return { ...saved, gstinCheck: gstinCheck(saved.gstin), panCheck: panCheck(saved.pan) };
    },
  );

  /* ------------------------------------------------------------- projects */

  app.get(
    '/projects',
    {
      preHandler: app.authenticate,
      schema: { tags: ['org'], summary: 'Projects', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.project.findMany({ orderBy: { name: 'asc' } });
      return rows.map((p) => ({
        id: p.id,
        name: p.name,
        short: p.short,
        company: p.companyId,
        reraStatus: p.reraStatus,
        rera: p.rera,
        stage: p.stage,
        addr: p.addr,
        reraCheck: reraCheck(p.rera, p.reraStatus),
      }));
    },
  );

  app.put(
    '/projects/:id',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['org'],
        summary: 'Create or update a project',
        params: z.object({ id: schemas.slug }),
        body: schemas.projectBody.omit({ id: true }),
        response: { 200: z.any(), 422: schemas.errorBody },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { id } = req.params;
      const b = req.body;

      // Claiming a registration you cannot produce a number for is the one RERA
      // failure worth blocking: it is the difference between a fact and a hope.
      const r = reraCheck(b.rera, b.reraStatus);
      if (r.level === 'error') {
        throw unprocessable(r.msg ?? 'RERA details are incomplete.', [
          { path: 'rera', message: r.msg ?? '' },
        ]);
      }

      const saved = await db.$transaction(async (tx) => {
        const existing = await tx.project.findUnique({ where: { id } });
        const { company, tint: _tint, ...rest } = b;
        const row = await tx.project.upsert({
          where: { id },
          create: { id, ...rest, companyId: company },
          update: { ...rest, companyId: company },
        });
        await appendInTx(tx, {
          kind: 'project',
          subject: id,
          detail: existing ? `${row.name} details updated.` : `${row.name} added as a project.`,
          who: me.name,
        });
        return row;
      });

      return {
        ...saved,
        company: saved.companyId,
        reraCheck: reraCheck(saved.rera, saved.reraStatus),
      };
    },
  );

  /* -------------------------------------------------------------- offices */

  app.get(
    '/offices',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['org'],
        summary: 'Places people are posted at',
        description:
          'Not the same list as projects: the Head Office has no project, and a project ' +
          'in the pre-launch stage has no site office yet.',
        response: { 200: z.any() },
      },
    },
    async () => {
      const rows = await db.office.findMany({ orderBy: { id: 'asc' } });
      return rows.map((o) => ({
        id: o.id,
        name: o.name,
        short: o.short,
        tint: o.tint,
        project: o.projectId,
      }));
    },
  );
};
