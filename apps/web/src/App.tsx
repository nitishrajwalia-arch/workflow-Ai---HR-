/**
 * Marbella — the application shell.
 *
 *   ErrorBoundary        one screen crashing must not white-page the system
 *   AuthProvider         who is signed in
 *   ProcurementProvider  fetches the world, exposes it as ProcCtx
 *   Shell                the UI, essentially unmodified
 *
 * The desk a person sees comes from `user.userKey`, which the SERVER decides.
 * See src/legacy/PATCHES-PROCUREMENT.md for the eight edits to the UI file and
 * why each one exists.
 */

import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthProvider.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ProcurementProvider } from './proc/ProcurementProvider.js';
import {
  Assistant,
  Login,
  Shell,
  ThemeCtx,
  Toaster,
  applyPassport,
  toast,
} from './legacy/MarbellaProcurementOS.jsx';

function SignedIn() {
  const { user, signOut } = useAuth();
  const [themeKey, setThemeKeyRaw] = useState('marbella');
  const setThemeKey = (k: string) => {
    applyPassport(k);
    setThemeKeyRaw(k);
  };

  return (
    // The legacy default is `setThemeKey: () => {}`, so TypeScript infers a
    // zero-argument function from it. The real one takes the passport key.
    <ThemeCtx.Provider value={{ themeKey, setThemeKey } as never}>
      <ProcurementProvider toast={toast as (m: string, tone?: string) => void}>
        <div key={themeKey} style={{ minHeight: '100vh' }}>
          {/* The desk is the server's answer, not the browser's choice. */}
          <Shell userKey={user!.userKey} onLogout={() => void signOut()} />
          <Assistant />
        </div>
        <Toaster />
      </ProcurementProvider>
    </ThemeCtx.Provider>
  );
}

function Gate() {
  const { user, checking, signIn } = useAuth();

  // Without this the login screen flashes on every page load while the refresh
  // cookie is exchanged, which reads to a user as "it logged me out again".
  if (checking) {
    return (
      <div className="mb-centre">
        <div className="mb-centre-card">
          <h1>Marbella</h1>
          <p>Checking your session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {/* `signIn` throws with the server's own message; Login shows it. */}
        <Login onLogin={signIn} />
        <Toaster />
      </>
    );
  }
  return <SignedIn />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ErrorBoundary>
  );
}
