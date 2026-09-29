/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * THE LAST DAY SOMEBODY WORKED.
 *
 * Deboarding used to stamp the person as having left on the day their assets
 * came back. That is a different date, and quietly wrong: a man who stops
 * coming in on the 5th and hands his laptop back on the 20th was recorded as
 * leaving on the 20th, and his final salary was worked out to the 20th.
 *
 * So it is asked for when the deboarding is opened — the resignation states it,
 * or they walked out on it — and that is the date the register carries.
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { App } from '../app.js';
import { auth, makeApp, signIn } from './helpers.js';

const SUBJECT = 'MB-ADM-0003';
const LAST_DAY = '05 Sep 2026';

let app: App;
let db: PrismaClient;
let token: string;

beforeAll(async () => {
  ({ app, db } = await makeApp());
  ({ token } = await signIn(app));
});

beforeEach(async () => {
  await db.exit.deleteMany({ where: { personId: SUBJECT } });
  await db.person.update({
    where: { id: SUBJECT },
    data: { status: 'active', exitedOn: null },
  });
});

afterAll(async () => {
  await db.exit.deleteMany({ where: { personId: SUBJECT } });
  await db.person.update({
    where: { id: SUBJECT },
    data: { status: 'active', exitedOn: null },
  });
  await app.close();
  await db.$disconnect();
});

const open = (body: Record<string, unknown> = {}) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/exits',
    headers: auth(token),
    payload: { pid: SUBJECT, reason: 'Resigned', lastDay: LAST_DAY, ...body },
  });

const advance = (id: string, fromStage: string, summary: string) =>
  app.inject({
    method: 'POST',
    url: `/api/v1/exits/${id}/advance`,
    headers: auth(token),
    payload: { fromStage, summary, payload: {} },
  });

/** Walk it to the stage that marks somebody as gone. */
const toAssetsCleared = async (id: string) => {
  for (const [from, note] of [
    ['decision', 'Resignation accepted by the department head.'],
    ['handover', 'Files and keys handed to the Store Incharge.'],
    ['assets', 'Laptop and access card returned, logins revoked.'],
  ] as const) {
    const r = await advance(id, from, note);
    expect(r.statusCode, r.body.slice(0, 200)).toBe(200);
  }
};

describe('the last working day', () => {
  it('is required — a deboarding cannot be opened without it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/exits',
      headers: auth(token),
      payload: { pid: SUBJECT, reason: 'Resigned' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('is kept on the deboarding from the moment it is opened', async () => {
    const res = await open();
    expect(res.statusCode).toBe(201);
    expect(res.json<{ lastDay: string }>().lastDay).toBe(LAST_DAY);
  });

  it('is the date the register carries, not the day the assets came back', async () => {
    const id = (await open()).json<{ id: string }>().id;
    await toAssetsCleared(id);
    const person = await db.person.findUniqueOrThrow({ where: { id: SUBJECT } });
    expect(person.status).toBe('exited');
    // THE WHOLE POINT. Today is the day the laptop came back; the 5th is the
    // day he stopped working, and it is the day his final salary runs to.
    expect(person.exitedOn).toBe(LAST_DAY);
  });

  it('moves when a notice period changes, and says why on the record', async () => {
    const id = (await open()).json<{ id: string }>().id;
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/exits/${id}/last-day`,
      headers: auth(token),
      payload: { lastDay: '19 Sep 2026', why: 'Notice extended by a fortnight at his request.' },
    });
    expect(res.statusCode, res.body.slice(0, 300)).toBe(200);
    expect(res.json<{ lastDay: string }>().lastDay).toBe('19 Sep 2026');

    await toAssetsCleared(id);
    const person = await db.person.findUniqueOrThrow({ where: { id: SUBJECT } });
    expect(person.exitedOn).toBe('19 Sep 2026');
  });

  it('keeps the register and the deboarding saying the same thing', async () => {
    const id = (await open()).json<{ id: string }>().id;
    await toAssetsCleared(id);
    expect((await db.person.findUniqueOrThrow({ where: { id: SUBJECT } })).exitedOn).toBe(LAST_DAY);

    // Corrected after they were already marked as gone — payroll reads the
    // register, so the register has to move with it.
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/exits/${id}/last-day`,
      headers: auth(token),
      payload: { lastDay: '01 Sep 2026', why: 'He had actually stopped coming in the week before.' },
    });
    expect(res.statusCode).toBe(200);
    expect((await db.person.findUniqueOrThrow({ where: { id: SUBJECT } })).exitedOn).toBe('01 Sep 2026');
  });

  it('will not move without a reason', async () => {
    const id = (await open()).json<{ id: string }>().id;
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/exits/${id}/last-day`,
      headers: auth(token),
      payload: { lastDay: '19 Sep 2026' },
    });
    // It changes what somebody is paid. It is not a silent edit.
    expect(res.statusCode).toBe(400);
  });

  it('will not move on a deboarding that is closed', async () => {
    const id = (await open()).json<{ id: string }>().id;
    for (const [from, note] of [
      ['decision', 'Resignation accepted.'],
      ['handover', 'Files handed over.'],
      ['assets', 'Assets back, access revoked.'],
      ['dues', 'Full and final paid.'],
      ['papers', 'Relieving letter issued.'],
    ] as const) {
      expect((await advance(id, from, note)).statusCode).toBe(200);
    }
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/exits/${id}/last-day`,
      headers: auth(token),
      payload: { lastDay: '19 Sep 2026', why: 'Trying to rewrite a settled exit.' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.body).toMatch(/what was settled/i);
  });

  it('refuses a date that is not a date', async () => {
    expect((await open({ lastDay: 'last Tuesday' })).statusCode).toBe(400);
    expect((await open({ lastDay: '2026-09-05' })).statusCode).toBe(400);
  });
});

describe('the final salary follows the last working day', () => {
  it('pays to the day they stopped, not the day the laptop came back', async () => {
    const id = (await open({ lastDay: '10 Sep 2026' })).json<{ id: string }>().id;
    await toAssetsCleared(id);

    const person = await db.person.findUniqueOrThrow({ where: { id: SUBJECT } });
    await db.payRun.deleteMany({ where: { companyId: person.employerId, month: 'Sep 2026' } });
    const run = await app.inject({
      method: 'POST',
      url: '/api/v1/pay-runs',
      headers: auth(token),
      payload: {
        month: 'Sep 2026',
        company: person.employerId,
        monthDays: 30,
        attendanceMonth: '',
      },
    });
    expect(run.statusCode, run.body.slice(0, 300)).toBe(200);
    const line = run
      .json<{ run: { lines: Array<{ pid: string | null; days: number; remark: string }> } }>()
      .run.lines.find((l) => l.pid === SUBJECT);
    expect(line, 'their last salary is still on the run').toBeTruthy();
    expect(line!.days).toBe(10);
    expect(line!.remark).toContain('10 Sep 2026');

    await db.payRun.deleteMany({ where: { companyId: person.employerId, month: 'Sep 2026' } });
  });
});
