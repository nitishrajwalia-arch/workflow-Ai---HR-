/**
 * What the tools actually do.
 *
 * Each one reads through the same database the screens read, and each returns
 * PLAIN TEXT rather than JSON: an assistant reads the answer out to somebody,
 * and "43 staff, 83 on site" is an answer where a nested object is homework.
 *
 * None of these can reach a salary, an Aadhaar number, a PAN, a home address
 * or a personal phone number. That is not a filter applied at the end — the
 * queries do not select those columns, so there is no path from here to them.
 */

import type { PrismaClient } from '@prisma/client';
import { ageFromDisplayDate } from '@marbella/shared';

export interface ToolContext {
  readonly db: PrismaClient;
  /** Who connected the assistant. Every tool answers as them. */
  readonly me: { name: string; role: string; personId: string | null };
}

const inr = (n: number): string => n.toLocaleString('en-IN');

/** The columns an assistant may see. Salary and KYC are not among them. */
const PUBLIC_PERSON = {
  id: true,
  name: true,
  designation: true,
  dept: true,
  type: true,
  status: true,
  joined: true,
  dob: true,
  offDay: true,
  officeId: true,
  employerId: true,
  reportsToId: true,
  reportsToNote: true,
} as const;

type Args = Record<string, unknown>;
const str = (a: Args, k: string): string => String(a[k] ?? '').trim();
const num = (a: Args, k: string, fallback: number): number => {
  const v = Number(a[k]);
  return Number.isFinite(v) ? v : fallback;
};

export const TOOL_RUNNERS: Record<
  string,
  (ctx: ToolContext, args: Args) => Promise<string>
