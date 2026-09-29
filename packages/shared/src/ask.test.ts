/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * The co-pilot is only worth having if it answers the question that was asked.
 *
 * These are the sentences people actually type, in the shapes they type them —
 * including the one that started it: "details of everyone who's more than 60
 * years of age".
 */

import { describe, expect, it } from 'vitest';
import { ask, type AskPerson, type AskWorld } from './ask.js';

const ON = new Date('2026-09-29T00:00:00Z');

const p = (over: Partial<AskPerson> & Pick<AskPerson, 'id' | 'name'>): AskPerson => ({
  designation: 'Supervisor',
  dept: 'Project',
  type: 'Site',
  status: 'active',
  joined: '01 Jan 2020',
  dob: '01 Jan 1990',
  site: 'Grand Iva',
  employer: 'SRG Developers',
  offDay: 'Sunday',
  reportsTo: null,
  ...over,
});

const WORLD: AskWorld = {
  asOf: ON,
  people: [
    p({ id: 'MB-PRJ-0023', name: 'Avtar Singh', designation: 'Labour Colony Manager', dob: '02 Jan 1962', reportsTo: 'Ajay Goel' }),
    p({ id: 'MB-PRJ-0014', name: 'Ajay Goel', designation: 'Project Head', dob: '16 Sep 1965' }),
    p({ id: 'MB-MNT-0010', name: 'Parmjeet Singh', designation: 'Carpenter', dept: 'Maintenance', dob: '01 Jan 1967' }),
    p({ id: 'MB-ACC-0001', name: 'Sonu Jangdha', designation: 'Accountant', dept: 'Accounts', dob: '10 Oct 1998', offDay: 'Saturday' }),
    p({ id: 'MB-PRJ-0002', name: 'Ramesh Kumar', dob: '', joined: '15 Aug 2015', reportsTo: 'Ajay Goel' }),
    p({ id: 'MB-HR-0001', name: 'Pooja Dahiya', designation: 'HR Manager', dept: 'HR', dob: '03 Oct 1996', status: 'left' }),
  ],
};

describe('asking about age', () => {
  const overSixty = [
    "give me details of everyone who's more than 60 years of age",
    'everyone over 60',
    'staff above 60 years',
    'who is older than 60',
    'people aged 60 and over',
  ];

  for (const q of overSixty) {
    it(`reads "${q}"`, () => {
      const r = ask(q, WORLD);
      expect(r.understood).toBe(true);
      expect(r.matched).toBe('age-above');
      expect(r.answer).toContain('Avtar Singh');
      expect(r.answer).toContain('Ajay Goel');
      expect(r.answer).not.toContain('Parmjeet');
    });
  }

  it('counts in completed years, not calendar years', () => {
    // Born 16 Sep 1965, asked on 29 Sep 2026 — his birthday has been and gone.
    expect(ask('over 60', WORLD).answer).toContain('age 61');
  });

  it('says how many people it could not age', () => {
    const r = ask('everyone over 60', WORLD);
    expect(r.answer).toContain('no usable date of birth');
  });

  it('leaves out people who have left', () => {
    expect(ask('under 40', WORLD).answer).not.toContain('Pooja Dahiya');
  });

  it('answers under, too', () => {
    const r = ask('who is younger than 30', WORLD);
    expect(r.matched).toBe('age-below');
    expect(r.answer).toContain('Sonu Jangdha');
    expect(r.answer).not.toContain('Avtar Singh');
  });

  it('answers a band', () => {
    const r = ask('anyone aged between 55 and 62', WORLD);
    expect(r.matched).toBe('age-between');
    expect(r.answer).toContain('Ajay Goel');
    expect(r.answer).toContain('Parmjeet Singh');
    expect(r.answer).not.toContain('Avtar Singh');
  });

  it('finds the oldest and the youngest', () => {
    expect(ask('who is the oldest person', WORLD).answer).toContain('Avtar Singh');
    expect(ask('who is the youngest', WORLD).answer).toContain('Sonu Jangdha');
  });
});

describe('the other things people ask', () => {
  it('counts a department', () => {
    expect(ask('how many people in Maintenance?', WORLD).answer).toBe('1 active person in Maintenance.');
  });

  it('counts everybody by department', () => {
    const r = ask('how many people do we have', WORLD);
    expect(r.answer).toContain('5 people on the rolls');
    expect(r.answer).toContain('Project: 3');
  });

  it('reads the chart downward', () => {
    const r = ask('who reports to Ajay Goel', WORLD);
    expect(r.matched).toBe('reports-down');
    expect(r.answer).toContain('Avtar Singh');
    expect(r.answer).toContain('Ramesh Kumar');
  });

  it('reads the chart upward', () => {
    const r = ask('who does Avtar Singh report to', WORLD);
    expect(r.matched).toBe('reports-up');
    expect(r.answer).toContain('Ajay Goel');
  });

  it('gives one person their own record', () => {
    const r = ask('details of Avtar Singh', WORLD);
    expect(r.matched).toBe('person');
    expect(r.answer).toContain('Labour Colony Manager');
    expect(r.answer).toContain('age 64');
  });

  it('lists a department', () => {
    expect(ask('show me accounts', WORLD).answer).toContain('Sonu Jangdha');
  });

  it('knows who is off on a day', () => {
    const r = ask('who is off on Saturday', WORLD);
    expect(r.answer).toContain('Sonu Jangdha');
    expect(r.answer).not.toContain('Avtar Singh');
  });

  it('lists the longest serving', () => {
    expect(ask('who has been here the longest', WORLD).answer).toContain('Ramesh Kumar');
  });
});

