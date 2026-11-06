import { Component, lazy, type ComponentType, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Changing this key clears the error (e.g. the route path). */
  resetKey?: string;
  /** Full-screen fallback for the app root; inline card for a page. */
  fullScreen?: boolean;
}

interface State {
  error: Error | null;
}

/** Shows what went wrong instead of unmounting the whole app to a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[DG Catalyst] UI error:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkError(error);
    return (
      <div className={this.props.fullScreen ? 'flex min-h-screen items-center justify-center bg-bg p-6' : 'py-10'}>
        <div role="alert" className="mx-auto w-full max-w-lg rounded-lg border border-danger/30 bg-surface p-5">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-fg">{chunk ? 'This page failed to load' : 'Something went wrong on this page'}</p>
              <p className="mt-1 text-sm text-muted">
                {chunk ? 'The app was updated while it was open. Reload to get the latest version.' : 'The rest of the portal still works. Reload, or reset the demo data if the problem continues.'}
              </p>
              <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-surface-2 p-2.5 font-mono text-[11.5px] text-danger">{error.message}</pre>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => window.location.reload()} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-fg hover:bg-primary-hover">
                  <RotateCcw className="h-3.5 w-3.5" /> Reload
                </button>
                <button
                  onClick={() => {
                    try {
                      Object.keys(localStorage).filter((k) => k.startsWith('dgc.')).forEach((k) => localStorage.removeItem(k));
                    } catch {
                      /* storage unavailable */
                    }
                    window.location.assign('/');
                  }}
                  className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm text-fg hover:bg-surface-2"
                >
                  Reset demo data and sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

function isChunkError(e: Error) {
  return /dynamically imported module|Importing a module script failed|Outdated Optimize Dep|Failed to fetch|ChunkLoadError/i.test(e.message);
}

/**
 * React.lazy with one automatic page reload when a chunk fails to load
 * (stale dev-server optimisation or a redeploy). A session flag prevents loops.
 */
export function lazyPage<T extends ComponentType<unknown>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await load();
      sessionStorage.removeItem('dgc.chunk-retry');
      return mod;
    } catch (err) {
      if (err instanceof Error && isChunkError(err) && !sessionStorage.getItem('dgc.chunk-retry')) {
        sessionStorage.setItem('dgc.chunk-retry', '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => {}); // wait for the reload
      }
      throw err;
    }
  });
}
