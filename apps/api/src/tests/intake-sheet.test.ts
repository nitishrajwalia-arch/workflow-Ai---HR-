/**
 * The master sheet, and the reader that takes it.
 *
 * HR is handed one workbook and asked to fill it in. Three things then have to
 * agree: the column names in the workbook, the matcher that maps them onto
 * fields, and the importer that validates the rows. This test holds all three
 * together by reading THE FILE WE ACTUALLY HAND OUT and pushing it through the
 * real import endpoint — so a column renamed in one place fails here rather
 * than on somebody's Monday morning.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  INTAKE_FIELDS,
  INTAKE_UPDATE_FIELDS,
  matchColumns,
  readXlsx,
  xlsxToSheet,
} from '@marbella/shared';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { auth, makeApp, signIn } from './helpers.js';

let app: App;
let db: PrismaClient;
let token: string;

// Resolved from this file, not from the working directory: the suite is run
// from the repository root and from apps/api, and both have to find the same
// workbook — the one the company is actually handed.
const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const MASTER = here('../../../../docs/Marbella-Bulk-Intake-Master.xlsx');
const FILLED = here('./fixtures/filled-intake.xlsx');
const bytes = (p: string): Uint8Array => new Uint8Array(readFileSync(p));

beforeAll(async () => {
  ({ app, db } = await makeApp());
  ({ token } = await signIn(app));
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe('the master sheet', () => {
  it('has a tab for each job, and no example rows on either', async () => {
    const add = await readXlsx(bytes(MASTER), 'New people');
    const fill = await readXlsx(bytes(MASTER), 'Fill in blanks');
    // A note row, a header row, and nothing else. A sample row of invented
    // employees is exactly the thing that gets uploaded by accident.
    expect(add).toHaveLength(2);
    expect(fill).toHaveLength(2);
  });

  it('carries a column for every field the importer reads', async () => {
    const header = (await readXlsx(bytes(MASTER), 'New people'))[1] as string[];
    const matched = matchColumns(header, INTAKE_FIELDS);
    const missing = INTAKE_FIELDS.filter((f) => matched[f.k] === undefined).map((f) => f.label);
    expect(missing, `not on the sheet: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('carries every fill-in-blanks field except pay, which is left off on purpose', async () => {
    const header = (await readXlsx(bytes(MASTER), 'Fill in blanks'))[1] as string[];
    const matched = matchColumns(header, INTAKE_UPDATE_FIELDS);
    const missing = INTAKE_UPDATE_FIELDS.filter((f) => matched[f.k] === undefined).map((f) => f.k);
    // The importer will take Basic, HRA and Other Allowances for somebody
    // already on the roster. The sheet does not offer them, because changing a
    // hundred people's pay by pasting three columns is where a wrong figure
    // reaches a hundred payslips at once. Salary is set on the person, one
    // figure, and the company's policy splits it. This is a decision, so it is
    // asserted rather than left to whoever next opens the workbook.
    expect(missing.sort()).toEqual(['basic', 'hra', 'special']);
  });

  it('matches every required column to the right one, not a neighbour', async () => {
    const header = (await readXlsx(bytes(MASTER), 'New people'))[1] as string[];
    const m = matchColumns(header, INTAKE_FIELDS);
    expect(header[m.name as number]).toBe('Employee Name');
    expect(header[m.desig as number]).toBe('Designation');
    expect(header[m.dept as number]).toBe('Department');
    expect(header[m.joined as number]).toBe('Date of Joining');
    expect(header[m.dob as number]).toBe('Date of Birth');
    // The two numbers on the sheet are easy to cross: one is theirs, one is the
    // company's, and a sheet that swaps them puts a company SIM in a private
    // contacts table.
    expect(header[m.phone as number]).toBe('Personal Mobile');
    expect(header[m.sim as number]).toBe('Official Number');
    expect(header[m.office as number]).toBe('Site');
  });

  it('lists the real departments and sites for the dropdowns', async () => {
    const lists = await readXlsx(bytes(MASTER), 'Lists');
    const flat = lists.flat();
    const depts = await db.person.findMany({ select: { dept: true }, distinct: ['dept'] });
    for (const { dept } of depts) expect(flat, `${dept} is not on the Lists tab`).toContain(dept);
    for (const o of await db.office.findMany()) {
      expect(
        flat.some((v) => v.includes(o.short)),
        `${o.short} is not on the Lists tab`,
      ).toBe(true);
    }
  });
});

describe('a filled sheet, uploaded', () => {
  it('reads back what somebody typed, including the awkward cells', async () => {
    const rows = await readXlsx(bytes(FILLED), 'New people');
    const body = rows.slice(2);
    expect(body).toHaveLength(3);
    // A comma inside a name — the thing that breaks a CSV round-trip.
    expect(body[1]?.[0]).toBe('Kaur, Simran');
    // A cell entered as a real Excel date comes back as words, the same as one
    // typed as words. Otherwise the same sheet imports two different ways.
    expect(body[1]?.[5]).toBe('01 Oct 2026');
    expect(body[0]?.[5]).toBe('12 Aug 2026');
    // A number typed as a number is not "15000.0".
    expect(body[1]?.[10]).toBe('15000');
    // A typographic apostrophe survives the XML.
    expect(body[2]?.[0]).toContain('’');
  });

  it('comes out as a sheet the paste reader already understands', async () => {
    const text = await xlsxToSheet(bytes(FILLED), 'New people');
    expect(text.split('\n')).toHaveLength(5);
    expect(text).toContain('\t');
    // Tabs and newlines inside a cell would make one row look like two.
    for (const line of text.split('\n')) expect(line.split('\t').length).toBe(15);
  });

  it('is accepted by the importer, row by row, without writing anything', async () => {
    const rows = await readXlsx(bytes(FILLED), 'New people');
    const header = rows[1] as string[];
    const m = matchColumns(header, INTAKE_FIELDS);
    const payload = rows.slice(2).map((r) => {
      const rec: Record<string, string> = {};
      for (const f of INTAKE_FIELDS) {
        const at = m[f.k];
        if (at !== undefined && r[at]) rec[f.k] = r[at];
      }
      return rec;
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/people',
      headers: auth(token),
      payload: { rows: payload, commit: false },
    });
    expect(res.statusCode, res.body).toBe(200);
    const out = res.json<{
      accepted: Array<{ name: string }>;
      rejected: Array<{ name: string; reason: string }>;
      committed: boolean;
    }>();
    expect(out.committed).toBe(false);
    expect(
      out.rejected.map((x) => `${x.name}: ${x.reason}`).join(' | '),
      'every row on the filled sheet should be accepted',
    ).toBe('');
    expect(out.accepted).toHaveLength(3);
  });

  it('refuses a workbook that is not one', async () => {
    await expect(readXlsx(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/not a workbook/i);
  });

  it('says which tab is missing rather than reading the wrong one', async () => {
    await expect(readXlsx(bytes(MASTER), 'Payroll')).rejects.toThrow(/no sheet called/i);
  });
});
