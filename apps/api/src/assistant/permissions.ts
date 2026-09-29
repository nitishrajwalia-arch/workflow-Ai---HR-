/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * WHAT AN ASSISTANT MAY DO.
 *
 * This file is the whole permission list, on purpose. When the management want
 * to give an assistant more, they change a line here — they do not go looking
 * through code. When somebody asks "can ChatGPT see our salaries", the answer
 * is in one place and it is readable without being a programmer.
 *
 * THREE RULES THIS FILE ENFORCES, AND WHY EACH ONE IS HERE
 *
 * 1. An assistant acts AS THE PERSON who connected it, with that person's own
 *    role. It never has an account or powers of its own. A storeman asking
 *    Claude a question gets exactly what the storeman could see by opening the
 *    app himself — no more. Without this, the assistant becomes a way round
 *    every gate on the other 129 routes.
 *
 * 2. Nothing here writes. Reading is a question; writing is a decision, and a
 *    decision belongs to a person who can be asked why they made it. Writes can
 *    be turned on tool by tool later — `writes: true` below — and each one
 *    should be a deliberate act, not a default.
 *
 * 3. No salary, no Aadhaar, no PAN, no home address, ever. Not gated — ABSENT.
 *    A question typed into ChatGPT or Claude travels to OpenAI's or Anthropic's
 *    servers, and under India's DPDP Act sending an employee's Aadhaar there is
 *    a decision for the company to take deliberately and write down, not one to
 *    arrive at by leaving a flag on. The tools that could carry that data are
 *    not written, so no configuration mistake can switch them on.
 */

import { ROLES, type Role } from '@marbella/shared';

export interface AssistantTool {
  /** What the assistant calls it. */
  readonly name: string;
  /** One line, shown to the person approving the connection. */
  readonly summary: string;
  /** The least role that may use it. A VIEWER is the gate, the store and the assistants. */
  readonly minRole: Role;
  /** True when the tool changes something. Every tool here is false today. */
  readonly writes: boolean;
}

/**
 * The tools, and who may use each.
 *
 * `minRole` mirrors what the same information costs through the screens — an
 * assistant must not be an easier door than the front one.
 */
export const ASSISTANT_TOOLS: readonly AssistantTool[] = [
  {
    name: 'ask',
    summary: 'Ask a plain-language question about the staff register and get the answer.',
    minRole: 'VIEWER',
    writes: false,
  },
  {
    name: 'find_people',
    summary:
      'Search the staff register by name, department, designation or site, and by age.',
    minRole: 'VIEWER',
    writes: false,
  },
  {
    name: 'get_person',
    summary: 'One person: role, department, who they report to, where they sit, when they joined.',
    minRole: 'VIEWER',
    writes: false,
  },
  {
    name: 'headcount',
    summary: 'How many people, broken down by department, company, site or staff type.',
    minRole: 'VIEWER',
    writes: false,
  },
  {
    name: 'who_reports_to',
    summary: "Somebody's manager and their direct reports.",
    minRole: 'VIEWER',
    writes: false,
  },
  {
    name: 'list_projects',
    summary: 'The projects and the company that owns each one.',
    minRole: 'VIEWER',
    writes: false,
  },
  {
    name: 'upcoming_dates',
    summary: 'Birthdays and work anniversaries in the months ahead.',
    minRole: 'VIEWER',
    writes: false,
  },
  {
    name: 'holidays',
    summary: 'The holiday calendar and the leave rules by department.',
    minRole: 'VIEWER',
    writes: false,
  },
  {
    name: 'attendance_summary',
    summary: 'Days present, absent and on their weekly off, for a person or a department.',
    minRole: 'MANAGER',
    writes: false,
  },
  {
    name: 'open_hr_tasks',
    summary: 'What is outstanding on the HR desk.',
    minRole: 'HR',
    writes: false,
  },
];

/**
 * DELIBERATELY NOT BUILT. Listed so that the absence is a decision on the
 * record rather than an oversight somebody fills in later without thinking.
 *
 * Adding any of these means employee pay or identity documents travelling to a
 * third-party AI provider. That is the management's call to make in writing.
 */
export const NOT_EXPOSED = [
  'salary figures, of any person or in any total',
  'pay runs, payslips and what went out in a month',
  'Aadhaar numbers',
  'PAN numbers',
  'home addresses',
  'personal mobile numbers and personal email addresses',
  'bank accounts, card numbers and anything that moves money',
] as const;

export const toolFor = (name: string): AssistantTool | undefined =>
  ASSISTANT_TOOLS.find((t) => t.name === name);

/** May this role use this tool? The same test the screens apply. */
export const mayUse = (tool: AssistantTool, role: Role): boolean =>
  ROLES[role].rank >= ROLES[tool.minRole].rank;

/** What this person's assistant can see — used to describe the connection. */
export const toolsFor = (role: Role): readonly AssistantTool[] =>
  ASSISTANT_TOOLS.filter((t) => mayUse(t, role));
