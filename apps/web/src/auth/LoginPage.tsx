/**
 * The sign-in screen.
 *
 * Deliberately plain. It says what went wrong in the server's own words rather
 * than "Login failed", and it never hints at whether an address is one we know:
 * the API answers identically either way, and undoing that here would waste it.
 */

import { useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api.js';
import { useAuth } from './AuthProvider.js';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not reach the server. Check the connection.',
      );
      setBusy(false);
    }
  };

  return (
    <div className="mb-centre">
      <form className="mb-login" onSubmit={submit}>
        <div className="mb-login-mark">MARBELLA</div>
        <h1>People system</h1>
        <p className="mb-login-sub">Sign in with the account HR set up for you.</p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          autoFocus
          disabled={busy}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          disabled={busy}
        />

        {error && (
          <div className="mb-login-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="mb-button" disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="mb-login-foot">
          Forgotten it? An administrator can reset it. There is no self-service reset, on purpose:
          this system holds staff records.
        </p>
      </form>
    </div>
  );
}
