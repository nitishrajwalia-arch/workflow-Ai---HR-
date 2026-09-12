/**
 * Marbella Group's attendance and leave policy.
 *
 * Taken from "Attendance, Punctuality & Leave Policy" issued by the HR
 * department, last saved 12 September 2026. Where the policy defers to
 * something else — "as per the company's approved policy", "as per applicable
 * employment terms" — the number here is 0 and the text says so, because the
 * document genuinely does not state it. Those are the gaps to close, not
 * values to invent.
 */

/**
 * Working hours per department, derived from the hours each person is actually
 * recorded as working in the company's own timings sheet — the commonest shift
 * in each department becomes the department rule. People who work something
 * different keep their own hours on their record; the count of those is in the
 * note, so nobody mistakes the rule for the whole truth.
 */
export const DEPT_HOURS: Record<
  string,
  {
    in: string;
    out: string;
    hours: number;
    days: string;
    grace: number;
    setBy: string;
    note: string;
  }
> = {
  Sales: {
    in: '10:30',
    out: '18:30',
    hours: 8,
    days: 'Mon–Sat',
    grace: 0,
    setBy: 'HR Department',
    note: '',
  },
  CRM: {
    in: '10:30',
    out: '18:30',
    hours: 8,
    days: 'Mon–Sat',
    grace: 0,
    setBy: 'HR Department',
    note: '3 people work 10:00–18:00.',
  },
  Accounts: {
    in: '10:30',
    out: '18:30',
    hours: 8,
    days: 'Mon–Sat',
    grace: 0,
    setBy: 'HR Department',
    note: '',
  },
  IT: {
    in: '10:30',
    out: '18:30',
    hours: 8,
    days: 'Mon–Sat',
    grace: 0,
    setBy: 'HR Department',
    note: '',
  },
  Admin: {
    in: '10:30',
    out: '18:30',
    hours: 8,
    days: 'Mon–Sat',
    grace: 0,
    setBy: 'HR Department',
    note: '',
  },
  Pantry: {
    in: '10:30',
    out: '18:30',
    hours: 8,
    days: 'Mon–Sat',
    grace: 0,
    setBy: 'HR Department',
    note: '1 person starts at 09:30.',
  },
  HR: {
    in: '10:15',
    out: '18:30',
    hours: 8.25,
    days: 'Mon–Sat',
    grace: 0,
    setBy: 'HR Department',
    note: '',
  },
  Marketing: {
    in: '10:30',
    out: '18:30',
    hours: 8,
    days: 'Mon–Sat',
    grace: 0,
    setBy: 'HR Department',
    note: '',
  },
  Project: {
    in: '09:30',
    out: '18:30',
    hours: 9,
    days: 'Mon–Sat',
    grace: 0,
    setBy: 'HR Department',
    note: '21 people start at 08:30.',
  },
  Purchase: {
    in: '10:30',
    out: '18:30',
    hours: 8,
    days: 'Mon–Sat',
    grace: 0,
    setBy: 'HR Department',
    note: '',
  },
  Maintenance: {
    in: '09:00',
    out: '18:30',
    hours: 9.5,
    days: 'Mon–Sat',
    grace: 0,
    setBy: 'HR Department',
    note: '',
  },
  Horticulture: {
    in: '08:30',
    out: '18:30',
    hours: 10,
    days: 'Mon–Sat',
    grace: 0,
    setBy: 'HR Department',
    note: '',
  },
};

/**
 * The leave entitlement, as the policy states it.
 *
 * `casual: 12` is the one number the document gives outright — one Casual Leave
 * per month. Sick and Earned are promised but never quantified: sick leave is
 * "inform your manager, a medical certificate may be requested", earned leave
 * is "as per applicable employment terms". Both are left at 0 so that the gap
 * is visible on the screen rather than filled with a plausible 12.
 *
 * `lateAfter: 0` because the policy sets no grace period at all. It says the
 * opposite — that traffic, rain and vehicle trouble are not accepted as
 * reasons — so a grace window would contradict it.
 */
export const LEAVE_POLICY = {
  casual: 12,
  sick: 0,
  earned: 0,
  lateAfter: 0,
  halfDay:
    'Two short leaves a month, 2.5 hours each. Short leave and half day cannot ' +
    'be taken on the same day. First half: report before 15:00. Second half: ' +
    'report after 14:30. A half day still requires 4.5 hours worked.',
} as const;

/**
 * The parts of the policy the system does not yet enforce, kept here so they
 * are not lost between the document and the software.
 */
export const POLICY_GAPS = [
  'Sick leave: entitlement not stated. Policy says a medical certificate may be requested for prolonged or repeated absence.',
  'Earned / privilege leave: "as per applicable employment terms" — no number given.',
  'Carry-forward and encashment: "as per the company\'s approved HR policy" — not specified.',
  'Salary deduction: "may result in deduction as per approved policy" — no rate, and no divisor (26 / 30 / working days).',
  'Weekly off and public holidays: refers to an official holiday calendar that has not been supplied.',
  'Leave approval: routed to "reporting manager / HR", but 117 of 126 people have no manager recorded.',
] as const;