describe('what it will not do', () => {
  for (const q of ['what is avtar singh salary', 'give me his aadhaar', 'what is the PAN of Ajay Goel', 'his home address please']) {
    it(`refuses plainly: "${q}"`, () => {
      const r = ask(q, WORLD);
      expect(r.understood).toBe(true);
      expect(r.matched).toBe('withheld');
      expect(r.answer).toContain('not available through the assistant');
      expect(r.answer).not.toMatch(/\d{4}\s?\d{4}\s?\d{4}/);
    });
  }

  it('says so when it cannot read the question, and offers what it can', () => {
    const r = ask('what is the weather doing on site tomorrow', WORLD);
    expect(r.understood).toBe(false);
    expect(r.answer).toContain('did not understand');
    expect(r.answer).toContain('Everyone over 60 years of age');
  });

  it('asks which person rather than guessing between two', () => {
    const two: AskWorld = {
      asOf: ON,
      people: [p({ id: 'MB-PRJ-0101', name: 'Ravi Kumar' }), p({ id: 'MB-PRJ-0102', name: 'Ravi Sharma' })],
    };
    const r = ask('who does Ravi report to', two);
    expect(r.understood).toBe(false);
    expect(r.answer).toContain('Which person');
  });

  it('never invents an answer for an empty question', () => {
    expect(ask('   ', WORLD).understood).toBe(false);
  });
});

/* ------------------------------------------------------------ attendance */

describe('asking about attendance', () => {
  const ATT = {
    ...WORLD,
    attendance: [
      // Deepak was there every working day and worked his Sundays too.
      { pid: 'MB-PRJ-0023', month: 'Jun 2026', monthDays: 30, present: 30, absent: 0, weekOff: 0, holiday: 0 },
      // Kushal took one Sunday and missed nothing else. Still a clean month.
      { pid: 'MB-PRJ-0014', month: 'Jun 2026', monthDays: 30, present: 29, absent: 0, weekOff: 1, holiday: 0 },
      { pid: 'MB-MNT-0010', month: 'Jun 2026', monthDays: 30, present: 22, absent: 6, weekOff: 2, holiday: 0 },
      { pid: 'MB-ACC-0001', month: 'Jun 2026', monthDays: 30, present: 27, absent: 1, weekOff: 2, holiday: 0 },
    ],
  };

  for (const q of [
    'who has full attendance',
    'people with perfect attendance',
    'who was present every day',
    'anybody with a clean month',
  ]) {
    it(`reads "${q}"`, () => {
      const r = ask(q, ATT);
      expect(r.understood).toBe(true);
      expect(r.matched).toBe('attendance-full');
      expect(r.answer).toContain('Avtar Singh');
      expect(r.answer).toContain('Ajay Goel');
      expect(r.answer).not.toContain('Parmjeet');
    });
  }

  it('counts a weekly off as an off day, not an absence', () => {
    // Kushal's stand-in took one Sunday. A count that called that an absence
    // would disagree with the payslip he was paid on.
    const r = ask('who has full attendance', ATT);
    expect(r.answer).toContain('weekly off, not an absence');
  });

  it('says how many people it could actually see', () => {
    const r = ask('who has full attendance', ATT);
    // Five active people in the world, four on the machine.
    expect(r.answer).toContain('4 people the machine covers');
    expect(r.answer).toContain('not on it, so nothing is claimed about them');
  });

  it('answers the other way round too', () => {
    const r = ask('who was absent the most', ATT);
    expect(r.matched).toBe('attendance-absent');
    expect(r.answer).toContain('6 days absent');
    expect(r.answer).toContain('Parmjeet Singh');
  });

  it('says nobody rather than inventing a name', () => {
    const none = {
      ...WORLD,
      attendance: [
        { pid: 'MB-PRJ-0023', month: 'Jun 2026', monthDays: 30, present: 25, absent: 3, weekOff: 2, holiday: 0 },
      ],
    };
    expect(ask('who has full attendance', none).answer).toContain('Nobody had a clean month');
  });

  it('refuses to answer when nothing has been loaded', () => {
    const r = ask('who has full attendance', WORLD);
    expect(r.matched).toBe('attendance-none');
    expect(r.answer).toContain('No attendance has been loaded yet');
    // The trap: "nobody was absent" is a lie when nobody was counted.
    expect(r.answer).not.toMatch(/nobody was absent/i);
  });
});
