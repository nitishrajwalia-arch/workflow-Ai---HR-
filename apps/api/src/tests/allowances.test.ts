/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * AN ALLOWANCE, FROM THE POLICY TO THE PAYSLIP.
 *
 * The arithmetic is tested in packages/shared. This is the wiring: that a
 * policy somebody sets actually reaches a pay run, that it lands on the right
 * people and nobody else, that it is part of what they are paid rather than a
 * number in a column beside it, and that changing the days changes it too.
 *
 * Everything is cleaned up after. The management has not written an allowance
 * policy down, and a test that leaves one behind is a test that puts money on
 * somebody's payslip.
 */

import { describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { auth, makeApp, signIn } from './helpers.js';

const COMPANY = 'garg';
const MONTH = 'Feb 2025';

const setHead = (app: App, token: string, head: Record<string, unknown>) =>
  app.inject({
    method: 'PUT',
    url: `/api/v1/allowance-heads/${COMPANY}/${head.code}`,
    headers: auth(token),
    payload: head,
  });

const draft = (app: App, token: string, body: Record<string, unknown> = {}) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/pay-runs',
    headers: auth(token),
    payload: { month: MONTH, company: COMPANY, monthDays: 30, attendanceMonth: '', ...body },
  });

interface Line {
  id: string;
  pid: string | null;
  name: string;
  days: number;
  eGross: number;
  eAllow: number;
  net: number;
  dTotal: number;
  arrear: number;
  additions: Array<{ code: string; label: string; amount: number; taxable: boolean; why: string }>;
}

const SITE = {
  code: 'site',
  label: 'Site allowance',
  basis: 'flat',
  wage: 2_000,
  proRate: true,
  taxable: true,
  authority: 'Test policy — removed when this test finishes.',
};

