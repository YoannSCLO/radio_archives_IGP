import React, { useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { register } from '../services/authService';

interface RegisterFormProps {
  onSuccess: () => void;
  onBack: () => void;
  isDark: boolean;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onBack,
  isDark,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ok = await register(email, password);
      if (ok) onSuccess();
      else setError('Impossible de créer le compte (e-mail déjà utilisé ou mot de passe trop court).');
    } catch {
      setError('Erreur réseau. Réessayez.');
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
          Créer un compte
        </h1>
        <p className={`text-xs text-center mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Un compte distinct par utilisateur. Mot de passe : au moins 8 caractères.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-[11px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              E-mail
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={`block text-[11px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Mot de passe
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              minLength={8}
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
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="w-full py-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          >
            ← Retour à la connexion
          </button>
        </form>
      </div>
    </div>
  );
};
