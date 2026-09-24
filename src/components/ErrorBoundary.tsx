import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Frown } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="page" role="alert">
        <section className="card card--center">
          <h1>
            <Frown className="icon" aria-hidden="true" /> משהו השתבש
          </h1>
          <p className="lead">רעננו את הדף ונסו שוב. אם זה חוזר, ספרו לנו.</p>
          <button type="button" className="btn btn--primary" onClick={() => location.reload()}>
            רענון
          </button>
        </section>
      </main>
    );
  }
}
