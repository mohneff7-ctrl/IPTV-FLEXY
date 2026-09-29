import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useT } from '../lib/i18n';
import { Empty } from './ui';

/**
 * Catches render errors so one bad item (e.g. malformed addon data) can't
 * take the whole screen down. Without it React unmounts the entire app and
 * the page goes blank.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[LAYAN] render error', error, info.componentStack);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

/** A failing row / hero simply disappears; the rest of the page keeps working. */
export function RowBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function PageError() {
  const t = useT();
  return (
    <div className="page page-pad">
      <Empty
        title={t('error')}
        action={
          <button className="btn btn-primary" onClick={() => location.reload()}>
            {t('retry')}
          </button>
        }
      />
    </div>
  );
}

/** Last line of defence around each screen: shows a retry button, never a blank page. */
export function PageBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary fallback={<PageError />}>{children}</ErrorBoundary>;
}