describe('an allowance, from the policy to the payslip', () => {
  it('is set, reaches the run, is part of the net, and is cleaned away again', async () => {
    const { app, db } = await makeApp();
    try {
      const { token } = await signIn(app);
      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
      await db.allowanceHead.deleteMany({ where: { companyId: COMPANY } });

      /* ---- without it -------------------------------------------------- */
      const before = await draft(app, token);
      expect(before.statusCode, before.body.slice(0, 300)).toBe(200);
      const plain = before.json<{ run: { lines: Line[] } }>().run.lines;
      expect(plain.length).toBeGreaterThan(2);
      expect(plain.every((l) => l.eAllow === 0)).toBe(true);
      const netBefore = plain.reduce((a, l) => a + l.net, 0);

      /* ---- set the policy ---------------------------------------------- */
      const put = await setHead(app, token, SITE);
      expect(put.statusCode, put.body.slice(0, 300)).toBe(200);
      const saved = put.json<{ setBy: string; setOn: string }>();
      expect(saved.setBy, 'whoever set it is named on it').toBeTruthy();
      expect(saved.setOn).toBeTruthy();

      /* ---- work the month out again ------------------------------------ */
      const after = await draft(app, token);
      expect(after.statusCode).toBe(200);
      const paid = after.json<{ run: { id: string; lines: Line[] } }>().run;
      const line = paid.lines.find((l) => l.days === 30)!;
      expect(line, 'somebody paid a whole month').toBeTruthy();
      expect(line.eAllow).toBe(2_000);
      expect(line.additions).toHaveLength(1);
      expect(line.additions[0]!.label).toBe('Site allowance');
      expect(line.additions[0]!.taxable).toBe(true);
      expect(line.additions[0]!.why, 'the sheet says how the figure was reached').toContain('a month');

      // THE POINT OF THE WHOLE THING: it is money the person is paid, not a
      // number in a column beside what they are paid.
      const netAfter = paid.lines.reduce((a, l) => a + l.net, 0);
      const allowTotal = paid.lines.reduce((a, l) => a + l.eAllow, 0);
      expect(netAfter - netBefore).toBe(allowTotal);
      expect(allowTotal).toBe(paid.lines.length * 2_000);

      /* ---- change the days and it follows ------------------------------ */
      const half = await app.inject({
        method: 'PATCH',
        url: `/api/v1/pay-runs/${paid.id}/lines/${line.id}`,
        headers: auth(token),
        payload: { days: 15 },
      });
      expect(half.statusCode, half.body.slice(0, 300)).toBe(200);
      const changed = half.json<{ run: { lines: Line[] } }>().run.lines.find((l) => l.id === line.id)!;
      // A pro-rated allowance left at its old value is a net that does not add
      // up — and it adds up on screen, because the screen shows the stored one.
      expect(changed.days).toBe(15);
      expect(changed.eAllow).toBe(1_000);
      expect(changed.net).toBe(changed.eGross + changed.eAllow - changed.dTotal + changed.arrear);

      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
    } finally {
      await db.allowanceHead.deleteMany({ where: { companyId: COMPANY } });
      await app.close();
      await db.$disconnect();
    }
  });

  it('reaches the group it names and nobody else', async () => {
    const { app, db } = await makeApp();
    try {
      const { token } = await signIn(app);
      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
      await db.allowanceHead.deleteMany({ where: { companyId: COMPANY } });

      const people = await db.person.findMany({
        where: { employerId: COMPANY, status: 'active' },
        select: { id: true, dept: true },
      });
      const depts = [...new Set(people.map((p) => p.dept))];
      expect(depts.length, 'this test needs a company with more than one department').toBeGreaterThan(1);
      const pick = depts[0]!;
      const inIt = new Set(people.filter((p) => p.dept === pick).map((p) => p.id));

      await setHead(app, token, { ...SITE, appliesTo: pick });
      const res = await draft(app, token);
      const lines = res.json<{ run: { lines: Line[] } }>().run.lines;
      for (const l of lines) {
        const want = l.pid && inIt.has(l.pid) ? 2_000 : 0;
        expect(l.eAllow, `${l.name} (${want ? pick : 'not ' + pick})`).toBe(want);
      }
      expect(lines.some((l) => l.eAllow > 0), 'somebody got it').toBe(true);
      expect(lines.some((l) => l.eAllow === 0), 'and somebody did not').toBe(true);

      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
    } finally {
      await db.allowanceHead.deleteMany({ where: { companyId: COMPANY } });
      await app.close();
      await db.$disconnect();
    }
  });

  it('reaches nobody at all when the group is mistyped', async () => {
    const { app, db } = await makeApp();
    try {
      const { token } = await signIn(app);
      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
      await db.allowanceHead.deleteMany({ where: { companyId: COMPANY } });

      // The dangerous failure is the other way round: a scope nobody matches
      // being treated as "no scope" and paying the whole company.
      await setHead(app, token, { ...SITE, appliesTo: 'Maintenanse' });
      const res = await draft(app, token);
      const lines = res.json<{ run: { lines: Line[] } }>().run.lines;
      expect(lines.every((l) => l.eAllow === 0)).toBe(true);

      await db.payRun.deleteMany({ where: { companyId: COMPANY, month: MONTH } });
    } finally {
      await db.allowanceHead.deleteMany({ where: { companyId: COMPANY } });
      await app.close();
      await db.$disconnect();
    }
  });

  it('will not take a policy with nothing to trace it to', async () => {
    const { app, db } = await makeApp();
    try {
      const { token } = await signIn(app);
      const res = await setHead(app, token, { ...SITE, code: 'nopolicy', authority: '' });
      expect(res.statusCode, 'a figure nobody can trace is one somebody must defend alone').toBe(400);
    } finally {
      await db.allowanceHead.deleteMany({ where: { companyId: COMPANY } });
      await app.close();
      await db.$disconnect();
    }
  });

  it('is behind the same money check as what comes off a payslip', async () => {
    const { app, db } = await makeApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/api/v1/allowance-heads' });
      expect(res.statusCode, 'no token, no answer').toBeGreaterThanOrEqual(401);
    } finally {
      await app.close();
      await db.$disconnect();
    }
  });
});
