/**
 * Hook d'instrumentation pour un service externe (Sentry, Datadog RUM, …).
 * Branche `setErrorReporter(fn)` au bootstrap dès qu'un DSN est disponible.
 * En dev, les erreurs sont aussi renvoyées dans la console.
 */

export type ErrorContext = Record<string, unknown>;
export type ErrorReporterFn = (err: unknown, ctx?: ErrorContext) => void;

let reporter: ErrorReporterFn | null = null;

export function setErrorReporter(fn: ErrorReporterFn | null): void {
  reporter = fn;
}

export function reportError(err: unknown, ctx?: ErrorContext): void {
  if (reporter) {
    try {
      reporter(err, ctx);
    } catch {
      /* un reporter qui crash ne doit jamais casser l'app */
    }
  }
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.error("[reportError]", err, ctx);
  }
}

export function installGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    reportError(e.error ?? new Error(e.message), {
      source: "window.error",
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    reportError(e.reason, { source: "unhandledrejection" });
  });
}
