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
export * as schemas from './schemas.js';
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
  SaveJdBody,
  ImportRow,
  BulkImportBody,
  BulkImportResult,
  ErrorBody,
} from './schemas.js';
