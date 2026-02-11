import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
          <h2>Ops! Algo deu errado ao carregar seus treinos.</h2>
          <p>Tente recarregar a página. Se o erro persistir, contate seu personal.</p>
          <details style={{ marginTop: 20, textAlign: 'left', background: '#f8fafc', padding: 10, borderRadius: 8, overflow: 'auto' }}>
            <summary>Detalhes do erro</summary>
            <pre style={{ fontSize: '0.8rem' }}>{this.state.error?.toString()}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
