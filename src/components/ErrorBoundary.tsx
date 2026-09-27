import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Stops one broken piece of UI (usually odd data from an addon) from
 * blanking the whole screen. `silent` boundaries just hide the piece.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; silent?: boolean; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FLEXY] UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.silent) return null;
    return this.props.fallback ?? null;
  }
}
