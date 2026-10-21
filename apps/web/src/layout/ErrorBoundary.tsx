import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** When this changes (the page's path), a caught error is cleared and the children are tried again. */
  resetKey?: unknown;
  /** Reloads the app; the default is a full page reload (a fresh index.html picks up the current build). */
  onReload?: () => void;
}

interface State { error: Error | null; key: unknown }

/**
 * Catches a page that fails to render, such as a lazy page whose code can't be fetched (a stale index.html after a
 * deploy, or no network), and offers a reload instead of a blank app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Page failed to load', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const reload = this.props.onReload ?? (() => window.location.reload());
    return (
      <section role="alert">
        <p>Couldn't load this page.</p>
        <button type="button" className="btn" onClick={reload}>
          Reload
        </button>
      </section>
    );
  }
}
