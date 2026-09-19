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
import { currentSession, rememberSession, type PreviewSession } from './desk.js';
import { MANAGEMENT_ID, deskFor } from './desks.js';

interface PreviewPerson {
  id: string;
  name: string;
  designation: string;
}

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
// which this file is standing in for. Without it the shell has no desk. The
// desk is decided by the Employee ID that was signed in with. In the product
// this is the server's decision and the browser cannot touch it; see
// preview/desk.ts.
/**
 * Who is signed in, for both `/auth/me` and the `me` block of `/bootstrap`.
 *
 * The bootstrap payload carries a fixed `me` — whichever account the seed
 * created — so returning it unchanged put the HR manager's name in the sidebar
 * of every desk, whoever had just signed in.
 */
const me = (): SessionUser => {
  const s = currentSession();
  const base = (PREVIEW_WORLD as { me: SessionUser }).me;
  return {
    ...base,
    id: s.id || base.id,
    name: s.name,
    title: s.title,
    personId: s.personId,
    userKey: s.desk,
  } as SessionUser;
};

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
  // `me` is overwritten, not passed through: it is the signed-in desk, and the
  // sidebar, the header clock and every "you" on screen read it from here.
  if (path.startsWith('/bootstrap')) return { ...PREVIEW_WORLD, me: me() } as unknown as T;
  if (path.startsWith('/auth/me')) return me() as unknown as T;
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
 * dishonesty this project spent its time removing. The sign-in screen says so.
 *
 * The desk that comes back is derived from the ID, which is the nearest this
 * build can get to the product, where the SERVER decides it and the browser
 * cannot touch it.
 */
export async function login(identifier: string): Promise<SessionUser> {
  const id = identifier.trim().toUpperCase();
  const desk = deskFor(id);

  const enter = (s: PreviewSession): SessionUser => {
    rememberSession(s);
    return me();
  };

  // Two desks open as nobody in particular. Management is not on the payroll
  // register, and no security staff are on the roster at all, so neither has an
  // employee record to sign in as — and inventing one would put a person on the
  // headcount who does not exist.
  if (id === MANAGEMENT_ID)
    return enter({ desk, id, name: 'Management', title: 'Management', personId: null });
  if (id === 'GATE') return enter({ desk, id, name: 'Gate', title: 'Gate', personId: null });

  const people = (PREVIEW_WORLD as { people: PreviewPerson[] }).people;
  const person = people.find((p) => p.id === id);
  if (!person) {
    throw new ApiError(
      401,
      'UNAUTHORIZED',
      'No such Employee ID in this preview. Tap a desk below, or use any ID from the People screen.',
    );
  }
  return enter({
    desk,
    id: person.id,
    name: person.name,
    title: person.designation,
    personId: person.id,
  });
}

export async function logout(): Promise<void> {}

export async function bootstrapSession(): Promise<SessionUser | null> {
  return null;
}

export async function uploadPhoto(): Promise<{ photo: string }> {
  throw new ApiError(503, 'PREVIEW', REFUSAL);
}
