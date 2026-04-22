import React, { useId, useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { login } from '../services/authService';
import { PasswordInputWithToggle } from './PasswordInputWithToggle';

interface LoginFormProps {
  onSuccess: () => void;
  isDark: boolean;
  /** Si défini, affiche un lien vers l’inscription publique (multi-utilisateurs). */
  onGoRegister?: () => void;
  /** Si défini, affiche un lien vers la demande de réinitialisation de mot de passe. */
  onForgotPassword?: () => void;
  /** Message d’aide si l’inscription n’est pas encore activable (config incomplète). */
  registrationHint?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  isDark,
  onGoRegister,
  onForgotPassword,
  registrationHint,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const passwordFieldId = useId();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const out = await login(username, password);
      if (out === "ok") onSuccess();
      else if (out === "pending") {
        setError(
          "Votre compte est en attente de validation par un administrateur. Vous ne pouvez pas encore vous connecter."
        );
      } else {
        setError("Identifiant ou mot de passe incorrect.");
      }
    } catch {
      setError('Connexion impossible. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `w-full px-4 py-3 rounded-xl border outline-none transition-all text-sm ${
    isDark
      ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
  }`;

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${isDark ? 'bg-[#020617]' : 'bg-slate-100'}`}>
      <div className="flex items-center justify-center gap-3 mb-10">
        <div className="w-12 h-12 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center">
          <LayoutDashboard className="w-6 h-6 text-white dark:text-slate-900" />
        </div>
        <div className="flex flex-col -space-y-1">
          <span className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">RADIO</span>
          <span className="text-xs font-medium tracking-[0.25em] text-blue-600 uppercase">Archive</span>
        </div>
      </div>
      <div
        className={`w-full max-w-md p-10 rounded-[2rem] shadow-xl border ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <h1 className={`text-xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Connexion
        </h1>
        <p className={`text-xs text-center mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {onGoRegister
            ? 'Créez un compte avec votre e-mail professionnel, ou connectez-vous si vous en avez déjà un.'
            : 'Accès réservé — l’identifiant (souvent un e-mail pro) et le mot de passe sont ceux configurés côté serveur (fichier d’environnement).'}
        </p>
        {registrationHint && (
          <p
            className={`text-xs text-center mb-6 rounded-xl px-3 py-2 border ${
              isDark
                ? 'text-amber-200/90 border-amber-700/50 bg-amber-950/40'
                : 'text-amber-900 border-amber-200 bg-amber-50'
            }`}
          >
            {registrationHint}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-[11px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Identifiant (e-mail ou login)
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              placeholder="ex. prenom.nom@etablissement.fr"
              required
            />
          </div>
          <div>
            <label
              htmlFor={passwordFieldId}
              className={`block text-[11px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
            >
              Mot de passe
            </label>
            <PasswordInputWithToggle
              id={passwordFieldId}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              inputClass={inputClass}
              isDark={isDark}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400 text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50 transition-all"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
          {onGoRegister && (
            <button
              type="button"
              onClick={onGoRegister}
              className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              Créer un compte
            </button>
          )}
          {onForgotPassword && (
            <button
              type="button"
              onClick={onForgotPassword}
              className="w-full py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
            >
              Mot de passe oublié&nbsp;?
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
