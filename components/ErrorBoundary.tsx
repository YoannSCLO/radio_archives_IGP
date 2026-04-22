import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { reportError } from "../services/errorReporter";

interface Props {
  children: React.ReactNode;
  /** Alternative custom à l'écran d'erreur par défaut. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportError(error, { componentStack: info.componentStack });
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset);
      return <DefaultFallback error={error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

const DefaultFallback: React.FC<{ error: Error; onReset: () => void }> = ({
  error,
  onReset,
}) => {
  return (
    <div
      role="alert"
      className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="max-w-md">
        <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
        </div>
        <h2 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">
          Une erreur inattendue est survenue
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Vos données restent sauvegardées. Vous pouvez recharger l'écran ci-dessous.
        </p>
        {import.meta.env?.DEV && (
          <pre className="text-left text-[10px] bg-slate-100 dark:bg-slate-800 rounded-xl p-3 mb-5 overflow-auto max-h-40">
            {error.message}
            {error.stack ? `\n${error.stack}` : ""}
          </pre>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Recharger l'écran
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Recharger la page
          </button>
        </div>
      </div>
    </div>
  );
};
