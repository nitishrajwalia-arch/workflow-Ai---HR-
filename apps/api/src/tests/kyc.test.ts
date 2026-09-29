/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * Identity papers: Aadhaar, PAN and the home address.
 *
 * The company's own KYC has been in the database since the import scripts
 * loaded it — 126 Aadhaar numbers, 124 PANs, 126 addresses. No route read it
 * and no route wrote it, so HR could not see any of it and could not add any
 * of it. Meanwhile the enrolment form REFUSED to go past its second step
 * without a PAN and an Aadhaar, put them in a body `createPersonBody` did not
 * carry, and told HR the person was enrolled. Zod stripped both silently.
 *
 * These tests hold the loop shut at both ends: the papers go in, they come
 * back, a number that cannot be right is refused rather than stored, and
 * nobody below HR gets to look.
 */

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { auth, makeApp, signIn } from './helpers.js';
import { hashPassword } from '../lib/password.js';

let app: App;
let db: PrismaClient;
let token: string;
/** A desk that is emphatically not HR. */
let viewerToken: string;

const VIEWER_EMAIL = 'kyc-viewer@marbellagroup.in';
const PERSON = 'MB-ACC-0001';

beforeAll(async () => {
  ({ app, db } = await makeApp());
  ({ token } = await signIn(app));

  await db.user.deleteMany({ where: { email: VIEWER_EMAIL } });
  await db.user.create({
    data: {
      email: VIEWER_EMAIL,
      name: 'A Storeman',
      passwordHash: await hashPassword('DevPassword123!'),
      role: 'VIEWER',
      userKey: 'storeAsst',
    },
  });
  ({ token: viewerToken } = await signIn(app, VIEWER_EMAIL, 'DevPassword123!'));
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: VIEWER_EMAIL } });
  await app.close();
  await db.$disconnect();
});

const get = (url: string, t = token) =>
  app.inject({ method: 'GET', url: `/api/v1${url}`, headers: auth(t) });
const put = (url: string, payload: Record<string, unknown>, t = token) =>
  app.inject({ method: 'PUT', url: `/api/v1${url}`, headers: auth(t), payload });
const message = (res: { json: () => unknown }): string =>
  (res.json() as { error?: { message?: string } }).error?.message ?? '';

