/**
 * The application shell.
 *
 * Three layers, each with one job:
 *
 *   ErrorBoundary  — one screen crashing must not white-page the whole system.
 *   AuthProvider   — who is signed in; shows the login screen when nobody is.
 *   ProcProvider   — fetches the world once and exposes it as the context the
 *                    existing 7,300-line UI already reads from.
 *
 * Inside those sits HRShell, which is that UI, essentially unmodified. See
 * src/legacy/PATCHES.md for the five small edits and why each one exists.
 */

import { ProcProvider } from './proc/ProcProvider.js';
import { AuthProvider, useAuth } from './auth/AuthProvider.js';
import { LoginPage } from './auth/LoginPage.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
/* The legacy file is plain JavaScript. `allowJs` lets it be imported and
   `checkJs: false` leaves it untyped, which is deliberate: it is 7,300 lines of
   working, reviewed code, and annotating it is a separate project from getting
   it onto a live server. */
import { HRShell, Toaster, toast } from './legacy/MarbellaHR.jsx';

function SignedIn() {
  const { user, signOut } = useAuth();

  return (
    <ProcProvider toast={toast as (m: string, tone?: string) => void}>
      <div className="mb-app">
        <div className="mb-topbar">
          <span className="mb-topbar-who">
            {user?.name} · {user?.role}
          </span>
          <button type="button" className="mb-signout" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
        <HRShell />
      </div>
      <Toaster />
    </ProcProvider>
  );
}

function Gate() {
  const { user, checking } = useAuth();

  // Without this the login screen flashes on every page load while the refresh
  // cookie is being exchanged, which reads as "it logged me out again".
  if (checking) {
    return (
      <div className="mb-centre">
        <div className="mb-centre-card">
          <h1>Marbella HR</h1>
          <p>Checking your session…</p>
        </div>
      </div>
    );
  }

  return user ? <SignedIn /> : <LoginPage />;
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
