/**
 * The row that slipped, and what stops it landing.
 *
 * HR was asked to remove a duplicate person. They deleted the ROW, which is what
 * anybody would do — and in Excel that pulls every row below it up by one while
 * the employee ID column stays where it is. Three people in Maintenance ended up
 * sitting on the ID above their own. Read one row at a time it looks like three
 * ordinary name corrections. Applied, it would have moved the Maintenance
 * Manager off MB-MNT-0019 and put the gym trainer there, and nineteen people
 * report to MB-MNT-0019.
 *
 * `scripts/import/05-gaps.py` refuses a chain like that per file and leaves the
 * earlier revision's answers standing. These are the facts that has to keep
 * true; they are asserted against the seeded database, which is where the
 * consequence would actually show.
 */

import type { PrismaClient } from '@prisma/client';
import { GAP_CONFLICTS, GAP_PEOPLE } from '../../prisma/real-gaps.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeApp } from './helpers.js';

let db: PrismaClient;
let close: () => Promise<void>;

beforeAll(async () => {
  const made = await makeApp();
  db = made.db;
  close = () => made.app.close();
});

afterAll(async () => {
  await close();
  await db.$disconnect();
});

describe('the slipped Maintenance block', () => {
  it('left every employee ID on the person it belongs to', async () => {
    const tail = await db.person.findMany({
      where: { id: { in: ['MB-MNT-0015', 'MB-MNT-0017', 'MB-MNT-0018', 'MB-MNT-0019', 'MB-MNT-0020'] } },
      select: { id: true, name: true, designation: true },
      orderBy: { id: 'asc' },
    });
    expect(tail).toEqual([
      { id: 'MB-MNT-0015', name: 'Rahul Kumar Verma', designation: 'Plunber' },
      { id: 'MB-MNT-0017', name: 'Rahul Kumar', designation: 'Plumber' },
      { id: 'MB-MNT-0018', name: 'Vinod Kumar', designation: 'Civil Supervisor' },
      { id: 'MB-MNT-0019', name: 'Amandeep Singh', designation: 'Maintainance Manager' },
      { id: 'MB-MNT-0020', name: 'Arjun', designation: 'Gym Trainer' },
    ]);
  });

  it('kept the department reporting to its manager, not to the gym trainer', async () => {
    const head = await db.person.findUniqueOrThrow({ where: { id: 'MB-MNT-0019' } });
    expect(head.designation).toBe('Maintainance Manager');
    const under = await db.person.count({ where: { reportsToId: 'MB-MNT-0019' } });
    expect(under).toBeGreaterThan(15);
  });

  it('says loudly why it refused, rather than dropping the rows quietly', () => {
    const said = GAP_CONFLICTS.find((c) => c.includes('SLIPPED BY A ROW'));
    expect(said).toBeTruthy();
    expect(said).toContain('MB-MNT-0019');
    // And it tells whoever reads it how to do it without the slip.
    expect(said).toMatch(/CONTENTS of the row/i);
  });

  it('kept the earlier revision’s answers for the rows it refused', () => {
    // The refusal costs the file that slipped, not the person. All three still
    // carry the gender and reporting line the first revision supplied.
    for (const id of ['MB-MNT-0017', 'MB-MNT-0018', 'MB-MNT-0019']) {
      const g = GAP_PEOPLE.find((p) => p.id === id);
      expect(g, `${id} lost its answers`).toBeTruthy();
      expect(g!.gender).toBeTruthy();
    }
  });
});

describe('what the newer revision did land', () => {
  it('took the corrected mobile, so two people no longer share one', async () => {
    const khushi = await db.contact.findUniqueOrThrow({ where: { personId: 'MB-CRM-0004' } });
    const kiran = await db.contact.findUniqueOrThrow({ where: { personId: 'MB-CRM-0001' } });
    expect(khushi.phone).not.toBe(kiran.phone);
  });

  it('treats "Not Given" as an answer that clears the field, not as a blank cell', async () => {
    // An EMPTY cell means "not answered" and must leave what is on file alone.
    // "Not Given" is HR saying there is no address. Collapsing the two meant a
    // later revision could add an email but never remove a wrong one — and this
    // one was wrong: two people in different departments shared it.
    const manoj = await db.contact.findUniqueOrThrow({ where: { personId: 'MB-MNT-0003' } });
    expect(manoj.email).toBe('');
    const other = await db.contact.findUniqueOrThrow({ where: { personId: 'MB-PUR-0003' } });
    expect(other.email).toBeTruthy();
  });

  it('took a correction to a column the sheet only asked HR to check', async () => {
    // The date of birth sits in a white column — already on file, check it as
    // you go. The importer read only the cream ones, so this correction was
    // being thrown away every run.
    const p = await db.person.findUniqueOrThrow({ where: { id: 'MB-PRJ-0017' } });
    expect(p.dob).toBe('10 Jan 1990');
    expect(p.dobOn?.toISOString().slice(0, 10)).toBe('1990-01-10');
  });

  it('kept the closure answer HR wrote instead of forcing it back to yes or no', async () => {
    const holidays = await db.holiday.findMany({ orderBy: { onDate: 'asc' } });
    const closing = holidays.filter((h) => h.allSites);
    expect(closing.length).toBeGreaterThan(0);
    expect(closing.length).toBeLessThan(holidays.length);
    // The sentence says who stays on site. That is the part somebody needs.
    expect(closing[0]!.closure).toMatch(/rotational/i);
  });
});
