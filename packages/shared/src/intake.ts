/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * The columns the bulk intake reads, and how a real sheet's headers are matched
 * to them.
 *
 * This lives here rather than in the screen because three things have to agree
 * and they used to be three separate lists: the matcher in the browser, the
 * master workbook HR is handed, and the test that proves the one can read the
 * other. Now the workbook is checked against THIS, so a column renamed here and
 * nowhere else fails a test instead of an afternoon.
 */

export interface IntakeField {
  k: string;
  label: string;
  req: boolean;
  /** Lowercased spellings seen on real sheets. Matched on equality or substring. */
  aliases: readonly string[];
}

/** Adding people who are not on the roster. */
export const INTAKE_FIELDS: readonly IntakeField[] = [
  {
    k: 'name',
    label: 'Full name',
    req: true,
    aliases: ['name', 'employee name', 'full name', 'staff name', 'emp name', 'नाम'],
  },
  {
    k: 'id',
    label: 'Employee ID',
    req: false,
    aliases: ['id', 'employee id', 'emp id', 'code', 'empcode', 'employee code', 'emp no'],
  },
  {
    k: 'desig',
    label: 'Designation',
    req: true,
    aliases: ['designation', 'role', 'post', 'title', 'job title', 'position'],
  },
  {
    k: 'dept',
    label: 'Department',
    req: true,
    aliases: ['department', 'dept', 'division', 'section'],
  },
  {
    k: 'office',
    label: 'Office / site',
    req: false,
    aliases: ['office', 'site', 'location', 'posting', 'branch', 'place'],
  },
  {
    k: 'joined',
    label: 'Date of joining',
    req: true,
    aliases: ['doj', 'date of joining', 'joining date', 'joined', 'start date', 'date joined'],
  },
  {
    k: 'dob',
    label: 'Date of birth',
    req: false,
    aliases: ['dob', 'date of birth', 'birth date', 'birthday', 'born'],
  },
  { k: 'gender', label: 'Gender', req: false, aliases: ['gender', 'sex', 'm/f', 'male/female'] },
  {
    k: 'phone',
    label: 'Personal mobile',
    req: true,
    aliases: [
      'mobile',
      'phone',
      'personal mobile',
      'contact',
      'cell',
      'personal number',
      'mobile no',
    ],
  },
  {
    k: 'email',
    label: 'Personal email',
    req: false,
    aliases: ['email', 'personal email', 'e-mail', 'mail', 'email id'],
  },
  { k: 'basic', label: 'Basic pay', req: false, aliases: ['basic', 'basic pay', 'basic salary'] },
  { k: 'hra', label: 'HRA', req: false, aliases: ['hra', 'house rent', 'house rent allowance'] },
  {
    k: 'special',
    label: 'Other allowances',
    req: false,
    aliases: ['special', 'special allowance', 'other', 'allowance', 'allowances', 'conveyance'],
  },
  {
    k: 'gross',
    label: 'Monthly gross',
    req: false,
    aliases: ['gross', 'monthly gross', 'ctc', 'gross salary', 'total salary', 'monthly salary'],
  },
  {
    k: 'travel',
    label: 'Travelling allowance',
    req: false,
    aliases: ['travelling', 'travel', 'travelling allowance', 'conveyance allowance', 'ta'],
  },
  {
    k: 'medical',
    label: 'Medical allowance',
    req: false,
    aliases: ['medical', 'medical allowance'],
  },
  {
    k: 'pfOn',
    label: 'P.F. applies',
    req: false,
    /* NOT a bare 'pf'. It is a substring of "PF Percent" and "PF Wage Ceiling",
       and a rate of 12 read into a yes/no field is a person whose provident
       fund was switched on by a number that meant something else. A heading of
       exactly "PF" now matches nothing and is reported as unread, which is the
       safe way round. */
    aliases: ['pf enabled', 'pf applies', 'pf applicable', 'provident fund'],
  },
  {
    k: 'pfWages',
    label: 'P.F. wage, if theirs is different',
    req: false,
    aliases: ['pf wage', 'pf wages', 'pf wage ceiling', 'pf wage cap'],
  },
  {
    k: 'esiOn',
    label: 'E.S.I. applies',
    req: false,
    /* Bare 'esi' left out for the same reason as 'pf' above. */
    aliases: ['esi enabled', 'esi applies', 'esi applicable'],
  },
  {
    k: 'pan',
    label: 'PAN',
    req: false,
    aliases: ['pan', 'pan no', 'pan number', 'pan card'],
  },
  {
    k: 'aadhaar',
    label: 'Aadhaar',
    req: false,
    aliases: ['aadhaar', 'aadhar', 'adhaar', 'aadhaar no', 'aadhaar number', 'uid'],
  },
  {
    k: 'workEmail',
    label: 'Work email',
    req: false,
    aliases: [
      'work email',
      'company email',
      'official email',
      'office email',
      'work mail',
      'company mail',
    ],
  },
  {
    k: 'imei',
    label: 'Device IMEI',
    req: false,
    aliases: ['imei', 'imei no', 'device imei', 'handset imei'],
  },
  {
    k: 'sim',
    label: 'Work phone (company SIM)',
    req: false,
    aliases: [
      'sim',
      'sim no',
      'sim number',
      'company number',
      'official number',
      'work phone',
      'company phone',
      'official mobile',
      'work mobile',
      'company mobile',
    ],
  },
];

/**
 * Filling in blanks for people already on the roster.
 *
 * Designation, department, posting and employer are deliberately absent: a
 * promotion or a transfer is recorded on its own, with a reason, and not as a
 * side effect of somebody pasting a spreadsheet.
 */
