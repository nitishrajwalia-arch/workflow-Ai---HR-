/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * @marbella/shared
 *
 * Everything both halves of the system must agree about: domain constants, the
 * validation rules, the ledger seal, and the API contract.
 *
 * Nothing in here may import from `@marbella/api` or `@marbella/web`. The
 * dependency arrow points one way only.
 */

export * from './constants.js';
export * from './validation.js';
export * from './ledger.js';
export * from './bootstrap.js';
export * from './pay.js';
export * from './paysheet.js';
export * from './intake.js';
export * from './xlsx.js';
export * from './ask.js';
export * from './xlsxOut.js';
export * from './payreport.js';
export * as schemas from './schemas.js';
export { readJd } from './schemas.js';
export type {
  LoginBody,
  SessionUser,
  AuthTokens,
  PersonCore,
  CreatePersonBody,
  UpdatePersonBody,
  PeopleQuery,
  CompanyBody,
  ProjectBody,
  IssueCardBody,
  LedgerEntry,
  LedgerVerification,
  OpenExitBody,
  AdvanceExitBody,
  SalaryBody,
  DeviceBody,
  ContactBody,
  DeptRuleBody,
  LeavePolicyBody,
  LogDocBody,
  PayRunBody,
  PayLineBody,
  SaveJdBody,
  ImportRow,
  ImportUpdateRow,
  BulkImportBody,
  BulkImportResult,
  ErrorBody,
} from './schemas.js';
