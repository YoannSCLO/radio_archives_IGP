/**
 * Logger JSON structuré minimaliste. Chaque ligne = un événement agrégeable
 * par Vercel / Datadog / Logtail. Les erreurs sérialisent nom + message + stack.
 * Branchement Sentry : wrapper ici via `setExternalReporter`.
 */

export type LogLevel = "info" | "warn" | "error";

let externalReporter: ((level: LogLevel, payload: Record<string, unknown>) => void) | null = null;

export function setExternalReporter(
  fn: ((level: LogLevel, payload: Record<string, unknown>) => void) | null
): void {
  externalReporter = fn;
}

function emit(level: LogLevel, payload: Record<string, unknown>): void {
  const line = JSON.stringify({ level, t: new Date().toISOString(), ...payload });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  if (externalReporter) {
    try {
      externalReporter(level, payload);
    } catch {
      /* swallow reporter failures */
    }
  }
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { value: String(err) };
}

export const log = {
  info: (msg: string, ctx?: Record<string, unknown>) =>
    emit("info", { msg, ...(ctx ?? {}) }),
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    emit("warn", { msg, ...(ctx ?? {}) }),
  error: (msg: string, err: unknown, ctx?: Record<string, unknown>) =>
    emit("error", { msg, err: serializeError(err), ...(ctx ?? {}) }),
};

export function newRequestId(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  );
}
