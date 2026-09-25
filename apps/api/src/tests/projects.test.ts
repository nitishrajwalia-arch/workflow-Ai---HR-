/**
 * Projects, and the site office that makes one usable.
 *
 * A person is posted to an OFFICE. A project without one accepts nobody, and
 * does it silently: the project appears in every list, the headcount reads zero
 * for ever, and nothing says why. So creating a project creates its site office,
 * and this is the test that says so.
 */

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { auth, makeApp, signIn } from './helpers.js';

let app: App;
let db: PrismaClient;
let token: string;

beforeAll(async () => {
  ({ app, db } = await makeApp());
  ({ token } = await signIn(app));
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

const put = (id: string, body: Record<string, unknown>) =>
  app.inject({ method: 'PUT', url: `/api/v1/projects/${id}`, headers: auth(token), payload: body });

describe('a new project', () => {
  it('comes with a site office, so somebody can be posted to it', async () => {
    const res = await put('testsite', {
      name: 'Marbella Test Site',
      short: 'Test Site',
      company: 'srg',
      reraStatus: 'notyet',
      rera: '',
      stage: 'pre',
      addr: '',
    });
    expect(res.statusCode, res.body).toBe(200);

    const office = await db.office.findFirst({ where: { projectId: 'testsite' } });
    expect(office, 'a project with no office accepts nobody, silently').toBeTruthy();
    expect(office?.short).toBe('Test Site');

    // And the office is real enough to post somebody to.
    const person = await app.inject({
      method: 'POST',
      url: '/api/v1/people',
      headers: auth(token),
      payload: {
        name: 'Test Posting',
        designation: 'Site Engineer',
        dept: 'Project',
        type: 'Staff',
        joined: '01 Oct 2026',
        office: office!.id,
        employer: 'srg',
        reportsTo: null,
      },
    });
    expect(person.statusCode, person.body).toBe(201);
    const { id } = person.json<{ id: string }>();
    await db.person.delete({ where: { id } });
    await db.office.delete({ where: { id: office!.id } });
    await db.project.delete({ where: { id: 'testsite' } });
  });

  it('does not take the office away when the project is edited again', async () => {
    await put('testsite2', {
      name: 'Second Test Site',
      short: 'Second',
      company: 'srg',
      reraStatus: 'notyet',
      rera: '',
      stage: 'pre',
      addr: '',
    });
    const first = await db.office.findFirst({ where: { projectId: 'testsite2' } });
    await put('testsite2', {
      name: 'Second Test Site',
      short: 'Second',
      company: 'srg',
      reraStatus: 'notyet',
      rera: '',
      stage: 'construction',
      addr: 'Sector 82',
    });
    const offices = await db.office.findMany({ where: { projectId: 'testsite2' } });
    expect(offices).toHaveLength(1);
    expect(offices[0]?.id).toBe(first?.id);
    await db.office.delete({ where: { id: first!.id } });
    await db.project.delete({ where: { id: 'testsite2' } });
  });
});

describe('the projects the company has', () => {
  it('gives every one of them a site office', async () => {
    const projects = await db.project.findMany();
    const offices = await db.office.findMany();
    const without = projects.filter((p) => !offices.some((o) => o.projectId === p.id));
    expect(
      without.map((p) => p.name),
      'projects nobody can be posted to',
    ).toHaveLength(0);
  });

  it('carries Marbella Manifest, with the assumed company flagged', async () => {
    // Added because the management asked for it. It is not in the employee
    // register — nobody is posted there yet — so it cannot come from the
    // generated data, and which entity signs for it is an assumption.
    const p = await db.project.findUnique({ where: { id: 'manifest' } });
    expect(p?.name).toBe('Marbella Manifest');
    const task = await db.hrTask.findFirst({ where: { text: { contains: 'Marbella Manifest' } } });
    expect(task, 'the assumed company is raised as a question, not buried').toBeTruthy();
    expect(task?.text).toContain('nobody has said which company signs for it');
  });

  it('tells the browser which project each site belongs to', async () => {
    // Without it the browser has to assume the two ids are spelled the same,
    // which is true of the four sites the company started with and of nothing
    // added since.
    const res = await app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: auth(token) });
    const { offices } = res.json<{ offices: Array<{ id: string; project: string | null }> }>();
    expect(offices.length).toBeGreaterThan(0);
    for (const o of offices) expect(o, `${o.id} has no project`).toHaveProperty('project');
    expect(offices.find((o) => o.id === 'manifest')?.project).toBe('manifest');
  });
});
