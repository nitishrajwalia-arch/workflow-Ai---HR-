/**
 * The sheet HR hands to Accounts.
 *
 * Payroll does not end on a screen. HR works the month out, releases it, and
 * then sends Accounts a sheet — and Accounts pays from that sheet. So the sheet
 * is part of the software, not an afterthought somebody rebuilds in Excel every
 * month, which is exactly where a figure quietly stops matching what HR agreed.
 *
 * It is built HERE, in shared code, from the same run the screen shows, for two
 * reasons. It is testable — a test can read the sheet and check every total
 * against the engine. And it needs no server: the browser writes the file from
 * the run it already has, so the sheet works the same whether the API is
 * reachable or not.
 *
 * CSV, deliberately. Accounts opens it in Excel and pastes it into the book they
 * already keep. A .xlsx would look better and would need a library, a build step
 * and a binary nobody can read in a diff.
 *
 * COLUMN HEADERS SAY WHAT THE FIGURE IS, NOT WHAT PERCENTAGE IT IS. The company's
 * own books head the columns ".75% E.S.I." and "12% P.F.". Those rates live in
 * the salary policy and a company can change them; a header that says 0.75%
 * while the policy says something else is a sheet that lies in a way nobody
 * checks. "E.S.I. (employee)" is true whatever the policy is set to.
 */

export interface SheetLine {
  pid: string | null;
  name: string;
  designation: string;
  days: number;
  gross: number;
  basic: number;
  hra: number;
  travel: number;
  medical: number;
  special: number;
  eBasic: number;
  eHra: number;
  eTravel: number;
  eMedical: number;
  eSpecial: number;
  eGross: number;
  dEsi: number;
  dPf: number;
  dTds: number;
  dAdvance: number;
  dOther: number;
  dTotal: number;
  erEsi: number;
  erPf: number;
  extraDays: number;
  extraAmount: number;
  arrear: number;
  net: number;
  payable: number;
  remark: string;
}

export interface SheetRun {
  month: string;
  company: string;
  monthDays: number;
  status: string;
  source: string;
  createdBy: string;
  releasedBy: string;
  releasedAt: string | null;
  lines: readonly SheetLine[];
}

export interface SheetOptions {
  /** The company's full name. Falls back to its id. */
  companyName?: string;
  /** Joining dates keyed by employee id, as the register writes them. */
  joined?: Record<string, string>;
  /** Who pressed the button. Appears on the sheet so Accounts can ask them. */
  preparedBy?: string;
  /** Injectable so a test can assert the whole file, byte for byte. */
  at?: Date;
}

