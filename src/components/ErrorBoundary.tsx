import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render-time errors anywhere in the tree and shows a branded, actionable
 * fallback instead of a blank screen (or an endless loading splash). Styled with
 * inline styles so it never depends on app CSS having loaded.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('PEM FlowMaster caught an error:', error, errorInfo);
  }

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const message = this.state.error?.message || 'An unexpected error occurred.';

    return (
      <div style={styles.screen}>
        <div style={styles.card}>
          <div style={styles.iconCircle}>
            <AlertCircle size={30} />
          </div>
          <h2 style={styles.title}>Something went wrong</h2>
          <p style={styles.message}>{message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={styles.button}
          >
            <RefreshCw size={18} /> Reload application
          </button>
        </div>
      </div>
    );
  }
}

const styles: Record<string, React.CSSProperties> = {
  screen: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: '#eef5f7',
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: '#12263a',
  },
  card: {
    maxWidth: 420,
    width: '100%',
    background: '#ffffff',
    border: '1px solid #d9e7ea',
    borderRadius: 18,
    boxShadow: '0 10px 26px rgba(18,57,52,.12)',
    padding: 28,
    textAlign: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    background: '#ffe5e5',
    color: '#9f1d1d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  title: { margin: '0 0 8px', fontWeight: 900, letterSpacing: '-0.02em' },
  message: { margin: '0 0 20px', color: '#5f7077', lineHeight: 1.45 },
  button: {
    border: 0,
    background: '#0072CE',
    color: '#ffffff',
    fontWeight: 800,
    borderRadius: 12,
    padding: '12px 18px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },
};
