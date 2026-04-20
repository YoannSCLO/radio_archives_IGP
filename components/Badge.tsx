
import React from 'react';

interface BadgeProps {
  label: string;
  colorClass: string;
  bgClass: string;
  dotClass?: string;
}

export const Badge: React.FC<BadgeProps> = ({ label, colorClass, bgClass, dotClass }) => {
  return (
    <span className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-sm border border-black/5 dark:border-white/5 ${bgClass} ${colorClass}`}>
      {dotClass && <span className={`mr-2.5 h-2 w-2 rounded-full ${dotClass}`}></span>}
      {label}
    </span>
  );
};
