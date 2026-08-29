/**
 * Who is signed in.
 *
 * Kept separate from ProcProvider because they answer different questions and
 * fail differently: a broken session means "show the login screen", a broken
 * bootstrap means "the server is unwell". Folding them together makes both
 * failures look the same to the user.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SessionUser } from '@marbella/shared';
import {
  bootstrapSession,
  login as apiLogin,
  logout as apiLogout,
  onSessionLost,
} from '../lib/api.js';

interface AuthValue {
  user: SessionUser | null;
  /** True until the first attempt to recover a session has finished. */
  checking: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth() was called outside <AuthProvider>.');
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // The access token lives in memory, so a page reload has none. The httpOnly
    // refresh cookie is still there, so this quietly gets a new one. Without
    // this, every refresh of the page would bounce the user to the login screen
    // even though their session is perfectly valid.
    void bootstrapSession().then((u) => {
      if (cancelled) return;
      setUser(u);
      setChecking(false);
    });

    // The client calls this when a refresh fails and the session cannot be
    // recovered, from anywhere in the app.
    onSessionLost(() => {
      if (!cancelled) setUser(null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await apiLogin(email, password));
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, checking, signIn, signOut }),
    [user, checking, signIn, signOut],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
