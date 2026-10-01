/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * MATCHING A SHEET'S HEADINGS TO THE FIELDS BEHIND THEM.
 *
 * Every test here is a heading somebody has actually written, or a way the
 * matching went wrong on one. A column matched to the wrong field is worse
 * than a column matched to nothing: nothing is at least visible as a blank.
 */

import { describe, expect, it } from 'vitest';
import { INTAKE_FIELDS, matchColumns } from './intake.js';

const map = (...h: string[]) => matchColumns(h);

describe('reading a sheet’s headings', () => {
  it('takes the headings the company actually writes', () => {
    const m = map(
      'Employee Name', 'Designation', 'Department', 'Site', 'DOJ',
      'Personal Mobile', 'Personal Email', 'Basic', 'HRA', 'Special',
    );
    expect(m.name).toBe(0);
    expect(m.desig).toBe(1);
    expect(m.dept).toBe(2);
    expect(m.office).toBe(3);
    expect(m.joined).toBe(4);
    expect(m.phone).toBe(5);
    expect(m.email).toBe(6);
    expect(m.basic).toBe(7);
    expect(m.hra).toBe(8);
    expect(m.special).toBe(9);
  });

  it('does not let a short alias steal a longer heading', () => {
    /* THE BUG THIS EXISTS FOR. The matcher took the first field with an alias
       the heading CONTAINED. "PF Wage Ceiling" contains "pf", so it matched
       the P.F.-applies field — which "PF Enabled" had already taken — and the
       column was claimed by nothing and silently dropped. */
    const m = map('PF Enabled', 'PF Wage Ceiling', 'ESI Enabled');
    expect(m.pfOn).toBe(0);
    expect(m.pfWages).toBe(1);
    expect(m.esiOn).toBe(2);
  });

  it('prefers the exact heading over one that merely contains it', () => {
    // "Personal Email" and "Work Email" both contain "email".
    const m = map('Personal Email', 'Work Email');
    expect(m.email).toBe(0);
    expect(m.workEmail).toBe(1);
    // And in the other order, which is where a first-wins matcher gives up.
    const n = map('Work Email', 'Personal Email');
    expect(n.workEmail).toBe(0);
    expect(n.email).toBe(1);
  });

  it('tells a personal mobile from the company SIM', () => {
    const m = map('Personal Mobile', 'Company Number');
    expect(m.phone).toBe(0);
    expect(m.sim).toBe(1);
    const n = map('Work Phone', 'Mobile No');
    expect(n.sim).toBe(0);
    expect(n.phone).toBe(1);
  });

  it('reads a heading nobody spelt the same way twice', () => {
    expect(map('emp name').name).toBe(0);
    expect(map('Date of Joining').joined).toBe(0);
    expect(map('Aadhar No').aadhaar).toBe(0);
    expect(map('PAN Card').pan).toBe(0);
    expect(map('Travelling Allowance').travel).toBe(0);
    expect(map('Official Email').workEmail).toBe(0);
  });

  it('claims a column once, and leaves the rest alone', () => {
    const m = map('Name', 'Name Again', 'TDS After Four Months');
    expect(m.name).toBe(0);
    // Nothing reads a second name column, and nothing reads a TDS schedule —
    // the system has no such idea. Both stay unclaimed rather than being
    // force-fitted to a field that happens to share a word.
    expect(Object.values(m)).not.toContain(2);
  });

  it('never maps two fields to the same column', () => {
    const m = map(
      'Employee Name', 'Designation', 'Department', 'Site', 'DOJ', 'Personal Mobile',
      'Personal Email', 'Work Email', 'Company Number', 'PAN', 'Aadhaar', 'Monthly Gross',
      'Basic', 'HRA', 'Travelling', 'Medical', 'Special', 'PF Enabled', 'PF Wage Ceiling',
      'ESI Enabled', 'Device IMEI',
    );
    const used = Object.values(m);
    expect(new Set(used).size, 'one column, one field').toBe(used.length);
    // And every one of those headings found a home.
    expect(used).toHaveLength(21);
  });

  it('survives an empty heading', () => {
    expect(() => map('', '   ', 'Employee Name')).not.toThrow();
    expect(map('', 'Employee Name').name).toBe(1);
  });
});

describe('what the sheet does not carry', () => {
  it('leaves a heading the system has no idea for unclaimed', () => {
    /* PF Percent and ESI Percent are the dangerous pair: they are company
       policy, not facts about a person, and a rate of 12 read into the yes/no
       field would switch somebody's provident fund on with a number that meant
       something else. They must match NOTHING. */
    for (const odd of ['TDS First Four Months', 'PF Percent', 'ESI Percent', 'Blood Group']) {
      const m = map(odd);
      expect(Object.keys(m), odd).toHaveLength(0);
    }
  });

  it('every field has at least one alias, and none is blank', () => {
    for (const f of INTAKE_FIELDS) {
      expect(f.aliases.length, f.k).toBeGreaterThan(0);
      for (const a of f.aliases) expect(a.trim(), f.k).toBe(a);
    }
  });
});
