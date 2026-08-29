/**
 * Money: vendor invoices, expenses, sales, payment reminders, banks, cards and
 * the master company list.
 *
 * Everything here is behind HR-or-above at minimum, and the parts that move
 * money or speak to a customer are behind more than that.
 *
 * The rule that matters most in this file: **a payment reminder does not go out
 * because somebody drafted it.** It is a letter to a customer, about money,
 * carrying the firm's name. Drafting and approving are two acts by two people,
 * and the API keeps them apart.
 */

import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { gstinCheck, panCheck } from '@marbella/shared';
import { conflict, forbidden, notFound, unprocessable } from '../lib/errors.js';
import { toPaise, toRupees } from '../lib/money.js';
import { requireUser } from '../plugins/auth.js';
import { appendInTx } from '../services/ledger.js';

const money = z.number().min(0).max(1e12);

export const moneyRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  /* ------------------------------------------------------ vendor invoices */

  app.get(
    '/invoices',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: { tags: ['money'], summary: 'Vendor invoices', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.vendorInvoice.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((v) => ({ ...v, amt: toRupees(v.amt) }));
    },
  );

  app.post(
    '/invoices/:id/clear',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['money'],
        summary: 'Pass an invoice to accounts',
        params: z.object({ id: z.string() }),
        body: z.object({ note: z.string().trim().max(1000).default('') }),
        response: { 200: z.any(), 404: z.any(), 409: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const inv = await db.vendorInvoice.findUnique({ where: { id: req.params.id } });
      if (!inv) throw notFound(`Invoice ${req.params.id}`);
      if (inv.state === 'cleared') throw conflict(`${inv.id} was already cleared.`);

      return db.$transaction(async (tx) => {
        const row = await tx.vendorInvoice.update({
          where: { id: inv.id },
          data: { state: 'cleared' },
        });
        // Clearing an invoice is the step that lets money leave. It is named.
        await appendInTx(tx, {
          kind: 'doc',
          subject: inv.id,
          detail:
            `${inv.id} from ${inv.vendor} (₹${toRupees(inv.amt).toLocaleString('en-IN')}) cleared to accounts` +
            (req.body.note ? ` — ${req.body.note}.` : '.'),
          who: me.name,
        });
        return { ...row, amt: toRupees(row.amt) };
      });
    },
  );

  /* -------------------------------------------------------------- expenses */

  app.get(
    '/expenses',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: { tags: ['money'], summary: 'Expenses', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.expense.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
      return rows.map((e) => ({ ...e, amt: toRupees(e.amt) }));
    },
  );

  app.post(
    '/expenses',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['money'],
        summary: 'File an expense',
        body: z.object({
          cat: z.string().trim().min(2).max(60),
          dept: z.string().trim().min(2).max(60),
          amt: money,
          party: z.string().trim().max(200).default(''),
          date: z.string().trim().max(40).default(''),
          src: z.string().trim().max(120).default(''),
          how: z.string().trim().max(20).default(''),
          note: z.string().trim().max(1000).default(''),
        }),
        response: { 201: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;
      const count = await db.expense.count();
      const row = await db.$transaction(async (tx) => {
        const e = await tx.expense.create({
          data: { id: `EX-${9051 + count + 1}`, ...b, amt: toPaise(b.amt) },
        });
        await appendInTx(tx, {
          kind: 'doc',
          subject: e.id,
          detail: `${b.cat} expense of ₹${b.amt.toLocaleString('en-IN')} filed for ${b.dept}${b.party ? ` — ${b.party}` : ''}.`,
          who: me.name,
        });
        return e;
      });
      return reply.status(201).send({ ...row, amt: toRupees(row.amt) });
    },
  );

  /* ----------------------------------------------------------------- sales */

  app.get(
    '/sales',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: { tags: ['money'], summary: 'Units sold and what is still due', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.sale.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((s) => ({ ...s, price: toRupees(s.price) }));
    },
  );

  app.post(
    '/sales',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['money'],
        summary: 'Record a booking',
        body: z.object({
          unit: z.string().trim().min(1).max(60),
          tower: z.string().trim().max(120).default(''),
          proj: z.string().trim().max(120).default(''),
          firm: z.string().trim().max(200).default(''),
          plan: z.string().trim().max(200).default(''),
          price: money,
          booked: z.string().trim().max(40).default(''),
          buyer: z.string().trim().min(2).max(200),
          phone: z.string().trim().max(30).default(''),
          email: z.string().trim().max(255).default(''),
        }),
        response: { 201: z.any(), 409: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;
      // One unit is sold once. A duplicate booking on the same unit is the
      // mistake that ends up in court.
      const clash = await db.sale.findFirst({ where: { unit: b.unit, proj: b.proj } });
      if (clash) {
        throw conflict(
          `${b.unit} at ${b.proj} is already booked to ${clash.buyer}. Two bookings on one unit is not a thing that can be fixed later.`,
        );
      }
      const count = await db.sale.count();
      const row = await db.$transaction(async (tx) => {
        const s = await tx.sale.create({
          data: { id: `SL-${2041 + count + 1}`, ...b, price: toPaise(b.price) },
        });
        await appendInTx(tx, {
          kind: 'doc',
          subject: s.id,
          detail: `${b.unit} (${b.proj}) booked to ${b.buyer} at ₹${b.price.toLocaleString('en-IN')}.`,
          who: me.name,
        });
        return s;
      });
      return reply.status(201).send({ ...row, price: toRupees(row.price) });
    },
  );

  /* ------------------------------------------------------------- reminders */

  app.get(
    '/reminders',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: { tags: ['money'], summary: 'Payment chases', response: { 200: z.any() } },
    },
    async () => db.paymentReminder.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
  );

  app.post(
    '/reminders',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['money'],
        summary: 'Draft a payment reminder',
        description:
          'Drafted, not sent. A reminder is a letter to a customer about money, carrying the ' +
          'firm name, so it needs a second person to approve it.',
        body: z.object({
          saleId: z.string().trim().max(40).optional(),
          buyer: z.string().trim().max(200).default(''),
          channel: z.string().trim().max(40).default(''),
          subject: z.string().trim().max(300).default(''),
          body: z.string().trim().max(20_000).default(''),
        }),
        response: { 201: z.any() },
      },
    },
    async (req, reply) => {
      const b = req.body;
      const row = await db.paymentReminder.create({
        data: { ...b, saleId: b.saleId ?? null, approved: false },
      });
      return reply.status(201).send({
        ...row,
        delivered: false,
        deliveryNote:
          'Drafted and queued. It is not sent: it needs approval, and there is no mail or ' +
          'WhatsApp gateway configured — see docs/DEPLOYMENT.md.',
      });
    },
  );

  app.post(
    '/reminders/:id/approve',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['money'],
        summary: 'Approve a drafted reminder',
        params: z.object({ id: z.string() }),
        response: { 200: z.any(), 403: z.any(), 404: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const rem = await db.paymentReminder.findUnique({ where: { id: req.params.id } });
      if (!rem) throw notFound('That reminder');

      // Two people, not one. Approving your own draft makes the approval a
      // formality, which is the same as not having one.
      if (rem.approvedBy === me.sub) throw conflict('That reminder is already approved.');

      const row = await db.$transaction(async (tx) => {
        const r = await tx.paymentReminder.update({
          where: { id: rem.id },
          data: { approved: true, approvedBy: me.sub },
        });
        await appendInTx(tx, {
          kind: 'doc',
          subject: rem.saleId ?? rem.buyer,
          detail: `Payment reminder to ${rem.buyer} approved to go out.`,
          who: me.name,
        });
        return r;
      });
      return {
        ...row,
        delivered: false,
        deliveryNote: 'Approved. Still not sent — no mail or WhatsApp gateway is configured.',
      };
    },
  );

  /* -------------------------------------------------------- banks and cards */

  app.get(
    '/banks',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: { tags: ['money'], summary: 'Bank accounts', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.bankAccount.findMany({ orderBy: { bank: 'asc' } });
      return rows.map((b) => ({ ...b, bal: toRupees(b.bal) }));
    },
  );

  // NOT `/cards`: that is the HR ID-card bureau. Fastify refused to start on
  // the collision, which is the right behaviour — a silently shadowed route is
  // how one screen quietly starts showing another screen's data.
  app.get(
    '/credit-cards',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: { tags: ['money'], summary: 'Credit cards', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.creditCard.findMany({ orderBy: { bank: 'asc' } });
      return rows.map((c) => ({ ...c, limit: toRupees(c.limit), used: toRupees(c.used) }));
    },
  );

  /**
   * Raise a withdrawal against a RERA escrow account.
   *
   * The button for this used to say "Withdrawal request raised to bank" and do
   * nothing whatsoever. RERA escrow money is not the developer's to move: the
   * three certifications (engineer, architect, chartered accountant) are the
   * law's condition for releasing it, and the API refuses without all three.
   */
  app.post(
    '/banks/:id/withdrawal',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['money'],
        summary: 'Raise a withdrawal request against an account',
        body: z.object({
          amount: money,
          purpose: z.string().trim().min(4).max(500),
          certifications: z
            .object({ engineer: z.boolean(), architect: z.boolean(), ca: z.boolean() })
            .default({ engineer: false, architect: false, ca: false }),
        }),
        params: z.object({ id: z.string() }),
        response: { 201: z.any(), 404: z.any(), 422: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const account = await db.bankAccount.findUnique({ where: { id: req.params.id } });
      if (!account) throw notFound(`Account ${req.params.id}`);
      const b = req.body;

      const isEscrow = /rera|escrow/i.test(account.type);
      if (isEscrow) {
        const missing = Object.entries(b.certifications)
          .filter(([, v]) => !v)
          .map(([k]) => k);
        if (missing.length) {
          throw unprocessable(
            `This is a RERA escrow account. All three certifications are needed before money can ` +
              `be drawn: missing ${missing.join(', ')}.`,
            missing.map((m) => ({ path: `certifications.${m}`, message: 'Not certified.' })),
          );
        }
      }

      if (toPaise(b.amount) > account.bal) {
        throw unprocessable(
          `That account holds ₹${toRupees(account.bal).toLocaleString('en-IN')}. You cannot draw ₹${b.amount.toLocaleString('en-IN')} from it.`,
        );
      }

      await db.$transaction(async (tx) => {
        await appendInTx(tx, {
          kind: 'doc',
          subject: account.id,
          detail:
            `Withdrawal of ₹${b.amount.toLocaleString('en-IN')} requested from ${account.bank} ${account.acc} ` +
            `(${account.type}) — ${b.purpose}.`,
          who: me.name,
        });
      });

      return reply.status(201).send({
        account: account.id,
        amount: b.amount,
        purpose: b.purpose,
        recorded: true,
        // Honest: nothing here talks to a bank.
        submittedToBank: false,
        note:
          'Recorded and sealed into the ledger. It has NOT been submitted to the bank — there is ' +
          'no banking integration. Take this record to the bank, or wire one up.',
      });
    },
  );

  /* --------------------------------------------------------------- masters */

  app.get(
    '/master-companies',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: { tags: ['money'], summary: 'Counterparties', response: { 200: z.any() } },
    },
    async () => {
      const rows = await db.masterCompany.findMany({ orderBy: { name: 'asc' } });
      return rows.map((c) => ({ ...c, gstinCheck: gstinCheck(c.gstin), panCheck: panCheck(c.pan) }));
    },
  );

  app.put(
    '/master-companies/:id',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: {
        tags: ['money'],
        summary: 'Add or update a counterparty',
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().trim().min(2).max(200),
          kind: z.string().trim().max(60).default(''),
          gstin: z.string().trim().toUpperCase().max(15).default(''),
          pan: z.string().trim().toUpperCase().max(10).default(''),
          city: z.string().trim().max(80).default(''),
        }),
        response: { 200: z.any(), 422: z.any() },
      },
    },
    async (req) => {
      const b = req.body;
      if (b.gstin) {
        const g = gstinCheck(b.gstin);
        if (g.level === 'error') {
          throw unprocessable(g.msg ?? 'Bad GSTIN.', [{ path: 'gstin', message: g.msg ?? '' }]);
        }
      }
      const row = await db.masterCompany.upsert({
        where: { id: req.params.id },
        create: { id: req.params.id, ...b },
        update: b,
      });
      return { ...row, gstinCheck: gstinCheck(row.gstin), panCheck: panCheck(row.pan) };
    },
  );

  /* --------------------------------------------------------------- exports */

  /**
   * Record that data left the building.
   *
   * An export is the moment information stops being under your control. It is
   * worth knowing who took what, and when.
   */
  app.post(
    '/exports',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['money'],
        summary: 'Register an export',
        body: z.object({
          key: z.string().trim().min(1).max(80),
          title: z.string().trim().max(200).default(''),
          rows: z.number().int().min(0).default(0),
          period: z.string().trim().max(60).default(''),
        }),
        response: { 201: z.any() },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const row = await db.exportRecord.create({ data: { ...req.body, byId: me.sub } });
      return reply.status(201).send(row);
    },
  );

  app.get(
    '/exports',
    {
      preHandler: app.requireRole('MANAGER'),
      schema: { tags: ['money'], summary: 'What has been exported', response: { 200: z.any() } },
    },
    async () => db.exportRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
  );

  /* ------------------------------------------------- the Chairman's override */

  /**
   * Check an override code.
   *
   * The code used to be `const ADMIN_PIN = "2417"` in the browser bundle, which
   * means it was readable by anyone who opened developer tools — including
   * everyone it was meant to stop. It lives in the server's environment now and
   * is compared here, rate-limited, and every attempt is recorded.
   */
  app.post(
    '/override/verify',
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        tags: ['money'],
        summary: "Check the Chairman's override code",
        body: z.object({
          code: z.string().trim().min(1).max(20),
          what: z.string().trim().max(300).default(''),
        }),
        response: { 200: z.any(), 403: z.any(), 429: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const expected = app.env.OVERRIDE_PIN;

      if (!expected) {
        throw forbidden(
          'No override code is configured on this server. Set OVERRIDE_PIN before anyone needs it.',
        );
      }

      const ok = req.body.code.trim() === expected;
      await db.$transaction(async (tx) => {
        await appendInTx(tx, {
          kind: 'auth',
          subject: me.sub,
          detail: ok
            ? `Override accepted for: ${req.body.what || 'an action'}.`
            : `Override REFUSED — wrong code, for: ${req.body.what || 'an action'}.`,
          who: me.name,
        });
      });

      if (!ok) throw forbidden('That override code is not right.');
      return { ok: true as const, authorisedBy: "Chairman's override code" };
    },
  );
};
