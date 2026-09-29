/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * ASKING IN PLAIN ENGLISH.
 *
 * "Give me details of everyone who's more than 60 years of age" is how people
 * actually ask. This file turns a sentence like that into an answer off the
 * staff register, and it runs in three places from this one copy:
 *
 *   · the co-pilot inside the app, for whoever is signed in;
 *   · the same co-pilot in the shareable preview, which has no server;
 *   · the API, so ChatGPT and Claude can hand a question straight over.
 *
 * TWO RULES IT KEEPS
 *
 * 1. It never guesses. When it cannot read a question it says so and lists what
 *    it can answer, because a confident wrong answer about a colleague is worse
 *    than "I did not understand that".
 *
 * 2. It only ever sees the columns handed to it — name, post, department, site,
 *    dates. Pay, Aadhaar, PAN, addresses and personal numbers are not in the
 *    shape below, so there is no path from a question to any of them. Ask it
 *    about salary and it says plainly that it cannot, rather than failing.
 */

import { ageFromDisplayDate } from './constants.js';

/** A person as this file needs them: what a colleague may see about a colleague. */
export interface AskPerson {
  readonly id: string;
  readonly name: string;
  readonly designation: string;
  readonly dept: string;
  /** "Staff" or "Site", as the register keeps it. */
  readonly type?: string | null;
  readonly status?: string | null;
  /** Display dates, as typed on the record: "16 Mar 2024". */
  readonly joined?: string | null;
  readonly dob?: string | null;
  readonly offDay?: string | null;
  /** Readable names, already resolved by the caller. */
  readonly site?: string | null;
  readonly employer?: string | null;
  readonly reportsTo?: string | null;
}

export interface AskWorld {
  readonly people: readonly AskPerson[];
  /** Overridable so a test can pin the day. */
  readonly asOf?: Date;
}

export interface AskResult {
  /** False when the question was not understood — the answer then says what is on offer. */
  readonly understood: boolean;
  readonly answer: string;
  /** Which shape of question was read. Useful in a log, and in a test. */
  readonly matched: string;
}

/** Shown on the co-pilot when it opens, and when it cannot read a question. */
export const ASK_EXAMPLES: readonly string[] = [
  'Everyone over 60 years of age',
  'How many people in Maintenance?',
  'Who is the oldest person on the rolls?',
  'Whose birthday is coming up?',
  'Who reports to Ajay Goel?',
  'Who has been here the longest?',
];

/* ------------------------------------------------------------------ reading */

const WORD_NUMBERS: Record<string, number> = {
  eighteen: 18, twenty: 20, 'twenty five': 25, 'twenty-five': 25, thirty: 30,
  'thirty five': 35, 'thirty-five': 35, forty: 40, 'forty five': 45, 'forty-five': 45,
  fifty: 50, 'fifty five': 55, 'fifty-five': 55, sixty: 60, 'sixty five': 65,
  'sixty-five': 65, seventy: 70,
};

const normalise = (q: string): string =>
  q
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[?.!,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** A number written as digits or as a word, anywhere after `at`. */
function numberAfter(text: string, at: number): number | null {
  const rest = text.slice(at);
  const digits = rest.match(/\b(\d{1,2})\b/);
  if (digits && digits[1]) return Number(digits[1]);
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    if (rest.includes(word)) return n;
  }
  return null;
}

/** The same, looking backwards: "60 and over" puts the number first. */
function numberBefore(text: string, at: number): number | null {
  const head = text.slice(0, at);
  const digits = [...head.matchAll(/\b(\d{1,2})\b/g)].pop();
  if (digits && digits[1]) return Number(digits[1]);
  let found: number | null = null;
  let where = -1;
  for (const [word, n] of Object.entries(WORD_NUMBERS)) {
    const i = head.lastIndexOf(word);
    if (i > where) { where = i; found = n; }
  }
  return found;
}

