/**
 * Buying and the store: vendors, purchase orders, requests, requisitions,
 * inventory, holds, stock moves and storage caps.
 *
 * The rules that live here rather than in the browser, because a modified
 * browser must not be able to skip them:
 *
 *  · A vendor is not "verified" because a form said so. Verification sets the
 *    status AND issues the vendor code; both happen server-side, together.
 *  · Held stock is not available stock. The server computes availability, so a
 *    screen cannot issue material someone else is holding.
 *  · A storage cap is a refusal, not a warning. Going over it needs an
 *    override, and the override is checked here.
 *  · Stock moves are append-only in practice: a correction is a new row with a
 *    reason, never an edit of the old one.
 */

import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { gstinCheck, panCheck, phoneCheck, emailCheck } from '@marbella/shared';
import { conflict, notFound, unprocessable } from '../lib/errors.js';
import { qty, toPaise, toRupees } from '../lib/money.js';
import { requireUser } from '../plugins/auth.js';
import { append, appendInTx } from '../services/ledger.js';

const money = z.number().min(0).max(1e12);

export const procurementRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  /* --------------------------------------------------------------- vendors */

  app.get(
    '/vendors',
    {
      preHandler: app.authenticate,
      schema: { tags: ['procurement'], summary: 'Vendors', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.vendor.findMany({ orderBy: { name: 'asc' } });
      return rows.map((v) => ({
        code: v.code,
        name: v.name,
        cat: v.cat,
        terms: v.terms,
        phone: v.phone,
        whatsapp: v.whatsapp,
        email: v.email,
        contact: v.contact,
        gst: v.gst,
        pan: v.pan,
        status: v.status,
        vcode: v.vcode,
        city: v.city,
        credit: v.credit,
      }));
    },
  );

  app.post(
    '/vendors',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['procurement'],
        summary: 'Add a vendor',
        body: z.object({
          code: z.string().trim().min(3).max(40).optional(),
          name: z.string().trim().min(2).max(200),
          cat: z.string().trim().max(60).default(''),
          terms: z.string().trim().max(60).default(''),
          phone: z.string().trim().max(30).default(''),
          whatsapp: z.string().trim().max(30).default(''),
          email: z.string().trim().max(255).default(''),
          contact: z.string().trim().max(120).default(''),
          gst: z.string().trim().toUpperCase().max(15).default(''),
          pan: z.string().trim().toUpperCase().max(10).default(''),
          city: z.string().trim().max(80).default(''),
          credit: z.string().trim().max(40).default(''),
        }),
        response: { 201: z.any(), 422: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;

      const problems: Array<{ path: string; message: string }> = [];
      if (b.gst) {
        const g = gstinCheck(b.gst);
        // Shape blocks; a disagreeing check character never does. See validation.ts.
        if (g.level === 'error') problems.push({ path: 'gst', message: g.msg ?? '' });
      }
      if (b.pan) {
        const p = panCheck(b.pan);
        if (p.level === 'error') problems.push({ path: 'pan', message: p.msg ?? '' });
      }
      if (b.phone) {
        const p = phoneCheck(b.phone);
        if (p.level === 'error') problems.push({ path: 'phone', message: p.msg ?? '' });
      }
      if (b.email) {
        const e = emailCheck(b.email);
        if (e.level === 'error') problems.push({ path: 'email', message: e.msg ?? '' });
      }
      if (problems.length) throw unprocessable('That vendor cannot be saved yet.', problems);

      // The trade code is derived from the category so it reads like the others
      // (MB-STL-0007), and allocated server-side so two people cannot collide.
      const code =
        b.code ??
        (await (async () => {
          const prefix = `MB-${(b.cat || 'GEN').slice(0, 3).toUpperCase()}-`;
          const last = await db.vendor.findFirst({
            where: { code: { startsWith: prefix } },
            orderBy: { code: 'desc' },
            select: { code: true },
          });
          const n = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
          return `${prefix}${String(n).padStart(4, '0')}`;
        })());

      const created = await db.$transaction(async (tx) => {
        const v = await tx.vendor.create({
          data: { ...b, code, status: 'unverified', vcode: '' },
        });
        await appendInTx(tx, {
          kind: 'company',
          subject: v.code,
          detail: `${v.name} added as a vendor, unverified.`,
          who: me.name,
        });
        return v;
      });

      return reply.status(201).send(created);
    },
  );

  app.post(
    '/vendors/:code/verify',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['procurement'],
        summary: 'Verify a vendor and issue its code',
        description:
          'Verification is what lets money move to a party. The vendor code is issued here, ' +
          'by the server, at the same moment the status changes — never by the browser.',
        params: z.object({ code: z.string() }),
        body: z.object({
          gst: z.string().trim().toUpperCase().max(15).default(''),
          pan: z.string().trim().toUpperCase().max(10).default(''),
          contact: z.string().trim().max(120).default(''),
          phone: z.string().trim().max(30).default(''),
          email: z.string().trim().max(255).default(''),
        }),
        response: { 200: z.any(), 404: z.any(), 422: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const vendor = await db.vendor.findUnique({ where: { code: req.params.code } });
      if (!vendor) throw notFound(`Vendor ${req.params.code}`);
      if (vendor.status === 'verified') {
        throw conflict(`${vendor.name} is already verified as ${vendor.vcode}.`);
      }

      const b = req.body;
      // A verified vendor is one you are prepared to pay. Both numbers must at
      // least be the right shape before that word is used.
      const problems: Array<{ path: string; message: string }> = [];
      if (!b.gst) problems.push({ path: 'gst', message: 'A GSTIN is needed to verify a vendor.' });
      else {
        const g = gstinCheck(b.gst);
        if (g.level === 'error') problems.push({ path: 'gst', message: g.msg ?? '' });
      }
      if (!b.pan) problems.push({ path: 'pan', message: 'A PAN is needed to verify a vendor.' });
      else {
        const p = panCheck(b.pan);
        if (p.level === 'error') problems.push({ path: 'pan', message: p.msg ?? '' });
      }
      if (problems.length) throw unprocessable('This vendor cannot be verified yet.', problems);

      return db.$transaction(async (tx) => {
        const count = await tx.vendor.count({ where: { status: 'verified' } });
        const vcode = `MB-V-${String(count + 1).padStart(4, '0')}`;
        const row = await tx.vendor.update({
          where: { code: vendor.code },
          data: { ...b, status: 'verified', vcode },
        });
        await appendInTx(tx, {
          kind: 'company',
          subject: vendor.code,
          detail: `${vendor.name} verified as ${vcode}. GSTIN ${b.gst}.`,
          who: me.name,
        });
        return row;
      });
    },
  );

  app.post(
    '/vendors/import',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['procurement'],
        summary: 'Import vendors from a pasted sheet',
        description: 'Send commit:false to validate only. Bad rows are held back with a reason.',
        body: z.object({
          rows: z
            .array(
              z.object({
                name: z.string().trim().max(200),
                cat: z.string().trim().max(60).optional(),
                gst: z.string().trim().max(20).optional(),
                pan: z.string().trim().max(20).optional(),
                contact: z.string().trim().max(120).optional(),
                phone: z.string().trim().max(30).optional(),
                email: z.string().trim().max(255).optional(),
                credit: z.string().trim().max(40).optional(),
                city: z.string().trim().max(80).optional(),
              }),
            )
            .min(1)
            .max(2000),
          commit: z.boolean().default(false),
        }),
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const { rows, commit } = req.body;
      const accepted: Array<{ row: number; code: string; name: string }> = [];
      const rejected: Array<{ row: number; name: string; field: string; reason: string }> = [];

      const existing = new Set(
        (await db.vendor.findMany({ select: { name: true } })).map((v) => v.name.toLowerCase()),
      );
      const counters = new Map<string, number>();
      for (const v of await db.vendor.findMany({ select: { code: true } })) {
        const m = v.code.match(/^MB-([A-Z]{3})-(\d{4})$/);
        if (m && Number(m[2]) > (counters.get(m[1]!) ?? 0)) counters.set(m[1]!, Number(m[2]));
      }

      rows.forEach((r, i) => {
        const rowNo = i + 1;
        const name = r.name?.trim() ?? '';
        if (!name || name.length < 2) {
          rejected.push({
            row: rowNo,
            name: name || '(no name)',
            field: 'name',
            reason: 'No party name.',
          });
          return;
        }
        if (existing.has(name.toLowerCase())) {
          rejected.push({ row: rowNo, name, field: 'name', reason: 'Already on the vendor list.' });
          return;
        }
        if (r.gst) {
          const g = gstinCheck(r.gst);
          if (g.level === 'error') {
            rejected.push({ row: rowNo, name, field: 'gst', reason: g.msg ?? 'Bad GSTIN.' });
            return;
          }
        }
        if (r.phone) {
          const p = phoneCheck(r.phone);
          if (p.level === 'error') {
            rejected.push({ row: rowNo, name, field: 'phone', reason: p.msg ?? 'Bad mobile.' });
            return;
          }
        }
        existing.add(name.toLowerCase());
        const cat3 = (r.cat || 'GEN').slice(0, 3).toUpperCase();
        const next = (counters.get(cat3) ?? 0) + 1;
        counters.set(cat3, next);
        accepted.push({ row: rowNo, code: `MB-${cat3}-${String(next).padStart(4, '0')}`, name });
      });

      if (!commit) return { accepted, rejected, committed: false };

      // One transaction: a half-imported vendor list is worse than a refused one.
      await db.$transaction(
        accepted.map((a) => {
          const r = rows[a.row - 1]!;
          return db.vendor.create({
            data: {
              code: a.code,
              name: a.name,
              cat: r.cat ?? '',
              gst: (r.gst ?? '').toUpperCase(),
              pan: (r.pan ?? '').toUpperCase(),
              contact: r.contact ?? '',
              phone: r.phone ?? '',
              email: r.email ?? '',
              credit: r.credit ?? '',
              city: r.city ?? '',
              status: 'unverified',
            },
          });
        }),
      );

      return { accepted, rejected, committed: true };
    },
  );

  /* -------------------------------------------------------- purchase orders */

  app.get(
    '/purchase-orders',
    {
      preHandler: app.authenticate,
      schema: { tags: ['procurement'], summary: 'Purchase orders', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.purchaseOrder.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((p) => ({
        id: p.id,
        vendor: p.vendorName,
        vendorCode: p.vendorCode,
        item: p.item,
        amt: toRupees(p.amt),
        status: p.status,
        del: p.del,
      }));
    },
  );

  app.post(
    '/purchase-orders',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['procurement'],
        summary: 'Raise a purchase order',
        body: z.object({
          vendor: z.string().trim().min(2).max(200),
          vendorCode: z.string().trim().max(40).optional(),
          item: z.string().trim().min(2).max(500),
          amt: money,
          firmId: z.string().trim().max(40).optional(),
          /** Line items, so the catalog can learn what things cost. */
          lines: z
            .array(
              z.object({
                name: z.string().trim().max(200),
                unit: z.string().trim().max(20).default(''),
                qty: z.number().min(0).default(0),
                rate: money.default(0),
              }),
            )
            .default([]),
        }),
        response: { 201: z.any(), 422: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;

      // Money leaves the building on this document. An unverified vendor is one
      // nobody has checked the GSTIN of, and paying one is how a fake supplier
      // gets paid. Not a refusal — the Chairman may know exactly what he is
      // doing — but it is said out loud and it goes into the record.
      const vendor = b.vendorCode
        ? await db.vendor.findUnique({ where: { code: b.vendorCode } })
        : await db.vendor.findFirst({ where: { name: b.vendor } });
      const unverified = !vendor || vendor.status !== 'verified';

      const created = await db.$transaction(async (tx) => {
        const count = await tx.purchaseOrder.count();
        const id = `PO-${4471 + count + 1}`;
        const po = await tx.purchaseOrder.create({
          data: {
            id,
            vendorCode: vendor?.code ?? null,
            vendorName: b.vendor,
            item: b.item,
            amt: toPaise(b.amt),
            status: 'Approved',
            firmId: b.firmId ?? null,
            raisedById: me.sub,
          },
        });

        // Learn the rates. Next time someone raises this item the screen can
        // say what it cost last time and who supplied it.
        for (const line of b.lines) {
          if (!line.name.trim() || !line.rate) continue;
          await tx.catalogItem.upsert({
            where: { name: line.name.trim() },
            create: {
              name: line.name.trim(),
              unit: line.unit,
              rate: toPaise(line.rate),
              vendor: b.vendor,
            },
            update: { rate: toPaise(line.rate), vendor: b.vendor, unit: line.unit },
          });
        }

        await appendInTx(tx, {
          kind: 'doc',
          subject: po.id,
          detail:
            `${po.id} raised on ${b.vendor} for ${b.item} — ₹${b.amt.toLocaleString('en-IN')}` +
            (unverified ? ' (vendor NOT verified).' : '.'),
          who: me.name,
        });
        await tx.usageCounter.upsert({
          where: { key: 'po:raise' },
          create: { key: 'po:raise', count: 1 },
          update: { count: { increment: 1 } },
        });
        return po;
      });

      return reply.status(201).send({
        id: created.id,
        vendor: created.vendorName,
        item: created.item,
        amt: toRupees(created.amt),
        status: created.status,
        warning: unverified
          ? `${b.vendor} is not a verified vendor. Nobody has checked their GSTIN. Verify them before this is paid.`
          : null,
      });
    },
  );

  /* ------------------------------------------------ requests & requisitions */

  app.get(
    '/purchase-requests',
    {
      preHandler: app.authenticate,
      schema: { tags: ['procurement'], summary: 'Purchase requests', response: { 200: z.any() } },
    },
    async () =>
      db.purchaseRequest.findMany({ where: { state: 'open' }, orderBy: { createdAt: 'desc' } }),
  );

  app.post(
    '/purchase-requests',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['procurement'],
        summary: 'Raise a purchase request',
        body: z.object({
          item: z.string().trim().min(2).max(300),
          qty: z.string().trim().max(60),
          when: z.string().trim().max(60).default(''),
          proj: z.string().trim().max(120).default(''),
        }),
        response: { 201: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const count = await db.purchaseRequest.count();
      const row = await db.purchaseRequest.create({
        data: { id: `PR-${1042 + count + 1}`, ...req.body, by: me.name },
      });
      return reply.status(201).send(row);
    },
  );

  app.post(
    '/purchase-requests/:id/close',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['procurement'],
        summary: 'Fulfil or dismiss a request',
        params: z.object({ id: z.string() }),
        body: z.object({
          state: z.enum(['fulfilled', 'dismissed']),
          /** Dismissing someone's request is a decision. Say why. */
          reason: z.string().trim().max(500).default(''),
        }),
        response: { 200: z.any(), 404: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const pr = await db.purchaseRequest.findUnique({ where: { id: req.params.id } });
      if (!pr) throw notFound(`Request ${req.params.id}`);

      // The row is never deleted. Someone asked for something and someone
      // answered; both halves stay answerable.
      return db.$transaction(async (tx) => {
        const row = await tx.purchaseRequest.update({
          where: { id: pr.id },
          data: { state: req.body.state },
        });
        await appendInTx(tx, {
          kind: 'doc',
          subject: pr.id,
          detail:
            `${pr.id} (${pr.item}) ${req.body.state}` +
            (req.body.reason ? ` — ${req.body.reason}.` : '.'),
          who: me.name,
        });
        return row;
      });
    },
  );

  app.get(
    '/requisitions',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['procurement'],
        summary: 'Requisitions on the store',
        response: { 200: z.any() },
      },
    },
    async () =>
      db.requisition.findMany({ where: { state: 'open' }, orderBy: { createdAt: 'desc' } }),
  );

  app.post(
    '/requisitions',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['procurement'],
        summary: 'Ask the store for stock',
        body: z.object({
          dept: z.string().trim().min(2).max(120),
          item: z.string().trim().min(2).max(300),
          qty: z.string().trim().max(60).default(''),
        }),
        response: { 201: z.any() },
      },
    },
    async (req, reply) => {
      const count = await db.requisition.count();
      return reply
        .status(201)
        .send(await db.requisition.create({ data: { id: `RQ-${2210 + count + 1}`, ...req.body } }));
    },
  );

  app.post(
    '/requisitions/:id/close',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['procurement'],
        summary: 'Mark a requisition issued',
        params: z.object({ id: z.string() }),
        response: { 200: z.any(), 404: z.any() },
      },
    },
    async (req) => {
      const row = await db.requisition.findUnique({ where: { id: req.params.id } });
      if (!row) throw notFound(`Requisition ${req.params.id}`);
      return db.requisition.update({ where: { id: row.id }, data: { state: 'issued' } });
    },
  );

  /* ------------------------------------------------------------- inventory */

  app.get(
    '/inventory',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['procurement'],
        summary: 'Stock, with what is held against it',
        description:
          'Availability is computed HERE. Held stock is on the shelf but is not available, ' +
          'and a screen must not be able to issue it.',
        response: { 200: z.any() },
      },
    },
    async () => {
      const [items, holds] = await Promise.all([
        db.inventoryItem.findMany({ orderBy: { item: 'asc' } }),
        db.hold.findMany(),
      ]);
      return items.map((i) => {
        const held = holds.filter((h) => h.itemName === i.item).reduce((s, h) => s + h.qty, 0);
        return {
          item: i.item,
          unit: i.unit,
          qty: qty(i.qty),
          reorder: i.reorder,
          loc: i.loc,
          proj: i.proj,
          held: qty(held),
          available: qty(Math.max(0, i.qty - held)),
        };
      });
    },
  );

  app.post(
    '/inventory',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['procurement'],
        summary: 'Add an item to the store',
        body: z.object({
          item: z.string().trim().min(2).max(200),
          unit: z.string().trim().min(1).max(20),
          qty: z.number().min(0).default(0),
          reorder: z.number().min(0).default(0),
          loc: z.string().trim().max(120).default(''),
          proj: z.string().trim().max(120).default(''),
        }),
        response: { 201: z.any(), 409: z.any() },
      },
    },
    async (req, reply) => {
      const exists = await db.inventoryItem.findUnique({ where: { item: req.body.item } });
      if (exists) throw conflict(`${req.body.item} is already on the store list.`);
      return reply.status(201).send(await db.inventoryItem.create({ data: req.body }));
    },
  );

  /**
   * Move stock in or out.
   *
   * The quantity change and the movement record are one transaction: a stock
   * level that moved with no record of why is exactly the thing this screen
   * exists to prevent.
   */
  app.post(
    '/inventory/move',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['procurement'],
        summary: 'Receive or issue stock',
        body: z.object({
          dir: z.enum(['in', 'out']),
          item: z.string().trim().min(2).max(200),
          qty: z.number().gt(0),
          unit: z.string().trim().max(20).default(''),
          ref: z.string().trim().max(60).default(''),
          bill: z.string().trim().max(60).default(''),
          note: z.string().trim().max(500).default(''),
          /** Set when a cap has been overridden, with who authorised it. */
          override: z.string().trim().max(200).optional(),
        }),
        response: { 201: z.any(), 404: z.any(), 422: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;

      const item = await db.inventoryItem.findUnique({ where: { item: b.item } });
      if (!item) throw notFound(`${b.item} is not on the store list`);

      if (b.dir === 'out') {
        const holds = await db.hold.findMany({ where: { itemName: b.item } });
        const held = qty(holds.reduce((s, h) => s + h.qty, 0));
        const available = qty(Math.max(0, item.qty - held));
        if (b.qty > available) {
          throw unprocessable(
            held > 0
              ? `Only ${available} ${item.unit} of ${b.item} are available — ${held} are held back by ${holds[0]?.by ?? 'someone'}. Ask them to release it first.`
              : `Only ${available} ${item.unit} of ${b.item} are in the store.`,
          );
        }
      } else {
        // A cap is a refusal, not a warning: the yard physically cannot hold it.
        const cap = await db.storageCap.findFirst({ where: { item: b.item, proj: item.proj } });
        if (cap && item.qty + b.qty > cap.max && !b.override) {
          throw unprocessable(
            `${b.item} at ${item.proj} is capped at ${cap.max} ${cap.unit}. ` +
              `This would take it to ${qty(item.qty + b.qty)}. ${cap.why} ` +
              'An override from the Chairman is needed.',
          );
        }
      }

      const result = await db.$transaction(async (tx) => {
        // Set, not increment: `increment` leaves the float error in the column,
        // and it compounds with every movement.
        const delta = b.dir === 'in' ? b.qty : -b.qty;
        const updated = await tx.inventoryItem.update({
          where: { item: b.item },
          data: { qty: qty(item.qty + delta) },
        });
        const move = await tx.stockMove.create({
          data: {
            dir: b.dir,
            item: b.item,
            qty: b.qty,
            unit: b.unit || item.unit,
            ref: b.ref,
            bill: b.bill,
            who: me.name,
            note: b.override ? `${b.note} [override: ${b.override}]`.trim() : b.note,
          },
        });
        if (b.override) {
          await appendInTx(tx, {
            kind: 'policy',
            subject: b.item,
            detail: `Storage cap overridden at ${item.proj} — authorised by ${b.override}.`,
            who: me.name,
          });
        }
        return { move, qty: updated.qty };
      });

      return reply.status(201).send({ ...result.move, newQty: qty(result.qty) });
    },
  );

  app.get(
    '/inventory/moves',
    {
      preHandler: app.authenticate,
      schema: { tags: ['procurement'], summary: 'Stock movements', response: { 200: z.any() } },
    },
    async () => db.stockMove.findMany({ orderBy: { createdAt: 'desc' }, take: 300 }),
  );

  /* ----------------------------------------------------------------- holds */

  app.get(
    '/holds',
    {
      preHandler: app.authenticate,
      schema: { tags: ['procurement'], summary: 'Stock held back', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.hold.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((h) => ({
        id: h.id,
        item: h.itemName,
        qty: h.qty,
        unit: h.unit,
        days: h.days,
        by: h.by,
        why: h.why,
        at: h.createdAt.getTime(),
      }));
    },
  );

  app.post(
    '/holds',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['procurement'],
        summary: 'Hold stock back',
        body: z.object({
          item: z.string().trim().min(2).max(200),
          qty: z.number().gt(0),
          unit: z.string().trim().max(20).default(''),
          days: z.number().int().min(0).max(365).default(0),
          /** Holding stock stops someone else using it. Say why. */
          why: z.string().trim().min(4).max(500),
        }),
        response: { 201: z.any(), 404: z.any(), 422: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;
      const item = await db.inventoryItem.findUnique({ where: { item: b.item } });
      if (!item) throw notFound(`${b.item} is not on the store list`);

      const held = qty(
        (await db.hold.findMany({ where: { itemName: b.item } })).reduce((s, h) => s + h.qty, 0),
      );
      if (held + b.qty > item.qty) {
        throw unprocessable(
          `There are only ${item.qty} ${item.unit} of ${b.item}, and ${held} are already held. ` +
            'You cannot hold back more than is there.',
        );
      }

      const row = await db.hold.create({
        data: {
          itemName: b.item,
          qty: b.qty,
          unit: b.unit || item.unit,
          days: b.days,
          by: me.name,
          why: b.why,
        },
      });
      return reply.status(201).send({ ...row, item: row.itemName, at: row.createdAt.getTime() });
    },
  );

  app.delete(
    '/holds/:id',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['procurement'],
        summary: 'Release a hold',
        params: z.object({ id: z.string() }),
        response: { 200: z.any(), 404: z.any() },
      },
    },
    async (req) => {
      const hold = await db.hold.findUnique({ where: { id: req.params.id } });
      if (!hold) throw notFound('That hold');
      await db.hold.delete({ where: { id: hold.id } });
      return { ok: true as const };
    },
  );

  /* ------------------------------------------------------------------ caps */

  app.get(
    '/caps',
    {
      preHandler: app.authenticate,
      schema: { tags: ['procurement'], summary: 'Storage caps', response: { 200: z.any() } },
    },
    async () => db.storageCap.findMany({ orderBy: { item: 'asc' } }),
  );

  app.put(
    '/caps',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['procurement'],
        summary: 'Set how much of an item a site may hold',
        body: z.object({
          item: z.string().trim().min(2).max(200),
          proj: z.string().trim().min(2).max(120),
          max: z.number().min(0),
          unit: z.string().trim().max(20).default(''),
          why: z.string().trim().max(500).default(''),
        }),
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const b = req.body;
      return db.$transaction(async (tx) => {
        const row = await tx.storageCap.upsert({
          where: { item_proj: { item: b.item, proj: b.proj } },
          create: b,
          update: { max: b.max, unit: b.unit, why: b.why },
        });
        await appendInTx(tx, {
          kind: 'policy',
          subject: b.item,
          detail: `Storage cap at ${b.proj} set to ${b.max} ${b.unit}.`,
          who: me.name,
        });
        return row;
      });
    },
  );

  /* -------------------------------------------------------------- catalog */

  app.get(
    '/catalog',
    {
      preHandler: app.authenticate,
      schema: { tags: ['procurement'], summary: 'What things cost', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.catalogItem.findMany({ orderBy: { name: 'asc' } });
      return rows.map((c) => ({
        name: c.name,
        unit: c.unit,
        rate: toRupees(c.rate),
        vendor: c.vendor,
      }));
    },
  );

  app.put(
    '/catalog',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['procurement'],
        summary: 'Learn what something costs',
        body: z.object({
          name: z.string().trim().min(2).max(200),
          unit: z.string().trim().max(20).default(''),
          rate: money.default(0),
          vendor: z.string().trim().max(200).default(''),
        }),
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const b = req.body;
      const row = await db.catalogItem.upsert({
        where: { name: b.name },
        create: { name: b.name, unit: b.unit, rate: toPaise(b.rate), vendor: b.vendor },
        update: { unit: b.unit, rate: toPaise(b.rate), vendor: b.vendor },
      });
      return { ...row, rate: toRupees(row.rate) };
    },
  );

  /* --------------------------------------------------------------- reports */

  app.get(
    '/site-reports',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['procurement'],
        summary: 'What people have reported',
        response: { 200: z.any() },
      },
    },
    async () => db.siteReport.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
  );

  app.post(
    '/site-reports',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['procurement'],
        summary: 'Report something from the floor',
        body: z.object({
          cat: z.string().trim().min(2).max(60),
          proj: z.string().trim().max(120).default(''),
          text: z.string().trim().max(4000).default(''),
          severity: z.enum(['low', 'med', 'high']).default('low'),
          media: z.array(z.record(z.string(), z.unknown())).default([]),
        }),
        response: { 201: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;
      const row = await db.siteReport.create({
        data: { ...b, by: me.name, media: b.media as never },
      });
      // Theft and safety are not a queue item. They are sealed into the ledger,
      // so nobody can quietly make the report go away.
      if (b.severity === 'high' || /theft|safety/i.test(b.cat)) {
        await append(db, {
          kind: 'policy',
          subject: b.proj || 'site',
          detail: `${b.cat} reported by ${me.name}: ${b.text.slice(0, 200)}`,
          who: me.name,
        });
      }
      return reply.status(201).send(row);
    },
  );
};