/** One CSV field. Quotes anything that would otherwise break a row. */
function f(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // A leading =, + or - makes Excel treat the cell as a formula. Names here are
  // real people's names and remarks are free text, so it is worth being careful.
  const safe = /^[=+@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const row = (cells: Array<string | number | null | undefined>): string => cells.map(f).join(',');

const sum = (lines: readonly SheetLine[], pick: (l: SheetLine) => number): number =>
  lines.reduce((a, l) => a + pick(l), 0);

const HEAD = [
  'Sr. No.',
  'Employee ID',
  'Employee Name',
  'Designation',
  'D.O.J',
  'Days Paid',
  'Days in Month',
  'Basic',
  'H.R.A.',
  'Travelling',
  'Medical',
  'Special',
  'Gross Salary',
  'Earned Basic',
  'Earned H.R.A.',
  'Earned Travelling',
  'Earned Medical',
  'Earned Special',
  'Gross Payable',
  'E.S.I. (employee)',
  'P.F. (employee)',
  'T.D.S.',
  'Advance',
  'Other Deduction',
  'Total Deduction',
  'Arrear',
  'Total Salary Paid',
  'Extra Days',
  'Extra Days Amount',
  'Net Payable',
  'E.S.I. (employer)',
  'P.F. (employer)',
  'Total Employer Share',
  'Remark',
];

/**
 * The roll-out sheet for one month of one company.
 *
 * Returns the file name as well as the text: the name carries the company and
 * the month, because the thing that goes wrong with these files is paying
 * August's sheet twice.
 */
export function rollOutSheet(
  run: SheetRun,
  opts: SheetOptions = {},
): { name: string; csv: string } {
  const joined = opts.joined ?? {};
  const lines = run.lines;
  const at = opts.at ?? new Date();
  const company = opts.companyName || run.company;

  const out: string[] = [];
  const say = (k: string, v: string | number): void => {
    out.push(row([k, v]));
  };

  out.push(row(['Salary roll-out sheet']));
  say('Company', company);
  say('Month', run.month);
  say('Days in the month', run.monthDays);
  say(
    'Status',
    run.status === 'released'
      ? 'Released to Accounts — these figures do not change'
      : 'DRAFT — not released. Do not pay from this sheet.',
  );
  say(
    'Worked out',
    run.source === 'imported'
      ? "Imported from the company's own salary book"
      : "Worked out from each person's salary and the company's policy",
  );
  // A run loaded from the company's own book was not prepared by anybody here,
  // and naming the importer on a sheet Accounts reads would put a person's name
  // against figures they never worked out. The provenance line above says where
  // it came from; that is the whole truth about it.
  if (run.source !== 'imported') {
    if (run.createdBy) say('Prepared by', run.createdBy);
    if (run.releasedBy) say('Released by', run.releasedBy);
  }
  if (run.releasedAt) say('Released on', run.releasedAt.slice(0, 10));
  say('People on this sheet', lines.length);
  say(
    'Net payable',
    sum(lines, (l) => l.payable),
  );
  say('Downloaded by', opts.preparedBy || '—');
  say('Downloaded on', at.toISOString().slice(0, 10));
  out.push('');

  out.push(row(HEAD));
  lines.forEach((l, i) => {
    out.push(
      row([
        i + 1,
        l.pid ?? 'NOT ON THE REGISTER',
        l.name,
        l.designation,
        l.pid ? (joined[l.pid] ?? '') : '',
        l.days,
        run.monthDays,
        l.basic,
        l.hra,
        l.travel,
        l.medical,
        l.special,
        l.gross,
        l.eBasic,
        l.eHra,
        l.eTravel,
        l.eMedical,
        l.eSpecial,
        l.eGross,
        l.dEsi,
        l.dPf,
        l.dTds,
        l.dAdvance,
        l.dOther,
        l.dTotal,
        l.arrear,
        l.net,
        l.extraDays,
        l.extraAmount,
        l.payable,
        l.erEsi,
        l.erPf,
        l.erEsi + l.erPf,
        l.remark,
      ]),
    );
  });

  // The totals row sits under the columns it totals, so Accounts can check the
  // file against their own book by looking at one line.
  out.push(
    row([
      '',
      '',
      `TOTAL — ${lines.length} people`,
      '',
      '',
      '',
      '',
      sum(lines, (l) => l.basic),
      sum(lines, (l) => l.hra),
      sum(lines, (l) => l.travel),
      sum(lines, (l) => l.medical),
      sum(lines, (l) => l.special),
      sum(lines, (l) => l.gross),
      sum(lines, (l) => l.eBasic),
      sum(lines, (l) => l.eHra),
      sum(lines, (l) => l.eTravel),
      sum(lines, (l) => l.eMedical),
      sum(lines, (l) => l.eSpecial),
      sum(lines, (l) => l.eGross),
      sum(lines, (l) => l.dEsi),
      sum(lines, (l) => l.dPf),
      sum(lines, (l) => l.dTds),
      sum(lines, (l) => l.dAdvance),
      sum(lines, (l) => l.dOther),
      sum(lines, (l) => l.dTotal),
      sum(lines, (l) => l.arrear),
      sum(lines, (l) => l.net),
      sum(lines, (l) => l.extraDays),
      sum(lines, (l) => l.extraAmount),
      sum(lines, (l) => l.payable),
      sum(lines, (l) => l.erEsi),
      sum(lines, (l) => l.erPf),
      sum(lines, (l) => l.erEsi + l.erPf),
      '',
    ]),
  );

  // Days beyond the month are their own sheet in the company's books, because
  // they are paid on a different divisor and get queried more than anything
  // else on the page. Same here, and only when there are any.
  const extra = lines.filter((l) => l.extraDays > 0);
  if (extra.length) {
    out.push('');
    out.push(row(['Days beyond the month — paid separately']));
    out.push(row(['Sr. No.', 'Employee ID', 'Employee Name', 'Extra Days', 'Amount', 'Remark']));
    extra.forEach((l, i) =>
      out.push(
        row([i + 1, l.pid ?? 'NOT ON THE REGISTER', l.name, l.extraDays, l.extraAmount, l.remark]),
      ),
    );
    out.push(
      row(['', '', 'TOTAL', sum(extra, (l) => l.extraDays), sum(extra, (l) => l.extraAmount), '']),
    );
  }

  // Anybody being paid who is not an employee on the register is said plainly,
  // on the sheet Accounts pays from, rather than left for somebody to notice.
  const orphans = lines.filter((l) => !l.pid);
  if (orphans.length) {
    out.push('');
    out.push(
      row([
        `${orphans.length} ${orphans.length === 1 ? 'person is' : 'people are'} on this sheet and not on the employee register`,
      ]),
    );
    out.push(row(['Employee Name', 'Designation', 'Gross Salary', 'Net Payable']));
    for (const o of orphans) out.push(row([o.name, o.designation, o.gross, o.payable]));
  }

  out.push('');
  out.push(row(['All figures are whole rupees.']));
  out.push(
    row([
      'Earned pay is each part of the salary scaled by days paid over days in the month, rounded to the rupee separately.',
    ]),
  );
  out.push(
    row([
      'Questions about a figure go back to HR, who can show the rule behind it. Anything that needs deciding goes to the management.',
    ]),
  );

  const slug = `${company} ${run.month}`.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { name: `salary-${slug}.csv`, csv: out.join('\r\n') + '\r\n' };
}
