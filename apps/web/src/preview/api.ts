/**
 * The api module, replaced for the shareable preview.
 *
 * vite.config.demo.ts aliases `lib/api` to this file, so the preview runs the
 * REAL application — the same AuthProvider, the same ProcurementProvider, the
 * same screens — with the network swapped for a fixed payload. Nothing is
 * mocked at the component level, which is why the preview behaves like the
 * product rather than like a mockup of it.
 *
 * Every write is refused, in the same shape the server refuses things, so the
 * optimistic updates roll back and the screen ends up showing what is true.
 */
import type { SessionUser } from '@marbella/shared';
import { PREVIEW_WORLD } from './data.js';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Array<{ path: string; message: string }> = [];
  readonly requestId?: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
  get full(): string {
    return this.message;
  }
}

// /bootstrap does not carry userKey — that comes back from the login response,
// which this file is standing in for. Without it the shell has no desk.
const ME: SessionUser = {
  ...(PREVIEW_WORLD as { me: SessionUser }).me,
  userKey: 'hr',
} as SessionUser;

let token: string | null = 'preview';
export const setAccessToken = (t: string | null): void => {
  token = t;
};
export const getAccessToken = (): string | null => token;
export const onSessionLost = (_fn: () => void): void => {};

const REFUSAL =
  'This is a preview, so nothing is saved. The same action works normally when ' +
  'the app is running against your server.';

export async function request<T>(path: string): Promise<T> {
  if (path.startsWith('/bootstrap')) return PREVIEW_WORLD as unknown as T;
  if (path.startsWith('/auth/me')) return ME as unknown as T;
  throw new ApiError(503, 'PREVIEW', REFUSAL);
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(): Promise<T> => Promise.reject(new ApiError(503, 'PREVIEW', REFUSAL)),
  put: <T>(): Promise<T> => Promise.reject(new ApiError(503, 'PREVIEW', REFUSAL)),
  patch: <T>(): Promise<T> => Promise.reject(new ApiError(503, 'PREVIEW', REFUSAL)),
  delete: <T>(): Promise<T> => Promise.reject(new ApiError(503, 'PREVIEW', REFUSAL)),
};

/**
 * Any Employee ID and any password get in.
 *
 * There is no server here to ask, and pretending to check would be the exact
 * dishonesty this project spent its time removing. The banner says so.
 */
export async function login(identifier: string): Promise<SessionUser> {
  const id = identifier.trim().toUpperCase();
  const people = (PREVIEW_WORLD as { people: ReadonlyArray<{ id: string; name: string }> }).people;
  const person = people.find((p) => p.id === id);
  if (!person) {
    throw new ApiError(
      401,
      'UNAUTHORIZED',
      'No such Employee ID in this preview. Try MB-HR-0001, or any ID from the People screen.',
    );
  }
  return { ...ME, id: person.id, name: person.name } as SessionUser;
}

export async function logout(): Promise<void> {}

export async function bootstrapSession(): Promise<SessionUser | null> {
  return null;
}

export async function uploadPhoto(): Promise<{ photo: string }> {
  throw new ApiError(503, 'PREVIEW', REFUSAL);
}
