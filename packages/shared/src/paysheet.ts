/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * THE SHAPE OF A MONTH'S PAYROLL.
 *
 * One line per person, as the engine works it out and as the database stores
 * it. Everything that reads a pay run — the screen, the report, and the file
 * HR sends to Accounts — reads this shape, so there is one description of what
 * a payslip is rather than three that drift.
 *
 * The file itself is built in accountsfile.ts. There used to be a second one
 * here, a CSV, written before the workbook existed; two payroll files that can
 * disagree is a month where somebody eventually pays from the wrong one, so
 * there is now one.
 */

export interface SheetReduction {
  code: string;
  label: string;
  amount: number;
  employer: number;
  why: string;
  statutory: boolean;
}

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
  /** Optional: older lines were stored before reductions were itemised. */
  erOther?: number;
  reductions?: readonly SheetReduction[];

  /** Allowances paid on top, head by head, with the policy behind each. */
  additions?: readonly SheetAddition[];
  /** What those come to. */
  eAllow?: number;

  /**
   * THE ATTENDANCE THIS LINE WAS WORKED OUT FROM.
   *
   * -1, or absent altogether, means NOT RECORDED — which is not zero. Somebody
   * off the attendance machine is paid the full month and has no present count,
   * and a zero on the sheet reads as a man who never came in.
   */
  dPresent?: number;
  dAbsent?: number;
  dWeekOff?: number;
  dHoliday?: number;
  dLeave?: number;
  dLost?: number;
}

export interface SheetAddition {
  code: string;
  label: string;
  amount: number;
  taxable: boolean;
  why: string;
  policy: boolean;
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
