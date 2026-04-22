import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import { AlertTriangle, Check, Info, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  kind: ToastKind;
  title: string;
  message?: string;
  /** Durée en ms avant fermeture auto. `0` = manuel uniquement. Défaut 5000. */
  durationMs?: number;
  /** Bouton d'action (ex. « Annuler » pour soft-delete). */
  action?: { label: string; run: () => void };
}

interface Toast extends ToastOptions {
  id: string;
}

type Action = { type: "push"; toast: Toast } | { type: "dismiss"; id: string };

function reducer(state: Toast[], action: Action): Toast[] {
  if (action.type === "push") return [...state, action.toast];
  return state.filter((t) => t.id !== action.id);
}

interface ToastApi {
  push: (t: ToastOptions) => string;
  dismiss: (id: string) => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast doit être utilisé à l'intérieur de <ToastProvider>");
  return ctx;
}

let nextId = 0;
function makeId(): string {
  nextId += 1;
  return `t-${Date.now().toString(36)}-${nextId}`;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, dispatch] = useReducer(reducer, [] as Toast[]);

  const push = useCallback((t: ToastOptions): string => {
    const id = makeId();
    dispatch({ type: "push", toast: { ...t, id } });
    return id;
  }, []);

  const dismiss = useCallback((id: string): void => {
    dispatch({ type: "dismiss", id });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      dismiss,
      success: (title, message) => push({ kind: "success", title, message }),
      error: (title, message) => push({ kind: "error", title, message, durationMs: 8000 }),
      info: (title, message) => push({ kind: "info", title, message }),
      warning: (title, message) => push({ kind: "warning", title, message }),
    }),
    [push, dismiss]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
};

const KIND_STYLES: Record<ToastKind, { bg: string; icon: React.ReactNode }> = {
  success: {
    bg: "bg-emerald-600 text-white",
    icon: <Check className="w-4 h-4" />,
  },
  error: {
    bg: "bg-rose-600 text-white",
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  warning: {
    bg: "bg-amber-500 text-white",
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  info: {
    bg: "bg-slate-800 text-white",
    icon: <Info className="w-4 h-4" />,
  },
};

const ToastItem: React.FC<{ t: Toast; onDismiss: () => void }> = ({ t, onDismiss }) => {
  useEffect(() => {
    const d = t.durationMs ?? 5000;
    if (d <= 0) return;
    const handle = window.setTimeout(onDismiss, d);
    return () => window.clearTimeout(handle);
  }, [t.durationMs, onDismiss]);

  const { bg, icon } = KIND_STYLES[t.kind];

  return (
    <div
      role={t.kind === "error" ? "alert" : "status"}
      className={`pointer-events-auto rounded-2xl shadow-xl px-4 py-3 flex items-start gap-3 ${bg}`}
    >
      <div className="shrink-0 pt-0.5">{icon}</div>
      <div className="flex-1 text-sm min-w-0">
        <div className="font-bold leading-snug">{t.title}</div>
        {t.message && <div className="text-white/90 text-xs mt-0.5 break-words">{t.message}</div>}
      </div>
      {t.action && (
        <button
          onClick={() => {
            t.action!.run();
            onDismiss();
          }}
          className="font-bold text-xs underline underline-offset-2 whitespace-nowrap hover:opacity-90"
        >
          {t.action.label}
        </button>
      )}
      <button
        aria-label="Fermer"
        onClick={onDismiss}
        className="opacity-70 hover:opacity-100 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
