/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * A NAME ON A SALARY BOOK WITH NOBODY BEHIND IT.
 *
 * Thirteen people were paid in August whom the employee register has never
 * heard of. Each is either somebody already on the rolls under a different
 * spelling, or somebody who worked here, was never enrolled, and may since have
 * left — which is where a leaver goes when nothing recorded that they arrived.
 *
 * Answering it must not invent anything, and must not create the two things it
 * exists to catch: a person paid twice in one month, and a record carrying a
 * joining date nobody knows.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { App } from '../app.js';
import { auth, makeApp, signIn } from './helpers.js';

const MONTH = 'Mar 2024';
const COMPANY = 'garg';

/** A released run with one line nobody on the register answers to. */
const stage = async (db: PrismaClient, extra?: { pid: string }) => {
  await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
  const run = await db.payRun.create({
    data: {
      month: MONTH,
      monthOn: new Date('2024-03-01T00:00:00Z'),
      monthDays: 31,
      companyId: COMPANY,
      status: 'released',
      source: 'imported',
    },
  });
  const line = await db.payRunLine.create({
    data: {
      runId: run.id,
      personId: null,
      name: 'Kishan Lal',
      designation: 'Civil Foreman',
      days: 31,
      gross: 32_000,
      eGross: 32_000,
      net: 32_000,
    },
  });
  if (extra) {
    await db.payRunLine.create({
      data: {
        runId: run.id,
        personId: extra.pid,
        name: 'Somebody Already Here',
        designation: 'Site Engineer',
        days: 31,
        gross: 30_000,
        eGross: 30_000,
        net: 30_000,
      },
    });
  }
  return { run, line };
};

const identify = (app: App, token: string, runId: string, lineId: string, body: unknown) =>
  app.inject({
    method: 'POST',
    url: `/api/v1/pay-runs/${runId}/lines/${lineId}/identify`,
    headers: auth(token),
    payload: body as Record<string, unknown>,
  });

const FORMER = {
  kind: 'former',
  dept: 'Project',
  type: 'Site',
  office: 'grand',
  lastDay: '31 Mar 2024',
  reason: 'Resigned',
  note: 'The site supervisor confirmed he worked at Grand until the end of March and did not come back.',
};

describe('saying who a payslip belongs to', () => {
  let app: App;
  let db: PrismaClient;
  let token: string;

  beforeEach(async () => {
    ({ app, db } = await makeApp());
    ({ token } = await signIn(app));
  });

  it('attaches it to somebody already on the rolls, creating nothing', async () => {
    try {
      const { run, line } = await stage(db);
      const before = await db.person.count();
      const someone = await db.person.findFirstOrThrow({ where: { employerId: COMPANY } });

      const res = await identify(app, token, run.id, line.id, { kind: 'known', pid: someone.id });
      expect(res.statusCode, res.body.slice(0, 300)).toBe(200);

      const after = await db.payRunLine.findUniqueOrThrow({ where: { id: line.id } });
      expect(after.personId).toBe(someone.id);
      // The name on the BOOK is kept. It is what the sheet said, and a line
      // that can no longer be traced to the row it came from is worse than one
      // spelt oddly.
      expect(after.name).toBe('Kishan Lal');
      expect(await db.person.count(), 'nobody new was invented').toBe(before);
    } finally {
      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
      await app.close();
      await db.$disconnect();
    }
  });

  it('refuses to put two payslips on one person in one month', async () => {
    try {
      const someone = await db.person.findFirstOrThrow({ where: { employerId: COMPANY } });
      const { run, line } = await stage(db, { pid: someone.id });

      const res = await identify(app, token, run.id, line.id, { kind: 'known', pid: someone.id });
      // That is the thing this screen exists to catch, not to record.
      expect(res.statusCode).toBe(409);
      expect(res.body).toMatch(/already on this sheet/i);
      expect((await db.payRunLine.findUniqueOrThrow({ where: { id: line.id } })).personId).toBeNull();
    } finally {
      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
      await app.close();
      await db.$disconnect();
    }
  });

  it('records somebody who was never enrolled, as having left', async () => {
    let made: string | null = null;
    try {
      const { run, line } = await stage(db);
      const res = await identify(app, token, run.id, line.id, FORMER);
      expect(res.statusCode, res.body.slice(0, 400)).toBe(200);
      made = res.json<{ person: { id: string } }>().person.id;

      const p = await db.person.findUniqueOrThrow({
        where: { id: made },
        include: { notes: true },
      });
      expect(p.name, 'the name comes off the book').toBe('Kishan Lal');
      expect(p.designation).toBe('Civil Foreman');
      expect(p.status).toBe('exited');
      expect(p.exitedOn).toBe('31 Mar 2024');
      expect(p.employerId, 'the company that paid them').toBe(COMPANY);
      // NOTHING IS INVENTED. No joining date was known, so there is none.
      expect(p.joined).toBe('');
      expect(p.joinedOn).toBeNull();
      expect(p.dob).toBeNull();
      expect(await db.salary.findUnique({ where: { personId: made } })).toBeNull();
      // And the record says where it came from and that the blank is deliberate.
      const note = p.notes[0]!.text;
      expect(note).toContain('Mar 2024 salary book');
      expect(note).toContain('joining date is not known');
      expect(note).toContain('site supervisor confirmed');

      expect((await db.payRunLine.findUniqueOrThrow({ where: { id: line.id } })).personId).toBe(made);
    } finally {
      if (made) await db.person.delete({ where: { id: made } }).catch(() => undefined);
      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
      await app.close();
      await db.$disconnect();
    }
  });

  it('keeps a joining date when there is one to keep', async () => {
    let made: string | null = null;
    try {
      const { run, line } = await stage(db);
      const res = await identify(app, token, run.id, line.id, { ...FORMER, joined: '02 Jan 2023' });
      expect(res.statusCode).toBe(200);
      made = res.json<{ person: { id: string } }>().person.id;
      const p = await db.person.findUniqueOrThrow({ where: { id: made } });
      expect(p.joined).toBe('02 Jan 2023');
      expect(p.joinedOn).not.toBeNull();
    } finally {
      if (made) await db.person.delete({ where: { id: made } }).catch(() => undefined);
      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
      await app.close();
      await db.$disconnect();
    }
  });

  it('will not record one without saying how it was established', async () => {
    try {
      const { run, line } = await stage(db);
      expect((await identify(app, token, run.id, line.id, { ...FORMER, note: 'dunno' })).statusCode).toBe(400);
      expect((await identify(app, token, run.id, line.id, { ...FORMER, lastDay: '' })).statusCode).toBe(400);
      expect((await identify(app, token, run.id, line.id, { ...FORMER, reason: 'Vanished' })).statusCode).toBe(400);
    } finally {
      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
      await app.close();
      await db.$disconnect();
    }
  });

  it('will not answer for a payslip that already has a person on it', async () => {
    try {
      const someone = await db.person.findFirstOrThrow({ where: { employerId: COMPANY } });
      const { run } = await stage(db, { pid: someone.id });
      const taken = await db.payRunLine.findFirstOrThrow({
        where: { runId: run.id, personId: { not: null } },
      });
      const res = await identify(app, token, run.id, taken.id, { kind: 'known', pid: someone.id });
      expect(res.statusCode).toBe(422);
      expect(res.body).toMatch(/already/i);
    } finally {
      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
      await app.close();
      await db.$disconnect();
    }
  });
});
