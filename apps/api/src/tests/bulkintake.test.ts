/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * THE BULK INTAKE SHEET, END TO END.
 *
 * HR fills a sheet in and fifty people arrive at once. The failure that matters
 * is not a crash — it is a column that lands nowhere and a person who looks
 * enrolled and is not paid.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { App } from '../app.js';
import { auth, makeApp, signIn } from './helpers.js';

const MADE = ['Tester One Intake', 'Tester Two Intake'];

const ROW = {
  name: MADE[0],
  desig: 'Site Engineer',
  dept: 'Project',
  office: 'Grand',
  joined: '05/06/2024',
  phone: '9876500123',
  email: 'tester.one@example.com',
  workEmail: 'tester.one@marbellagroup.in',
  sim: '9811122233',
  pan: 'ABCDE1234F',
  aadhaar: '2345 6789 0123',
  basic: '20000',
  hra: '6000',
  travel: '2000',
  medical: '500',
  special: '3500',
  pfOn: 'yes',
  esiOn: 'no',
};

describe('a sheet of new people', () => {
  let app: App;
  let db: PrismaClient;
  let token: string;

  beforeEach(async () => {
    ({ app, db } = await makeApp());
    ({ token } = await signIn(app));
    await db.person.deleteMany({ where: { name: { in: MADE } } });
  });

  afterEach(async () => {
    await db.person.deleteMany({ where: { name: { in: MADE } } });
    await app.close();
    await db.$disconnect();
  });

  const send = (rows: unknown[], commit = true) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/imports/people',
      headers: auth(token),
      payload: { rows, commit },
    });

  const madePerson = async (name: string) =>
    db.person.findFirstOrThrow({
      where: { name },
      include: { salary: true, contact: true, kyc: true, devices: true },
    });

  it('lands every column the sheet carries', async () => {
    const res = await send([ROW]);
    expect(res.statusCode, res.body.slice(0, 400)).toBe(200);

    const p = await madePerson(MADE[0]!);
    expect(p.designation).toBe('Site Engineer');
    expect(p.dept).toBe('Project');
    expect(p.joined, 'DD/MM/YYYY is read day-first, as India writes it').toBe('05 Jun 2024');

    // THE ONE THAT COST MONEY. The importer never set a gross, and payroll
    // skips anybody whose gross is zero — so every person brought in this way
    // looked enrolled and was silently never paid.
    expect(p.salary?.gross, 'added up from the parts when the sheet gives no gross').toBe(32_000);
    expect(p.salary?.basic).toBe(20_000);
    expect(p.salary?.hra).toBe(6_000);
    expect(p.salary?.travel, 'travelling used to land nowhere').toBe(2_000);
    expect(p.salary?.medical, 'medical used to land nowhere').toBe(500);
    expect(p.salary?.special).toBe(3_500);
    expect(p.salary?.pfOn).toBe(true);
    expect(p.salary?.esiOn).toBe(false);

    expect(p.contact?.phone).toBe('9876500123');
    expect(p.contact?.email).toBe('tester.one@example.com');
    expect(p.contact?.workEmail).toBe('tester.one@marbellagroup.in');
    expect(p.kyc?.pan).toBe('ABCDE1234F');
    expect(p.kyc?.aadhaar, 'stored as twelve digits').toBe('234567890123');
  });

  it('keeps a company SIM that arrived without a handset', async () => {
    // It used to need an IMEI, so a company number recorded on its own — which
    // is most of them — was dropped on the floor.
    await send([{ ...ROW, imei: undefined }]);
    const p = await madePerson(MADE[0]!);
    expect(p.devices).toHaveLength(1);
    expect(p.devices[0]!.sim).toBe('9811122233');
    expect(p.devices[0]!.type).toBe('SIM');
  });

  it('takes the gross the sheet states over the sum of the parts', async () => {
    // The parts add to 32,000; the sheet says 35,000. The sheet is what was
    // agreed with the person, and the difference is a thing to look at, not to
    // quietly overwrite.
    await send([{ ...ROW, gross: '35000' }]);
    expect((await madePerson(MADE[0]!)).salary?.gross).toBe(35_000);
  });

  it('does not switch anything on because a cell was left blank', async () => {
    await send([{ ...ROW, pfOn: '', esiOn: 'maybe' }]);
    const s = (await madePerson(MADE[0]!)).salary!;
    expect(s.pfOn).toBe(false);
    expect(s.esiOn).toBe(false);
  });

  it('pays them on the next run, which is the whole point', async () => {
    await send([{ ...ROW, name: MADE[1] }]);
    const p = await madePerson(MADE[1]!);
    await db.payRun.deleteMany({ where: { companyId: p.employerId, month: 'Jul 2024' } });
    const run = await app.inject({
      method: 'POST',
      url: '/api/v1/pay-runs',
      headers: auth(token),
      payload: { month: 'Jul 2024', company: p.employerId, monthDays: 31, attendanceMonth: '' },
    });
    expect(run.statusCode, run.body.slice(0, 300)).toBe(200);
    const line = run
      .json<{ run: { lines: Array<{ pid: string | null; gross: number }> } }>()
      .run.lines.find((l) => l.pid === p.id);
    expect(line, 'on the run, not missing from it').toBeTruthy();
    expect(line!.gross).toBe(32_000);
    await db.payRun.deleteMany({ where: { companyId: p.employerId, month: 'Jul 2024' } });
  });

  it('refuses a date it cannot read rather than guessing one', async () => {
    const res = await send([{ ...ROW, joined: 'last Tuesday' }], false);
    expect(res.statusCode).toBe(200);
    const body = res.json<{ rejected: Array<{ field: string; why: string }> }>();
    expect(body.rejected.some((r) => r.field === 'joined')).toBe(true);
  });
});
