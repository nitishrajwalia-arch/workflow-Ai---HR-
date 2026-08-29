/**
 * The API client.
 *
 * Three decisions worth understanding before you change anything here.
 *
 * 1. THE ACCESS TOKEN LIVES IN MEMORY, NOT localStorage.
 *    Anything in localStorage is readable by any script that manages to run on
 *    the page. A token in a module variable dies with the tab, which means a
 *    cross-site scripting bug steals a session that ends when the tab closes
 *    rather than one that lasts a week. The cost is that a refresh of the page
 *    needs a silent re-auth, which is what `bootstrapSession` below does using
 *    the httpOnly refresh cookie the browser holds and JavaScript cannot read.
 *
 * 2. A 401 IS RETRIED EXACTLY ONCE, AND CONCURRENT 401s SHARE ONE REFRESH.
 *    Ten requests firing at the moment a token expires must not trigger ten
 *    refreshes: refresh tokens rotate, so nine of those ten would present an
 *    already-spent token and the server would — correctly — end every session.
 *    `refreshInFlight` makes them all wait on the same promise.
 *
 * 3. EVERY ERROR BECOMES AN ApiError WITH THE SERVER'S OWN MESSAGE.
 *    The API writes its messages for people to read. Replacing them with
 *    "Request failed" in the client throws away the useful half.
 */

import type { AuthTokens, SessionUser } from '@marbella/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Array<{ path: string; message: string }>;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Array<{ path: string; message: string }> = [],
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    if (requestId) this.requestId = requestId;
  }

  /** One string a toast can show, including the field-level detail. */
  get full(): string {
    if (!this.details.length) return this.message;
    return `${this.message}\n${this.details.map((d) => `• ${d.message}`).join('\n')}`;
  }

  /** True when this is the server refusing, rather than the network failing. */
  get isServerRefusal(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

/** Same-origin by default: Vite proxies /api in dev, the reverse proxy does in production. */
const BASE = import.meta.env.VITE_API_URL ?? '';

let accessToken: string | null = null;
let onSignedOut: (() => void) | null = null;

export const setAccessToken = (t: string | null): void => {
  accessToken = t;
};
export const getAccessToken = (): string | null => accessToken;

/** Called when the session cannot be recovered, so the UI can show the login screen. */
export const onSessionLost = (fn: () => void): void => {
  onSignedOut = fn;
};

let refreshInFlight: Promise<boolean> | null = null;

/** Exchange the refresh cookie for a new access token. At most one at a time. */
async function refresh(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        // An empty object, not an empty body: a body-less POST arrives as null
        // and fails the schema.
        body: '{}',
      });
      if (!res.ok) return false;
      const data = (await res.json()) as AuthTokens;
      accessToken = data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so everyone awaiting this attempt sees its
      // result before a new one can start.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();
  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Set internally to stop a refresh loop. */
  retrying?: boolean;
  /**
   * Do not treat a 401 as an expired token.
   *
   * The login route MUST set this. A 401 there means "that password is wrong",
   * and running it through the refresh path would swallow the server's message
   * and show "your session has ended" to someone who never had a session — the
   * single most confusing thing this client could say.
   */
  noAuthRetry?: boolean;
  signal?: AbortSignal;
}

async function toApiError(res: Response): Promise<ApiError> {
  let code = 'HTTP_ERROR';
  let message = `The server answered ${res.status}.`;
  let details: Array<{ path: string; message: string }> = [];
  let requestId: string | undefined;

  try {
    const body = (await res.json()) as {
      error?: {
        code?: string;
        message?: string;
        details?: Array<{ path: string; message: string }>;
        requestId?: string;
      };
    };
    if (body.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      details = body.error.details ?? [];
      requestId = body.error.requestId;
    }
  } catch {
    // A non-JSON error body (a proxy's HTML 502, say). Keep the generic message.
  }
  return new ApiError(res.status, code, message, details, requestId);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, retrying = false, noAuthRetry = false, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers,
      credentials: 'include',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    // The request never reached a server. Say that, rather than blaming it.
    throw new ApiError(
      0,
      'NETWORK',
      'Could not reach the server. Check the connection and try again.',
    );
  }

  if (res.status === 401 && !retrying && !noAuthRetry) {
    if (await refresh()) return request<T>(path, { ...options, retrying: true });
    accessToken = null;
    onSignedOut?.();
    throw new ApiError(401, 'UNAUTHORIZED', 'Your session has ended. Sign in again.');
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, signal ? { signal } : {}),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/* ------------------------------------------------------------------- auth */

export async function login(email: string, password: string): Promise<SessionUser> {
  const data = await request<AuthTokens>('/auth/login', {
    method: 'POST',
    body: { email, password },
    // A 401 here is a wrong password, not an expired token. Let the server's
    // own wording reach the screen.
    noAuthRetry: true,
  });
  accessToken = data.accessToken;
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await request('/auth/logout', { method: 'POST' });
  } finally {
    accessToken = null;
  }
}

/**
 * Recover a session on a page load, using the refresh cookie.
 * Returns null when there is no session to recover — which is not an error.
 */
export async function bootstrapSession(): Promise<SessionUser | null> {
  if (!(await refresh())) return null;
  try {
    return await request<SessionUser>('/auth/me');
  } catch {
    return null;
  }
}

/** Upload a photo. Multipart, so it does not go through `request`. */
export async function uploadPhoto(personId: string, file: File): Promise<{ photo: string }> {
  const form = new FormData();
  form.append('file', file);

  const send = async (): Promise<Response> =>
    fetch(`${BASE}/api/v1/people/${personId}/photo`, {
      method: 'POST',
      credentials: 'include',
      // No content-type: the browser must set the multipart boundary itself.
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });

  let res = await send();
  if (res.status === 401 && (await refresh())) res = await send();
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as { photo: string };
}