/** Said before the number: "over 60". */
const ABOVE = ['more than', 'older than', 'over', 'above', 'greater than', 'at least'];
/** Said after it: "60 and over", "60+". */
const ABOVE_TRAILING = ['and over', 'and above', 'or above', 'or more', 'and older', 'plus', '+'];
const BELOW = ['less than', 'younger than', 'under', 'below', 'at most', 'or less'];

/* ----------------------------------------------------------------- shaping */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const active = (p: AskPerson): boolean => (p.status ?? 'active') === 'active';

/** One line about a person, with whichever extras the question was about. */
function line(p: AskPerson, extra?: string): string {
  const where = p.site ? `, ${p.site}` : '';
  return `${p.id}  ${p.name} — ${p.designation}, ${p.dept}${where}${extra ? ` · ${extra}` : ''}`;
}

/** The full record of one person, as far as this file may see it. */
function detail(p: AskPerson, on: Date): string {
  const age = ageFromDisplayDate(p.dob, on);
  return [
    `${p.name} — ${p.designation}`,
    `Employee ID: ${p.id}`,
    `Department: ${p.dept}${p.type ? ` (${p.type})` : ''}`,
    p.site ? `Posted at: ${p.site}` : null,
    p.employer ? `Employed by: ${p.employer}` : null,
    p.reportsTo ? `Reports to: ${p.reportsTo}` : null,
    p.joined ? `Joined: ${p.joined}` : null,
    p.dob ? `Date of birth: ${p.dob}${age === null ? '' : ` (age ${age})`}` : null,
    p.offDay ? `Weekly off: ${p.offDay}` : null,
    `Status: ${p.status ?? 'active'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

const listed = (rows: readonly string[], head: string): string =>
  rows.length ? `${head}\n${rows.join('\n')}` : head;

/** Everybody with a readable date of birth, oldest first. */
function byAge(people: readonly AskPerson[], on: Date): { p: AskPerson; age: number }[] {
  return people
    .filter(active)
    .map((p) => ({ p, age: ageFromDisplayDate(p.dob, on) }))
    .filter((r): r is { p: AskPerson; age: number } => r.age !== null)
    .sort((a, b) => b.age - a.age);
}

function noDob(people: readonly AskPerson[], on: Date): number {
  return people.filter(active).filter((p) => ageFromDisplayDate(p.dob, on) === null).length;
}

/** Days from today to the next time this day of the year comes round. */
function daysAway(display: string | null | undefined, on: Date): number | null {
  if (!display) return null;
  const d = new Date(`${display.trim()} 00:00:00 GMT`);
  if (Number.isNaN(d.getTime())) return null;
  const from = Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate());
  let next = Date.UTC(on.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (next < from) next = Date.UTC(on.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate());
  return Math.round((next - from) / 86_400_000);
}

const inDays = (n: number): string => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

/**
 * The department a question is about, matched against the ones that exist.
 *
 * On whole words only: the IT department is two letters, and a plain substring
 * check found it inside "will it rain on site tomorrow" and answered about the
 * IT team. The longest match wins, so "Project" beats nothing and a two-word
 * department is preferred over one of its words.
 */
function deptIn(text: string, people: readonly AskPerson[]): string | null {
  const depts = [...new Set(people.map((p) => p.dept))].filter(Boolean);
  let best: string | null = null;
  for (const d of depts) {
    const word = new RegExp(`\\b${d.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (word.test(text) && (!best || d.length > best.length)) best = d;
  }
  return best;
}

/** The person a question names, if exactly one is a clear match. */
function personIn(text: string, people: readonly AskPerson[]): AskPerson | null {
  // An Employee ID is MB-PRJ-0014 and nothing shorter. Matching on a one or two
  // character id would find "a" inside "aged" and answer about the wrong thing.
  const byId = people.find((p) => p.id.length >= 5 && text.includes(p.id.toLowerCase()));
  if (byId) return byId;
  const hits = people.filter((p) => {
    const full = p.name.toLowerCase();
    if (text.includes(full)) return true;
    const parts = full.split(/\s+/).filter((w) => w.length > 3);
    return parts.length > 1 && parts.every((w) => text.includes(w));
  });
  if (hits.length === 1) return hits[0] ?? null;
  // Two people with the same first name is not a match — asking which is right.
  return null;
}

/* ------------------------------------------------------------------ answers */

const WITHHELD =
  /\b(salary|salaries|ctc|pay|paid|payslip|wage|wages|aadhaar|aadhar|pan\b|bank|account number|address|mobile number|phone number)\b/;

/**
 * Read a question and answer it.
 *
 * Order matters: the narrow shapes are tried before the broad ones, so "who is
 * the oldest" is not swallowed by the general name search.
 */
export function ask(question: string, world: AskWorld): AskResult {
  const on = world.asOf ?? new Date();
  const all = world.people;
  const q = normalise(question);
  if (!q) {
    return { understood: false, answer: help(), matched: 'empty' };
  }

  /* 1. Things an assistant is not allowed to see. Said plainly, not fumbled. */
  if (WITHHELD.test(q)) {
    return {
      understood: true,
      matched: 'withheld',
      answer:
        'Pay, Aadhaar and PAN numbers, home addresses and personal phone numbers are ' +
        'not available through the assistant — not hidden, absent from what it can ' +
        'read at all. Those live behind the Payroll and People screens, where the ' +
        'person opening them is on the record.\n\n' +
        'Ask the management if that should change.',
    };
  }

  /* 2. Age. The question this was built for. */
  const asksAge = /\b(age|aged|years old|year old|years of age|older|younger|oldest|youngest)\b/.test(q);

  if (/\b(oldest|eldest)\b/.test(q)) {
    const rows = byAge(all, on);
    if (!rows.length) return { understood: true, matched: 'oldest', answer: 'No dates of birth are on file yet.' };
    const many = numberAfter(q, 0);
    const take = many && many > 1 && many <= 50 ? many : 1;
    const head = take === 1 ? 'The oldest person on the rolls:' : `The ${take} oldest on the rolls:`;
    return {
      understood: true,
      matched: 'oldest',
      answer: listed(rows.slice(0, take).map((r) => line(r.p, `age ${r.age}, born ${r.p.dob}`)), head),
    };
  }

  if (/\byoungest\b/.test(q)) {
    const rows = byAge(all, on).reverse();
    if (!rows.length) return { understood: true, matched: 'youngest', answer: 'No dates of birth are on file yet.' };
    const many = numberAfter(q, 0);
    const take = many && many > 1 && many <= 50 ? many : 1;
    const head = take === 1 ? 'The youngest person on the rolls:' : `The ${take} youngest on the rolls:`;
    return {
      understood: true,
      matched: 'youngest',
      answer: listed(rows.slice(0, take).map((r) => line(r.p, `age ${r.age}, born ${r.p.dob}`)), head),
    };
  }

  const between = q.match(/\bbetween (\d{1,2})\D{1,12}(\d{1,2})\b/);
  if (between && asksAge && between[1] && between[2]) {
    const lo = Math.min(Number(between[1]), Number(between[2]));
    const hi = Math.max(Number(between[1]), Number(between[2]));
    const rows = byAge(all, on).filter((r) => r.age >= lo && r.age <= hi);
    return {
      understood: true,
      matched: 'age-between',
      answer: listed(
        rows.map((r) => line(r.p, `age ${r.age}`)),
        `${rows.length} ${rows.length === 1 ? 'person is' : 'people are'} between ${lo} and ${hi}:`,
      ),
    };
  }

  const aboveAt = ABOVE.map((w) => q.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  const trailingAt = ABOVE_TRAILING.map((w) => q.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  const belowAt = BELOW.map((w) => q.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];

  if ((aboveAt !== undefined || trailingAt !== undefined) && (asksAge || /\b(60|55|50|45|40|35|30|25)\b/.test(q))) {
    // "over 60" puts the number after the word and "60 and over" puts it before,
    // and "over" appears in both — so look forwards first, then backwards.
    const n =
      (aboveAt === undefined ? null : numberAfter(q, aboveAt)) ??
      numberBefore(q, trailingAt ?? aboveAt ?? q.length);
    if (n !== null) {
      const rows = byAge(all, on).filter((r) => r.age >= n);
      const missing = noDob(all, on);
      const head = `${rows.length} ${rows.length === 1 ? 'person is' : 'people are'} ${n} or over:`;
      const tail = missing ? `\n\n(${missing} active ${missing === 1 ? 'person has' : 'people have'} no usable date of birth on file, so they are not counted.)` : '';
      return {
        understood: true,
        matched: 'age-above',
        answer:
          (rows.length
            ? `${head}\n${rows.map((r) => `${line(r.p, `age ${r.age}, born ${r.p.dob}`)}`).join('\n')}`
            : `Nobody on the rolls is ${n} or over.`) + tail,
      };
    }
  }

  if (belowAt !== undefined && asksAge) {
    const n = numberAfter(q, belowAt);
    if (n !== null) {
      const rows = byAge(all, on).filter((r) => r.age < n).reverse();
      return {
        understood: true,
        matched: 'age-below',
        answer: listed(
          rows.map((r) => line(r.p, `age ${r.age}`)),
          `${rows.length} ${rows.length === 1 ? 'person is' : 'people are'} under ${n}:`,
        ),
      };
    }
  }

  /* 3. Dates that come round: birthdays and joining anniversaries. */
  if (/\bbirthday|birthdays|born\b/.test(q)) {
    const within = /\bmonth\b/.test(q) ? 31 : /\bweek\b/.test(q) ? 7 : 60;
    const rows = all
      .filter(active)
      .map((p) => ({ p, d: daysAway(p.dob, on) }))
      .filter((r): r is { p: AskPerson; d: number } => r.d !== null && r.d <= within)
      .sort((a, b) => a.d - b.d);
    return {
      understood: true,
      matched: 'birthdays',
      answer: listed(
        rows.map((r) => line(r.p, `birthday ${inDays(r.d)}`)),
        `${rows.length} birthday${rows.length === 1 ? '' : 's'} in the next ${within} days:`,
      ),
    };
  }

  if (/\banniversar|longest|service|how long|tenure\b/.test(q)) {
    const rows = all
      .filter(active)
      .map((p) => ({ p, joined: p.joined ? new Date(`${p.joined} 00:00:00 GMT`) : null }))
      .filter((r): r is { p: AskPerson; joined: Date } => !!r.joined && !Number.isNaN(r.joined.getTime()))
      .sort((a, b) => a.joined.getTime() - b.joined.getTime());
    const named = personIn(q, all);
    if (named && /\bhow long|tenure|service\b/.test(q)) {
      const years = named.joined
        ? Math.floor((on.getTime() - new Date(`${named.joined} 00:00:00 GMT`).getTime()) / 31_557_600_000)
        : null;
      return {
        understood: true,
        matched: 'tenure',
        answer: `${named.name} joined on ${named.joined ?? 'a date not on file'}${
          years === null ? '' : ` — ${years} year${years === 1 ? '' : 's'} so far`
        }.`,
      };
    }
    const take = 10;
    return {
      understood: true,
      matched: 'longest-serving',
      answer: listed(
        rows.slice(0, take).map((r) => line(r.p, `joined ${r.p.joined}`)),
        `Longest serving, oldest joining date first (top ${Math.min(take, rows.length)} of ${rows.length}):`,
      ),
    };
  }

  /* 4. Counting. */
  if (/\bhow many|headcount|count\b/.test(q)) {
    const dept = deptIn(q, all);
    const people = all.filter(active).filter((p) => (dept ? p.dept === dept : true));
    if (dept) {
      return {
        understood: true,
        matched: 'headcount-dept',
        answer: `${people.length} active ${people.length === 1 ? 'person' : 'people'} in ${dept}.`,
      };
    }
    const tally = new Map<string, number>();
    for (const p of people) tally.set(p.dept, (tally.get(p.dept) ?? 0) + 1);
    const rows = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([d, n]) => `  ${d}: ${n}`);
    return {
      understood: true,
      matched: 'headcount',
      answer: `${people.length} people on the rolls, by department:\n${rows.join('\n')}`,
    };
  }

  /* 5. The org chart. */
  if (/\breports? to\b/.test(q)) {
    const named = personIn(q, all);
    if (!named) {
      return {
        understood: false,
        matched: 'reports-no-name',
        answer: 'Which person? Give me their name or their Employee ID and I will read it off the chart.',
      };
    }
    const reports = all.filter(active).filter((p) => p.reportsTo === named.name);
    const asksUpward = /\b(who does|whom does|who is) .*(report to)\b/.test(q);
    if (asksUpward) {
      return {
        understood: true,
        matched: 'reports-up',
        answer: `${named.name} reports to ${named.reportsTo || 'nobody recorded on the chart'}.`,
      };
    }
    return {
      understood: true,
      matched: 'reports-down',
      answer: listed(
        reports.map((p) => line(p)),
        `${reports.length} ${reports.length === 1 ? 'person reports' : 'people report'} to ${named.name}:`,
      ),
    };
  }

  /* 6. Who is off, and when. */
  const offDay = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.exec(q);
  if (offDay && /\boff\b/.test(q) && offDay[1]) {
    const day = offDay[1];
    const rows = all.filter(active).filter((p) => (p.offDay ?? '').toLowerCase() === day);
    return {
      understood: true,
      matched: 'off-day',
      answer: listed(
        rows.map((p) => line(p)),
        `${rows.length} ${rows.length === 1 ? 'person takes' : 'people take'} ${day[0]?.toUpperCase()}${day.slice(1)} off:`,
      ),
    };
  }

  /* 7. One person, by name or ID. */
  const named = personIn(q, all);
  if (named) {
    return { understood: true, matched: 'person', answer: detail(named, on) };
  }

  /* 8. A department or a job title — but only if the sentence is asking about
     people at all. The IT department is two letters and "will it rain on site
     tomorrow" is a whole-word match for it; answering that with the IT team is
     the kind of confident nonsense this file exists to avoid. */
  const aboutPeople = /\b(who|whom|show|list|give|find|people|staff|everyone|anybody|anyone|names?|team|working|works)\b/.test(q);
  const dept = aboutPeople ? deptIn(q, all) : null;
  if (dept) {
    const rows = all.filter(active).filter((p) => p.dept === dept);
    return {
      understood: true,
      matched: 'department',
      answer: listed(rows.map((p) => line(p)), `${rows.length} in ${dept}:`),
    };
  }

  /* And a job title, on the same condition. */
  const words = aboutPeople ? q.split(' ').filter((w) => w.length > 3) : [];
  if (words.length) {
    const rows = all
      .filter(active)
      .filter((p) => words.some((w) => p.designation.toLowerCase().includes(w)));
    if (rows.length) {
      return {
        understood: true,
        matched: 'designation',
        answer: listed(rows.map((p) => line(p)), `${rows.length} matching that post:`),
      };
    }
  }

  return { understood: false, matched: 'unread', answer: help() };
}

function help(): string {
  return [
    'I did not understand that one — I would rather say so than guess about somebody.',
    '',
    'Things I can answer off the register:',
    ...ASK_EXAMPLES.map((e) => `  · ${e}`),
    '',
    'Pay, Aadhaar, PAN, addresses and personal numbers are not available to me at all.',
  ].join('\n');
}

/** Exported for the date formatting a caller may want to match. */
export const askMonths = MONTHS;
