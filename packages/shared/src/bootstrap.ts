/**
 * The bootstrap payload.
 *
 * The existing 7,300-line UI reads its whole world out of one context object and
 * expects every collection to be there, synchronously, on first render. Rather
 * than rewrite 40 screens into 40 loading states, the API hands the browser that
 * whole world in ONE request, and every mutation afterwards is an individual call
 * that patches the local copy.
 *
 * This is a deliberate trade, and it is the right one at this size: 200 people and
 * a few hundred log rows is well under 500 KB of JSON, gzipped to a fraction of
 * that. See docs/FRONTEND-INTEGRATION.md for the point at which it stops being the
 * right trade and what to do then.
 *
 * The keys below are exactly the keys `ProcCtx` already provides. That is not a
 * coincidence: it is the contract that lets MarbellaHR.jsx run unmodified.
 */

import type { SealedEntry } from './ledger.js';

export interface BootstrapPerson {
  id: string;
  name: string;
  designation: string;
  dept: string;
  type: string;
  phone: string;
  email: string;
  joined: string;
  dob: string | null;
  status: string;
  exitedOn: string | null;
  perf: number;
  growth: string;
  notes: Array<{ when: string; text: string }>;
  office: string;
  employer: string;
  reportsTo: string | null;
  photo: string | null;
  shift: { in: string; out: string; hours: number };
  imported: boolean;
}

export interface BootstrapCard {
  id: string;
  pid: string;
  name: string;
  ver: number;
  reason: string;
  at: string;
  by: string;
  recv: string;
  note: string;
  killed: string | null;
  zonesKilled: boolean;
}

export interface BootstrapCompany {
  id: string;
  name: string;
  gstin: string;
  pan: string;
  kind: string;
  addr: string;
}

export interface BootstrapProject {
  id: string;
  name: string;
  short: string;
  company: string;
  reraStatus: string;
  rera: string;
  stage: string;
  addr: string;
  tint: string;
}

export interface BootstrapExit {
  id: string;
  pid: string;
  stage: string;
  record: Record<string, unknown>;
  opened: string;
  reason: string;
  closedAt: string | null;
}

export interface BootstrapDevice {
  id: string;
  pid: string;
  type: string;
  model: string;
  imei: string;
  sim: string;
  issued: string;
}

export interface BootstrapSalary {
  basic: number;
  hra: number;
  special: number;
  pf: number;
  pt: number;
  note: string;
}

export interface BootstrapContact {
  phone: string;
  email: string;
  vPhone: boolean;
  vEmail: boolean;
}

export interface BootstrapDeptRule {
  in: string;
  out: string;
  hours: number;
  days: string;
  grace: number;
  setBy: string;
  note: string;
}

export interface BootstrapLeavePolicy {
  casual: number;
  sick: number;
  earned: number;
  halfDay: string;
  lateAfter: number;
}

export interface BootstrapDoc {
  id: string;
  at: string;
  tpl: string;
  pid: string;
  company: string;
  via: string;
  subject: string;
  by: string;
}

export interface BootstrapOffice {
  id: string;
  name: string;
  short: string;
  tint: string;
}

/** Exactly the shape `ProcCtx.Provider` is given, minus the action functions. */
export interface BootstrapPayload {
  people: BootstrapPerson[];
  /** Newest first, the order the UI displays. */
  cardLog: BootstrapCard[];
  /** Newest first. Verify with verifyChainNewestFirst. */
  ledger: SealedEntry[];
  salaries: Record<string, BootstrapSalary>;
  devices: BootstrapDevice[];
  contacts: Record<string, BootstrapContact>;
  leavePolicy: Record<string, BootstrapLeavePolicy>;
  deptRules: Record<string, BootstrapDeptRule>;
  companies: BootstrapCompany[];
  projects: BootstrapProject[];
  exits: BootstrapExit[];
  usage: Record<string, number>;
  docLog: BootstrapDoc[];
  jds: Record<string, string>;
  offices: BootstrapOffice[];
  hrLog: Array<{ at: string; who: string; what: string }>;
  /** Server's verdict on the chain. The browser re-checks it independently. */
  ledgerHealth: { ok: boolean; count: number; message?: string };
  /** Who the signed-in person is, so the UI stops hard-coding Simran Kaur. */
  me: {
    id: string;
    name: string;
    email: string;
    role: string;
    personId: string | null;
    title: string;
  };
  /** Bumped whenever a migration changes the payload shape. */
  version: number;
  generatedAt: string;
}

export const BOOTSTRAP_VERSION = 1;
