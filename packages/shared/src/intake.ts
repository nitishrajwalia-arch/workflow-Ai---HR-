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
    k: 'imei',
    label: 'Device IMEI',
    req: false,
    aliases: ['imei', 'imei no', 'device imei', 'handset imei'],
  },
  {
    k: 'sim',
    label: 'SIM number',
    req: false,
    aliases: ['sim', 'sim no', 'sim number', 'company number', 'official number'],
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
    k: 'imei',
    label: 'Device IMEI',
    req: false,
    aliases: ['imei', 'imei no', 'device imei', 'handset imei'],
  },
  {
    k: 'sim',
    label: 'SIM number',
    req: false,
    aliases: ['sim', 'sim no', 'sim number', 'company number', 'official number'],
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
  headers.forEach((h, i) => {
    const s = h
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .trim();
    const f = fields.find((f) => f.aliases.some((a) => s === a || s.includes(a)));
    if (f && out[f.k] === undefined) out[f.k] = i;
  });
  return out;
}
