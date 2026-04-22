import React, { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { requestPasswordReset } from "../services/authService";

interface Props {
  onBack: () => void;
  isDark: boolean;
  /** Pré-rempli si l'utilisateur venait du formulaire de login. */
  defaultEmail?: string;
}

type Status = "idle" | "loading" | "sent" | "unsupported" | "error";

export const PasswordResetRequestForm: React.FC<Props> = ({
  onBack,
  isDark,
  defaultEmail,
}) => {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [status, setStatus] = useState<Status>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    const out = await requestPasswordReset(email.trim());
    if (out === "ok") setStatus("sent");
    else if (out === "unsupported") setStatus("unsupported");
    else setStatus("error");
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
      <div
        className={`w-full max-w-md p-10 rounded-[2rem] shadow-xl border ${
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour à la connexion
        </button>
        <h1
          className={`text-xl font-bold mb-2 ${
            isDark ? "text-white" : "text-slate-800"
          }`}
        >
          Mot de passe oublié
        </h1>
        <p
          className={`text-xs mb-6 ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          Saisissez votre e-mail professionnel. Si un compte validé existe, un lien de réinitialisation vous sera envoyé (valable 1 heure).
        </p>
        {status === "sent" && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-700/40 text-emerald-800 dark:text-emerald-200 text-xs px-3 py-2"
          >
            Si cette adresse est enregistrée, un e-mail vient d'être envoyé. Vérifiez votre boîte de réception (et les spams).
          </div>
        )}
        {status === "unsupported" && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700/40 text-amber-800 dark:text-amber-200 text-xs px-3 py-2"
          >
            La réinitialisation n'est disponible qu'en mode multi-utilisateurs (PostgreSQL). Contactez un administrateur.
          </div>
        )}
        {status === "error" && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-700/40 text-rose-700 dark:text-rose-300 text-xs px-3 py-2"
          >
            Une erreur est survenue. Réessayez dans un instant.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className={`block text-[11px] font-bold uppercase tracking-widest mb-2 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              E-mail
            </label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="prenom.nom@etablissement.fr"
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading" || !email.trim()}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50 transition-all inline-flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {status === "loading" ? "Envoi…" : "Envoyer le lien"}
          </button>
        </form>
      </div>
    </div>
  );
};
