/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * THE LAST SALARY.
 *
 * Deboarding marks somebody exited when their assets come back — which is the
 * stage BEFORE full-and-final. A pay run that asked only for `active` people
 * therefore dropped them at exactly that point and paid them nothing for the
 * days they had worked that month. Nobody had been deboarded yet when this was
 * written, so the first person it would have happened to was a real one.
 *
 * And the other half of the same fault: a person who joined on the 20th was
 * paid for the whole month, because the attendance machine has no rows for
 * anybody before they are enrolled on it, and no rows reads as "not on the
 * machine", which pays the lot.
 */

import { describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { auth, makeApp, signIn } from './helpers.js';

const COMPANY = 'garg';
const MONTH = 'Feb 2025';
const MONTH_DAYS = 28;

interface Line {
  pid: string | null;
  name: string;
  days: number;
  eGross: number;
  gross: number;
  remark: string;
}

const draft = (app: App, token: string) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/pay-runs',
    headers: auth(token),
    payload: { month: MONTH, company: COMPANY, monthDays: MONTH_DAYS, attendanceMonth: '' },
  });

const lines = async (app: App, token: string): Promise<Line[]> => {
  const res = await draft(app, token);
  expect(res.statusCode, res.body.slice(0, 300)).toBe(200);
  return res.json<{ run: { lines: Line[] } }>().run.lines;
};

describe('somebody who left during the month', () => {
  it('is still paid, for the days up to their last one', async () => {
    const { app, db } = await makeApp();
    let victim: { id: string; status: string; exitedOn: string | null } | null = null;
    try {
      const { token } = await signIn(app);
      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });

      const before = await lines(app, token);
      const target = before.find((l) => l.pid && l.days === MONTH_DAYS)!;
      expect(target, 'somebody paid a whole month to start from').toBeTruthy();

      const person = await db.person.findUniqueOrThrow({ where: { id: target.pid! } });
      victim = { id: person.id, status: person.status, exitedOn: person.exitedOn };

      // Deboarded on the 12th: assets back, so the register says exited.
      await db.person.update({
        where: { id: person.id },
        data: { status: 'exited', exitedOn: `12 ${MONTH}` },
      });

      const after = await lines(app, token);
      const paid = after.find((l) => l.pid === person.id);
      expect(paid, 'their last salary is still on the run').toBeTruthy();
      expect(paid!.days).toBe(12);
      // Twelve days of a twenty-eight day month, not a whole one and not none.
      expect(paid!.eGross).toBeLessThan(target.eGross);
      expect(paid!.eGross).toBeGreaterThan(0);
      expect(paid!.remark).toContain('LAST SALARY');
      expect(paid!.remark).toContain(`12 ${MONTH}`);

      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
    } finally {
      if (victim) {
        await db.person.update({
          where: { id: victim.id },
          data: { status: victim.status, exitedOn: victim.exitedOn },
        });
      }
      await app.close();
      await db.$disconnect();
    }
  });

  it('is off the run once the month they left is behind us', async () => {
    const { app, db } = await makeApp();
    let victim: { id: string; status: string; exitedOn: string | null } | null = null;
    try {
      const { token } = await signIn(app);
      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });

      const before = await lines(app, token);
      const target = before.find((l) => l.pid)!;
      const person = await db.person.findUniqueOrThrow({ where: { id: target.pid! } });
      victim = { id: person.id, status: person.status, exitedOn: person.exitedOn };

      // Gone the month before this one.
      await db.person.update({
        where: { id: person.id },
        data: { status: 'exited', exitedOn: '20 Jan 2025' },
      });

      const after = await lines(app, token);
      expect(after.some((l) => l.pid === person.id), 'nobody is paid twice for leaving').toBe(false);
      expect(after.length).toBe(before.length - 1);

      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
    } finally {
      if (victim) {
        await db.person.update({
          where: { id: victim.id },
          data: { status: victim.status, exitedOn: victim.exitedOn },
        });
      }
      await app.close();
      await db.$disconnect();
    }
  });

  it('pays a mid-month joiner for the part of it that was theirs', async () => {
    const { app, db } = await makeApp();
    let victim: { id: string; joined: string } | null = null;
    try {
      const { token } = await signIn(app);
      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });

      const before = await lines(app, token);
      const target = before.find((l) => l.pid && l.days === MONTH_DAYS)!;
      const person = await db.person.findUniqueOrThrow({ where: { id: target.pid! } });
      victim = { id: person.id, joined: person.joined };

      await db.person.update({ where: { id: person.id }, data: { joined: `20 ${MONTH}` } });

      const after = await lines(app, token);
      const paid = after.find((l) => l.pid === person.id)!;
      expect(paid.days, 'the 20th to the 28th is nine days').toBe(9);
      expect(paid.remark).toContain('Part month');
      expect(paid.remark).toContain('joined on the 20');

      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
    } finally {
      if (victim) {
        await db.person.update({ where: { id: victim.id }, data: { joined: victim.joined } });
      }
      await app.close();
      await db.$disconnect();
    }
  });

  it('leaves out somebody who has not started yet', async () => {
    const { app, db } = await makeApp();
    let victim: { id: string; joined: string } | null = null;
    try {
      const { token } = await signIn(app);
      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });

      const before = await lines(app, token);
      const person = await db.person.findUniqueOrThrow({ where: { id: before.find((l) => l.pid)!.pid! } });
      victim = { id: person.id, joined: person.joined };
      await db.person.update({ where: { id: person.id }, data: { joined: '03 Aug 2026' } });

      const after = await lines(app, token);
      expect(after.some((l) => l.pid === person.id)).toBe(false);

      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
    } finally {
      if (victim) {
        await db.person.update({ where: { id: victim.id }, data: { joined: victim.joined } });
      }
      await app.close();
      await db.$disconnect();
    }
  });
});
