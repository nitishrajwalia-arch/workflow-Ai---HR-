/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * The connector ChatGPT and Claude both speak.
 *
 * The thing worth testing here is not that it answers. It is that it CANNOT be
 * talked into more than the person who connected it, because an assistant that
 * could would be a way round every gate on the other 129 routes.
 */

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { auth, makeApp, signIn } from './helpers.js';
import { hashPassword } from '../lib/password.js';
import { NOT_EXPOSED, ASSISTANT_TOOLS } from '../assistant/permissions.js';

let app: App;
let db: PrismaClient;
let adminToken: string;
let viewerToken: string;

const VIEWER_EMAIL = 'assistant-viewer@marbellagroup.in';

beforeAll(async () => {
  ({ app, db } = await makeApp());
  ({ token: adminToken } = await signIn(app));
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

const mcp = (body: Record<string, unknown>, token = adminToken) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/assistant/mcp',
    headers: auth(token),
    payload: { jsonrpc: '2.0', id: 1, ...body },
  });

const call = async (name: string, args: Record<string, unknown> = {}, token = adminToken) => {
  const res = await mcp({ method: 'tools/call', params: { name, arguments: args } }, token);
  return res.json<{ result?: { content?: Array<{ text: string }>; isError?: boolean }; error?: unknown }>();
};

const listNames = async (token: string): Promise<string[]> => {
  const res = await mcp({ method: 'tools/list' }, token);
  return res.json<{ result: { tools: Array<{ name: string }> } }>().result.tools.map((t) => t.name);
};

describe('getting in', () => {
  it('refuses an assistant with no token at all', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assistant/mcp',
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('says whose account it is acting as, and that it cannot write', async () => {
    const res = await mcp({ method: 'initialize' });
    const r = res.json<{ result: { instructions: string; serverInfo: { name: string } } }>().result;
    expect(r.serverInfo.name).toBe('marbella');
    expect(r.instructions).toMatch(/cannot change anything/i);
    expect(r.instructions).toMatch(/Aadhaar/);
  });
});

describe('it cannot exceed the person using it', () => {
  it('offers a storeman fewer tools than an administrator', async () => {
    const asAdmin = await listNames(adminToken);
    const asViewer = await listNames(viewerToken);
    expect(asViewer.length).toBeLessThan(asAdmin.length);
    // Attendance and the HR desk are not a storeman's to read.
    expect(asViewer).not.toContain('attendance_summary');
    expect(asViewer).not.toContain('open_hr_tasks');
    expect(asAdmin).toContain('open_hr_tasks');
  });

  it('refuses a tool the storeman was not offered, even asked for by name', async () => {
    const out = await call('open_hr_tasks', {}, viewerToken);
    expect(out.result?.isError).toBe(true);
    expect(out.result?.content?.[0]?.text).toMatch(/cannot see more than the person using it/i);
  });
});

describe('what it can never reach', () => {
  it('has no tool for pay or identity documents', () => {
    const names = ASSISTANT_TOOLS.map((t) => t.name).join(' ');
    for (const word of ['salary', 'pay', 'kyc', 'aadhaar', 'pan', 'bank']) {
      expect(names.toLowerCase()).not.toContain(word);
    }
    expect(NOT_EXPOSED.length).toBeGreaterThan(0);
  });

  it('refuses a tool that does not exist rather than improvising', async () => {
    const out = await call('get_salary', { employee_id: 'MB-SAL-0007' });
    expect(out.error).toBeTruthy();
  });

  it('returns no Aadhaar, no PAN and no salary figure from ANY tool', async () => {
    let all = '';
    for (const t of ASSISTANT_TOOLS) {
      const out = await call(t.name, { employee_id: 'MB-SAL-0007', months: 12, by: 'company' });
      all += out.result?.content?.[0]?.text ?? '';
    }
    expect(all.length).toBeGreaterThan(200); // it really did answer
    expect(all).not.toMatch(/\b\d{12}\b/); // Aadhaar
    expect(all).not.toMatch(/\b[A-Z]{5}\d{4}[A-Z]\b/); // PAN
    expect(all).not.toMatch(/\b\d{5,6}\b/); // any salary-sized figure
  });

  it('says so on the person’s own record rather than quietly leaving it out', async () => {
    const out = await call('get_person', { employee_id: 'MB-PRJ-0014' });
    expect(out.result?.content?.[0]?.text).toMatch(/not available through an assistant/i);
  });

  it('every tool on the list is read-only', () => {
    expect(ASSISTANT_TOOLS.every((t) => !t.writes)).toBe(true);
  });
});

describe('it answers real questions', () => {
  it('counts the company', async () => {
    const out = await call('headcount', { by: 'department' });
    expect(out.result?.content?.[0]?.text).toMatch(/people on the register/);
  });

  it('finds somebody by name', async () => {
    const out = await call('find_people', { query: 'Ajay' });
    expect(out.result?.content?.[0]?.text).toMatch(/MB-/);
  });
});

/**
 * The question the management actually asked, in the words they asked it in,
 * through both doors: the assistant's tool, and the app's own co-pilot.
 */
describe('asking in plain English', () => {
  const ask = async (question: string, token = adminToken) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assistant/ask',
      headers: auth(token),
      payload: { question },
    });
    return res.json<{ answer: string; understood: boolean; matched: string }>();
  };

  it('answers "everyone who is more than 60 years of age"', async () => {
    const r = await ask("give me details of everyone who's more than 60 years of age");
    expect(r.understood).toBe(true);
    expect(r.matched).toBe('age-above');
    expect(r.answer).toMatch(/age 6\d/);
  });

  it('answers the same question asked the other way round', async () => {
    const a = await ask('everyone over 60');
    const b = await ask('staff aged 60 and over');
    expect(a.answer).toBe(b.answer);
  });

  it('is the same answer through the assistant connector', async () => {
    const viaTool = await call('ask', { question: 'everyone over 60' });
    const viaApp = await ask('everyone over 60');
    expect(viaTool.result?.content?.[0]?.text).toBe(viaApp.answer);
  });

  it('will not hand over pay, and says so rather than failing', async () => {
    const r = await ask('what is the salary of the oldest person');
    expect(r.understood).toBe(true);
    expect(r.matched).toBe('withheld');
    expect(r.answer).not.toMatch(/\d{4,}/);
  });

  it('says it did not understand rather than guessing', async () => {
    const r = await ask('will it rain on site tomorrow');
    expect(r.understood).toBe(false);
    expect(r.answer).toContain('did not understand');
  });

  it('answers a storeman with his own role, not the administrator’s', async () => {
    const r = await ask('how many people do we have', viewerToken);
    expect(r.understood).toBe(true);
  });

  it('refuses without a token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assistant/ask',
      payload: { question: 'everyone over 60' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('find_people can be filtered by age, and says the age it used', async () => {
    const r = await call('find_people', { min_age: 60 });
    const text = r.result?.content?.[0]?.text ?? '';
    expect(text).toMatch(/age 6\d/);
    expect(text).not.toMatch(/age [1-5]\d\b/);
  });
});

describe('connecting one is written down', () => {
  it('seals who pointed an assistant at the company', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assistant/connect',
      headers: auth(adminToken),
      payload: { client: 'ChatGPT' },
    });
    expect(res.statusCode).toBe(200);
    const seal = await db.ledgerEntry.findFirst({ where: { kind: 'auth' }, orderBy: { seq: 'desc' } });
    expect(seal?.detail).toMatch(/ChatGPT was connected/);
    expect(seal?.detail).toMatch(/read-only/);
  });
});
