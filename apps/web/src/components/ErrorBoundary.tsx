/**
 * The last line of defence.
 *
 * Without this, one thrown error in one screen unmounts the entire React tree
 * and the user is left staring at a white page with no idea what happened and
 * nothing to click. With it they get an explanation and a way out.
 *
 * Still a class component: React has no hook equivalent of componentDidCatch.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Replace this with a call to your error reporter when you add one.
    console.error('A screen crashed:', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mb-centre">
        <div className="mb-centre-card">
          <h1>Something went wrong on this screen</h1>
          <p>
            The rest of the system is unaffected and nothing has been lost. Reloading will usually
            clear it.
          </p>
          <pre className="mb-error-detail">{error.message}</pre>
          <button type="button" className="mb-button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