> = {
  async find_people(ctx, args) {
    const q = str(args, 'query');
    const dept = str(args, 'department');
    const limit = Math.min(Math.max(num(args, 'limit', 25), 1), 100);
    const rows = await ctx.db.person.findMany({
      where: {
        status: 'active',
        ...(dept ? { dept } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { designation: { contains: q, mode: 'insensitive' as const } },
                { id: { contains: q.toUpperCase() } },
              ],
            }
          : {}),
      },
      select: PUBLIC_PERSON,
      orderBy: [{ dept: 'asc' }, { name: 'asc' }],
      take: limit,
    });
    if (!rows.length) return 'Nobody on the register matches that.';
    const lines = rows.map((p) => `${p.id}  ${p.name} — ${p.designation}, ${p.dept} (${p.type})`);
    return `${rows.length} match${rows.length === 1 ? '' : 'es'}:\n${lines.join('\n')}`;
  },

  async get_person(ctx, args) {
    const id = str(args, 'employee_id').toUpperCase();
    const p = await ctx.db.person.findUnique({ where: { id }, select: PUBLIC_PERSON });
    if (!p) return `No employee ${id} on the register.`;
    const [office, employer, boss] = await Promise.all([
      ctx.db.office.findUnique({ where: { id: p.officeId }, select: { name: true } }),
      ctx.db.company.findUnique({ where: { id: p.employerId }, select: { name: true } }),
      p.reportsToId
        ? ctx.db.person.findUnique({ where: { id: p.reportsToId }, select: { name: true, id: true } })
        : null,
    ]);
    const age = ageFromDisplayDate(p.dob);
    return [
      `${p.name} — ${p.designation}`,
      `Employee ID: ${p.id}`,
      `Department: ${p.dept} (${p.type})`,
      `Posted at: ${office?.name ?? '—'}`,
      `Employed by: ${employer?.name ?? '—'}`,
      `Reports to: ${boss ? `${boss.name} (${boss.id})` : p.reportsToNote || '—'}`,
      `Joined: ${p.joined}`,
      age ? `Age: ${age}` : null,
      `Weekly off: ${p.offDay || 'not recorded'}`,
      `Status: ${p.status}`,
      '',
      'Pay and identity documents are not available through an assistant.',
    ]
      .filter(Boolean)
      .join('\n');
  },

  async headcount(ctx, args) {
    const by = str(args, 'by') || 'department';
    const people = await ctx.db.person.findMany({
      where: { status: 'active' },
      select: { dept: true, type: true, officeId: true, employerId: true },
    });
    const key = (p: (typeof people)[number]): string =>
      by === 'type' ? p.type : by === 'site' ? p.officeId : by === 'company' ? p.employerId : p.dept;
    const names = new Map<string, string>();
    if (by === 'site') {
      for (const o of await ctx.db.office.findMany({ select: { id: true, name: true } }))
        names.set(o.id, o.name);
    }
    if (by === 'company') {
      for (const c of await ctx.db.company.findMany({ select: { id: true, name: true } }))
        names.set(c.id, c.name);
    }
    const tally = new Map<string, number>();
    for (const p of people) {
      const k = key(p);
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
    const rows = [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `  ${names.get(k) ?? k}: ${n}`);
    return `${people.length} people on the register, by ${by}:\n${rows.join('\n')}`;
  },

  async who_reports_to(ctx, args) {
    const id = str(args, 'employee_id').toUpperCase();
    const p = await ctx.db.person.findUnique({ where: { id }, select: PUBLIC_PERSON });
    if (!p) return `No employee ${id} on the register.`;
    const [boss, reports] = await Promise.all([
      p.reportsToId
        ? ctx.db.person.findUnique({
            where: { id: p.reportsToId },
            select: { id: true, name: true, designation: true },
          })
        : null,
      ctx.db.person.findMany({
        where: { reportsToId: p.id, status: 'active' },
        select: { id: true, name: true, designation: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const lines = [
      `${p.name} (${p.id}) — ${p.designation}`,
      `Reports to: ${boss ? `${boss.name} (${boss.id}), ${boss.designation}` : p.reportsToNote || 'nobody recorded'}`,
      reports.length
        ? `${reports.length} direct report${reports.length === 1 ? '' : 's'}:\n${reports
            .map((r) => `  ${r.id}  ${r.name} — ${r.designation}`)
            .join('\n')}`
        : 'No direct reports.',
    ];
    return lines.join('\n');
  },

  async list_projects(ctx) {
    const [projects, companies, people] = await Promise.all([
      ctx.db.project.findMany({ orderBy: { name: 'asc' } }),
      ctx.db.company.findMany({ select: { id: true, name: true } }),
      ctx.db.person.findMany({ where: { status: 'active' }, select: { officeId: true } }),
    ]);
    const coName = new Map(companies.map((c) => [c.id, c.name]));
    const onSite = new Map<string, number>();
    for (const p of people) onSite.set(p.officeId, (onSite.get(p.officeId) ?? 0) + 1);
    const rows = projects.map(
      (p) =>
        `  ${p.name} — owned by ${coName.get(p.companyId) ?? '—'}, ${onSite.get(p.id) ?? 0} posted there` +
        (p.reraStatus === 'received' ? ', RERA on file' : ', RERA not yet'),
    );
    return `${projects.length} projects:\n${rows.join('\n')}`;
  },

  async upcoming_dates(ctx, args) {
    const months = Math.min(Math.max(num(args, 'months', 3), 1), 12);
    const people = await ctx.db.person.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, dept: true, dob: true, dobOn: true, joined: true, joinedOn: true },
    });
    const today = new Date();
    const within = (on: Date | null): number | null => {
      if (!on) return null;
      const next = new Date(Date.UTC(today.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate()));
      if (next < today) next.setUTCFullYear(next.getUTCFullYear() + 1);
      const days = Math.round((next.getTime() - today.getTime()) / 86_400_000);
      return days <= months * 31 ? days : null;
    };
    const bdays: string[] = [];
    const annis: string[] = [];
    for (const p of people) {
      const b = within(p.dobOn);
      if (b !== null) bdays.push(`  ${p.dob} — ${p.name} (${p.dept}), in ${b} day${b === 1 ? '' : 's'}`);
      const a = within(p.joinedOn);
      if (a !== null) {
        const yrs = p.joinedOn ? today.getUTCFullYear() - p.joinedOn.getUTCFullYear() : 0;
        if (yrs > 0) annis.push(`  ${p.joined} — ${p.name} (${p.dept}), ${yrs} year${yrs === 1 ? '' : 's'}`);
      }
    }
    return [
      `Birthdays in the next ${months} month${months === 1 ? '' : 's'} (${bdays.length}):`,
      bdays.length ? bdays.join('\n') : '  none',
      '',
      `Work anniversaries (${annis.length}):`,
      annis.length ? annis.join('\n') : '  none',
    ].join('\n');
  },

  async holidays(ctx) {
    const [hols, rules] = await Promise.all([
      ctx.db.holiday.findMany({ orderBy: { on: 'asc' } }),
      ctx.db.deptRule.findMany({ orderBy: { dept: 'asc' } }),
    ]);
    return [
      `${hols.length} holidays on the calendar:`,
      hols.length
        ? hols.map((h) => `  ${h.on} — ${h.name}${h.allSites ? ' (all sites closed)' : ''}`).join('\n')
        : '  none on file',
      '',
      'Working hours by department:',
      rules.length
        ? rules.map((r) => `  ${r.dept}: ${r.in}–${r.out}, ${r.hours}h, ${r.days}`).join('\n')
        : '  none on file',
    ].join('\n');
  },

  async attendance_summary(ctx, args) {
    const id = str(args, 'employee_id').toUpperCase();
    if (!id) return 'Give an employee ID.';
    const p = await ctx.db.person.findUnique({
      where: { id },
      select: { name: true, dept: true, offDay: true },
    });
    if (!p) return `No employee ${id} on the register.`;
    const days = await ctx.db.attendanceDay.findMany({
      where: { personId: id },
      orderBy: { date: 'asc' },
    });
    if (!days.length) return `${p.name} is not on the attendance machine — nothing recorded.`;
    const WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const want = WEEK.indexOf(String(p.offDay ?? '').toLowerCase());
    const isOff = (d: string): boolean => {
      const m = d.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/);
      if (!m || want < 0) return false;
      const mi = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        .findIndex((x) => x.toLowerCase() === (m[2] as string).toLowerCase());
      return mi >= 0 && new Date(Date.UTC(+(m[3] as string), mi, +(m[1] as string))).getUTCDay() === want;
    };
    let present = 0;
    let absent = 0;
    let offs = 0;
    for (const d of days) {
      if (isOff(d.date)) offs++;
      else if (!d.inAt && !d.outAt) absent++;
      else present++;
    }
    const expected = present + absent;
    return [
      `${p.name} (${p.dept}) — ${days.length} days recorded`,
      `  Present: ${present} of ${expected} expected`,
      `  Absent: ${absent}`,
      `  Their weekly off (${p.offDay || 'not recorded'}): ${offs}`,
      expected ? `  Attendance: ${Math.round((present / expected) * 100)}%` : '',
    ]
      .filter(Boolean)
      .join('\n');
  },

  async open_hr_tasks(ctx) {
    const tasks = await ctx.db.hrTask.findMany({ where: { done: false }, orderBy: { createdAt: 'asc' } });
    if (!tasks.length) return 'Nothing outstanding on the HR desk.';
    return [
      `${tasks.length} open on the HR desk:`,
      ...tasks.map((t) => `  ${t.text}${t.who ? ` — ${t.who}` : ''}`),
    ].join('\n');
  },
};

export const describeCounts = (n: number): string => inr(n);