export const INTAKE_UPDATE_FIELDS: readonly IntakeField[] = [
  {
    k: 'id',
    label: 'Employee ID',
    req: true,
    aliases: ['id', 'employee id', 'emp id', 'code', 'empcode', 'employee code', 'emp no'],
  },
  { k: 'gender', label: 'Gender', req: false, aliases: ['gender', 'sex', 'm/f', 'male/female'] },
  {
    k: 'dob',
    label: 'Date of birth',
    req: false,
    aliases: ['dob', 'date of birth', 'birth date', 'birthday', 'born'],
  },
  {
    k: 'email',
    label: 'Personal email',
    req: false,
    aliases: ['email', 'personal email', 'e-mail', 'mail', 'email id'],
  },
  {
    k: 'phone',
    label: 'Personal mobile',
    req: false,
    aliases: [
      'mobile',
      'phone',
      'personal mobile',
      'contact',
      'cell',
      'personal number',
      'mobile no',
    ],
  },
  {
    k: 'reportsTo',
    label: 'Reports to (ID)',
    req: false,
    aliases: ['reports to', 'reporting to', 'manager', 'manager id', 'reports to id', 'supervisor'],
  },
  {
    k: 'gross',
    label: 'Monthly gross',
    req: false,
    aliases: ['gross', 'monthly gross', 'ctc', 'gross salary', 'total salary', 'monthly salary'],
  },
  {
    k: 'travel',
    label: 'Travelling allowance',
    req: false,
    aliases: ['travelling', 'travel', 'travelling allowance', 'conveyance allowance', 'ta'],
  },
  {
    k: 'medical',
    label: 'Medical allowance',
    req: false,
    aliases: ['medical', 'medical allowance'],
  },
  {
    k: 'pfOn',
    label: 'P.F. applies',
    req: false,
    aliases: ['pf enabled', 'pf applies', 'pf applicable', 'pf', 'provident fund'],
  },
  {
    k: 'pfWages',
    label: 'P.F. wage, if theirs is different',
    req: false,
    aliases: ['pf wage', 'pf wages', 'pf wage ceiling', 'pf wage cap'],
  },
  {
    k: 'esiOn',
    label: 'E.S.I. applies',
    req: false,
    aliases: ['esi enabled', 'esi applies', 'esi applicable', 'esi'],
  },
  {
    k: 'pan',
    label: 'PAN',
    req: false,
    aliases: ['pan', 'pan no', 'pan number', 'pan card'],
  },
  {
    k: 'aadhaar',
    label: 'Aadhaar',
    req: false,
    aliases: ['aadhaar', 'aadhar', 'adhaar', 'aadhaar no', 'aadhaar number', 'uid'],
  },
  {
    k: 'workEmail',
    label: 'Work email',
    req: false,
    aliases: [
      'work email',
      'company email',
      'official email',
      'office email',
      'work mail',
      'company mail',
    ],
  },
  {
    k: 'imei',
    label: 'Device IMEI',
    req: false,
    aliases: ['imei', 'imei no', 'device imei', 'handset imei'],
  },
  {
    k: 'sim',
    label: 'Work phone (company SIM)',
    req: false,
    aliases: [
      'sim',
      'sim no',
      'sim number',
      'company number',
      'official number',
      'work phone',
      'company phone',
      'official mobile',
      'work mobile',
      'company mobile',
    ],
  },
  { k: 'basic', label: 'Basic pay', req: false, aliases: ['basic', 'basic pay', 'basic salary'] },
  { k: 'hra', label: 'HRA', req: false, aliases: ['hra', 'house rent', 'house rent allowance'] },
  {
    k: 'special',
    label: 'Other allowances',
    req: false,
    aliases: ['special', 'special allowance', 'other', 'allowance', 'allowances', 'conveyance'],
  },
];

/**
 * A sheet's headers, matched to our fields. Returns field key -> column index.
 *
 * First match wins, so a sheet with both "Personal Mobile" and "Official
 * Number" does not lose the first to the second.
 */
export function matchColumns(
  headers: readonly string[],
  fields: readonly IntakeField[] = INTAKE_FIELDS,
): Record<string, number> {
  const out: Record<string, number> = {};
  const tidy = (h: string): string =>
    h
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .trim();
  const clean = headers.map(tidy);

  /* AN EXACT HEADING WINS, AND IT IS MATCHED FIRST.
     This used to be one pass that took the first field with an alias the
     heading CONTAINED, which let a short alias steal a column from a longer
     one: "PF Wage Ceiling" contains "pf", so it matched the P.F.-applies field
     — and because that field was already taken by "PF Enabled", the column was
     claimed by nothing and silently dropped. */
  clean.forEach((s, i) => {
    if (!s) return;
    const f = fields.find((f) => f.aliases.includes(s));
    if (f && out[f.k] === undefined) out[f.k] = i;
  });

  /* Then the loose ones — "emp mobile no" is nobody's exact alias and is
     plainly the mobile. The LONGEST alias that fits wins, so a heading that
     mentions two things goes to the more specific of them. */
  clean.forEach((s, i) => {
    if (!s || Object.values(out).includes(i)) return;
    let best: { f: IntakeField; len: number } | null = null;
    for (const f of fields) {
      if (out[f.k] !== undefined) continue;
      for (const a of f.aliases) {
        if (s.includes(a) && (!best || a.length > best.len)) best = { f, len: a.length };
      }
    }
    if (best) out[best.f.k] = i;
  });
  return out;
}