describe('reading somebody’s papers', () => {
  it('hands them to HR and seals the fact that they were looked at', async () => {
    const res = await get(`/people/${PERSON}/kyc`);
    expect(res.statusCode).toBe(200);
    const body = res.json<{ aadhaar: string; pan: string; address: string }>();
    // The company's own data is there. It always was; nothing could reach it.
    expect(body.aadhaar).not.toBe('');
    expect(body.pan).not.toBe('');

    const seal = await db.ledgerEntry.findFirst({
      where: { kind: 'doc', subject: PERSON },
      orderBy: { seq: 'desc' },
    });
    expect(seal?.detail).toMatch(/were opened/);
    expect(seal?.who).not.toBe('');
    // The ledger says WHO looked, never WHAT they saw.
    expect(seal?.detail).not.toContain(body.aadhaar);
    expect(seal?.detail).not.toContain(body.pan);
  });

  it('tells HR when a number on file cannot be right', async () => {
    const res = await get(`/people/${PERSON}/kyc`);
    const body = res.json<{ aadhaarCheck: { level: string }; panCheck: { level: string } }>();
    expect(['ok', 'error', 'warn', 'none']).toContain(body.aadhaarCheck.level);
    expect(['ok', 'error', 'warn', 'none']).toContain(body.panCheck.level);
  });

  it('refuses anybody below HR', async () => {
    const res = await get(`/people/${PERSON}/kyc`, viewerToken);
    expect(res.statusCode).toBe(403);
  });

  it('refuses an anonymous request', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/people/${PERSON}/kyc` });
    expect(res.statusCode).toBe(401);
  });
});

describe('recording somebody’s papers', () => {
  it('refuses an Aadhaar number that fails its own check digit', async () => {
    // Twelve digits, right shape, one digit wrong. This is the typo that costs
    // money: P.F. and E.S.I. are filed against the number.
    const res = await put(`/people/${PERSON}/kyc`, { aadhaar: '2767 8628 6749', pan: '', address: '' });
    expect(res.statusCode).toBe(400);
    expect(message(res)).toMatch(/cannot be right|check digit/i);
  });

  it('refuses an Aadhaar number of the wrong length', async () => {
    const res = await put(`/people/${PERSON}/kyc`, { aadhaar: '2767 8628 674', pan: '', address: '' });
    expect(res.statusCode).toBe(400);
  });

  it('refuses a PAN of the wrong shape', async () => {
    const res = await put(`/people/${PERSON}/kyc`, { aadhaar: '', pan: 'ABCD1234EF', address: '' });
    expect(res.statusCode).toBe(400);
  });

  it('stores a good one, strips the spaces, and does not print it in the ledger', async () => {
    const before = await db.kyc.findUnique({ where: { personId: PERSON } });
    try {
      const res = await put(`/people/${PERSON}/kyc`, {
        aadhaar: '2767 8628 6748',
        pan: 'ABCDE1234F',
        address: '12 Some Road, Mohali',
      });
      expect(res.statusCode).toBe(200);
      const row = await db.kyc.findUnique({ where: { personId: PERSON } });
      expect(row?.aadhaar).toBe('276786286748'); // stored without the spaces
      expect(row?.pan).toBe('ABCDE1234F');
      expect(row?.address).toBe('12 Some Road, Mohali');

      const seal = await db.ledgerEntry.findFirst({
        where: { kind: 'doc', subject: PERSON },
        orderBy: { seq: 'desc' },
      });
      expect(seal?.detail).toMatch(/were recorded/);
      expect(seal?.detail).not.toContain('276786286748');
      expect(seal?.detail).not.toContain('ABCDE1234F');
    } finally {
      if (before) {
        await db.kyc.update({
          where: { personId: PERSON },
          data: { aadhaar: before.aadhaar, pan: before.pan, address: before.address },
        });
      }
    }
  });

  it('refuses anybody below HR', async () => {
    const res = await put(`/people/${PERSON}/kyc`, { aadhaar: '', pan: '', address: '' }, viewerToken);
    expect(res.statusCode).toBe(403);
  });

  it('404s for an employee who does not exist', async () => {
    const res = await put('/people/MB-ZZZ-9999/kyc', { aadhaar: '', pan: '', address: '' });
    expect(res.statusCode).toBe(404);
  });
});

describe('the papers never ride in the bootstrap payload', () => {
  it('because that payload is what the shareable preview is built from', async () => {
    const res = await get('/bootstrap');
    expect(res.statusCode).toBe(200);
    const raw = res.body;
    const kyc = await db.kyc.findFirst({ where: { aadhaar: { not: '' } } });
    expect(kyc).toBeTruthy();
    expect(raw).not.toContain(kyc!.aadhaar);
    if (kyc!.pan) expect(raw).not.toContain(kyc!.pan);
    expect(raw).not.toContain('"kyc"');
  });
});

/**
 * The rest of what the enrolment form asks.
 *
 * Fifteen questions whose answers had nowhere to go: the weekly off, the
 * probation, the conditions agreed, where they worked before, the driving
 * licence for whoever drives as part of the work, the two photo IDs, and
 * whether the address on file is the one on the Aadhaar. HR filled them in,
 * the screen said the person was enrolled, and Zod dropped every one.
 */
describe('enrolling somebody keeps what they were asked', () => {
  const NEW_ID = 'MB-ADM-0099';

  it('stores the terms, the prior job and the rest of the papers', async () => {
    await db.kyc.deleteMany({ where: { personId: NEW_ID } });
    await db.person.deleteMany({ where: { id: NEW_ID } });
    const office = await db.office.findFirst();
    const company = await db.company.findFirst();
    expect(office && company).toBeTruthy();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/people',
        headers: auth(token),
        payload: {
          id: NEW_ID,
          name: 'A Test Joiner',
          designation: 'Rider',
          dept: 'Admin',
          type: 'Staff',
          joined: '01 Oct 2026',
          office: office!.id,
          employer: company!.id,
          offDay: 'Rotational',
          probation: '6 months',
          conditions: 'Owns the bike. Fuel reimbursed monthly.',
          prevEmployer: 'Ansal Housing',
          prevRole: 'Delivery rider',
          prevFrom: 'Jan 2024',
          prevTo: 'Sep 2026',
          kyc: {
            aadhaar: '2767 8628 6748',
            pan: 'ABCDE1234F',
            address: '12 Some Road, Mohali',
            addressMatchesAadhaar: 'Yes',
            drives: true,
            dl: 'PB65 2020 001234',
            dlExpires: '01 Jan 2030',
            idType1: 'Voter ID',
            idNo1: 'ABC1234567',
            idType2: 'Passport',
            idNo2: 'Z1234567',
          },
        },
      });
      expect(res.statusCode).toBe(201);

      const row = await db.person.findUnique({ where: { id: NEW_ID } });
      expect(row?.offDay).toBe('Rotational');
      expect(row?.probation).toBe('6 months');
      expect(row?.conditions).toMatch(/Owns the bike/);
      expect(row?.prevEmployer).toBe('Ansal Housing');
      expect(row?.prevRole).toBe('Delivery rider');
      expect(row?.prevFrom).toBe('Jan 2024');
      expect(row?.prevTo).toBe('Sep 2026');

      const papers = await db.kyc.findUnique({ where: { personId: NEW_ID } });
      expect(papers?.aadhaar).toBe('276786286748');
      expect(papers?.pan).toBe('ABCDE1234F');
      expect(papers?.drives).toBe(true);
      expect(papers?.dl).toBe('PB65 2020 001234');
      expect(papers?.dlExpires).toBe('01 Jan 2030');
      expect(papers?.idNo1).toBe('ABC1234567');
      expect(papers?.idType2).toBe('Passport');
      expect(papers?.addressMatchesAadhaar).toBe('Yes');

      // And they come back out again, so the profile can show them.
      const back = await get(`/people/${NEW_ID}`);
      const body = back.json<{ offDay: string; prevEmployer: string; probation: string }>();
      expect(body.offDay).toBe('Rotational');
      expect(body.prevEmployer).toBe('Ansal Housing');
      expect(body.probation).toBe('6 months');
    } finally {
      await db.kyc.deleteMany({ where: { personId: NEW_ID } });
      await db.person.deleteMany({ where: { id: NEW_ID } });
    }
  });

  it('refuses the whole enrolment when the Aadhaar cannot be right', async () => {
    const office = await db.office.findFirst();
    const company = await db.company.findFirst();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/people',
      headers: auth(token),
      payload: {
        id: NEW_ID,
        name: 'A Test Joiner',
        designation: 'Rider',
        dept: 'Admin',
        type: 'Staff',
        joined: '01 Oct 2026',
        office: office!.id,
        employer: company!.id,
        kyc: { aadhaar: '2767 8628 6749', pan: '', address: '' },
      },
    });
    expect(res.statusCode).toBe(400);
    // And nobody was half-created on the way out.
    expect(await db.person.findUnique({ where: { id: NEW_ID } })).toBeNull();
  });
});
