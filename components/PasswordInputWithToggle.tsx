import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputWithToggleProps {
  /** Pour associer le `<label htmlFor>` au champ. */
  id?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  inputClass: string;
  isDark: boolean;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
}

export const PasswordInputWithToggle: React.FC<PasswordInputWithToggleProps> = ({
  id: idProp,
  value,
  onChange,
  autoComplete,
  inputClass,
  isDark,
  required,
  minLength,
  placeholder,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const fallbackId = useId();
  const id = idProp ?? fallbackId;
  const toggleLabel = showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe';

  const btnClass = `absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
    isDark
      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/80'
      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
  }`;

  return (
    <div className="relative">
      <input
        id={id}
        type={showPassword ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} pr-12`}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
      />
      <button
        type="button"
        className={btnClass}
        onClick={() => setShowPassword((s) => !s)}
        aria-label={toggleLabel}
        aria-pressed={showPassword}
      >
        {showPassword ? (
          <EyeOff className="w-[18px] h-[18px]" strokeWidth={2} aria-hidden />
        ) : (
          <Eye className="w-[18px] h-[18px]" strokeWidth={2} aria-hidden />
        )}
      </button>
    </div>
  );
};
