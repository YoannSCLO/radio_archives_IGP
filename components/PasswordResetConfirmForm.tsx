import React, { useId, useState } from "react";
import { LayoutDashboard, ShieldCheck } from "lucide-react";
import { confirmPasswordReset } from "../services/authService";
import { PasswordInputWithToggle } from "./PasswordInputWithToggle";

interface Props {
  token: string;
  onSuccess: () => void;
  isDark: boolean;
}

type Status = "idle" | "loading" | "ok" | "weak" | "invalid" | "mismatch" | "error";

export const PasswordResetConfirmForm: React.FC<Props> = ({
  token,
  onSuccess,
  isDark,
}) => {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const pwId = useId();
  const confirmId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) {
      setStatus("weak");
      return;
    }
    if (pw !== confirm) {
      setStatus("mismatch");
      return;
    }
    setStatus("loading");
    const out = await confirmPasswordReset(token, pw);
    if (out === "ok") {
      setStatus("ok");
      window.setTimeout(onSuccess, 800);
      return;
    }
    setStatus(out === "weak" ? "weak" : out === "invalid" ? "invalid" : "error");
  };

  const inputClass = `w-full px-4 py-3 rounded-xl border outline-none transition-all text-sm ${
    isDark
      ? "bg-slate-800 border-slate-600 text-white placeholder-slate-500"
      : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"
  }`;

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-6 ${
        isDark ? "bg-[#020617]" : "bg-slate-100"
      }`}
    >
      <div className="flex items-center justify-center gap-3 mb-10">
        <div className="w-12 h-12 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center">
          <LayoutDashboard className="w-6 h-6 text-white dark:text-slate-900" />
        </div>
        <div className="flex flex-col -space-y-1">
          <span className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">
            RADIO
          </span>
          <span className="text-xs font-medium tracking-[0.25em] text-blue-600 uppercase">
            Archive
          </span>
        </div>
      </div>
      <div
        className={`w-full max-w-md p-10 rounded-[2rem] shadow-xl border ${
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <h1
          className={`text-xl font-bold text-center mb-2 ${
            isDark ? "text-white" : "text-slate-800"
          }`}
        >
          Nouveau mot de passe
        </h1>
        <p
          className={`text-xs text-center mb-6 ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          Choisissez un nouveau mot de passe d'au moins 8 caractères.
        </p>
        {status === "ok" && (
          <div
            role="status"
            className="mb-5 inline-flex items-center gap-2 w-full justify-center rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-700/40 text-emerald-800 dark:text-emerald-200 text-xs px-3 py-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Mot de passe mis à jour. Redirection…
          </div>
        )}
        {(status === "invalid" || status === "error") && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-700/40 text-rose-700 dark:text-rose-300 text-xs px-3 py-2"
          >
            {status === "invalid"
              ? "Ce lien de réinitialisation est invalide ou déjà utilisé. Demandez-en un nouveau."
              : "Une erreur est survenue. Réessayez dans un instant."}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor={pwId}
              className={`block text-[11px] font-bold uppercase tracking-widest mb-2 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Nouveau mot de passe
            </label>
            <PasswordInputWithToggle
              id={pwId}
              value={pw}
              onChange={setPw}
              autoComplete="new-password"
              inputClass={inputClass}
              isDark={isDark}
              required
            />
          </div>
          <div>
            <label
              htmlFor={confirmId}
              className={`block text-[11px] font-bold uppercase tracking-widest mb-2 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Confirmation
            </label>
            <PasswordInputWithToggle
              id={confirmId}
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              inputClass={inputClass}
              isDark={isDark}
              required
            />
          </div>
          {status === "weak" && (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              Le mot de passe doit contenir au moins 8 caractères.
            </p>
          )}
          {status === "mismatch" && (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              La confirmation ne correspond pas.
            </p>
          )}
          <button
            type="submit"
            disabled={status === "loading" || status === "ok"}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50 transition-all"
          >
            {status === "loading" ? "Mise à jour…" : "Définir le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );
};
