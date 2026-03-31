
import { Specialty, Difficulty } from './types';

export const SPECIALTY_MAP: Record<Specialty, { color: string; bg: string }> = {
  [Specialty.NEURORADIOLOGY]: { color: 'text-purple-700', bg: 'bg-purple-100' },
  [Specialty.OSTEORADIOLOGY]: { color: 'text-amber-700', bg: 'bg-amber-100' },
  [Specialty.THORACIC]: { color: 'text-blue-700', bg: 'bg-blue-100' },
  [Specialty.ABDOMINAL]: { color: 'text-emerald-700', bg: 'bg-emerald-100' },
  [Specialty.PELVIC]: { color: 'text-pink-700', bg: 'bg-pink-100' },
  [Specialty.CARDIOVASCULAR]: { color: 'text-red-700', bg: 'bg-red-100' },
  [Specialty.PEDIATRIC]: { color: 'text-cyan-700', bg: 'bg-cyan-100' },
  [Specialty.EMERGENCY]: { color: 'text-orange-700', bg: 'bg-orange-100' },
  [Specialty.ORL]: { color: 'text-indigo-700', bg: 'bg-indigo-100' },
  [Specialty.OPHTHALMOLOGY]: { color: 'text-sky-700', bg: 'bg-sky-100' },
  [Specialty.VASCULAR]: { color: 'text-rose-700', bg: 'bg-rose-100' },
  [Specialty.SENOLOGY]: { color: 'text-fuchsia-700', bg: 'bg-fuchsia-100' },
  [Specialty.UROLOGY]: { color: 'text-lime-700', bg: 'bg-lime-100' },
  [Specialty.OTHER]: { color: 'text-slate-700', bg: 'bg-slate-100' },
};

export const DIFFICULTY_MAP: Record<
  Difficulty,
  { color: string; bg: string; dot: string; bar: string }
> = {
  [Difficulty.BEGINNER]: {
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-100',
    dot: 'bg-green-500',
    bar: 'bg-green-500/90',
  },
  [Difficulty.INTERMEDIATE]: {
    color: 'text-yellow-700 dark:text-yellow-400',
    bg: 'bg-yellow-100',
    dot: 'bg-yellow-500',
    bar: 'bg-yellow-500/90',
  },
  [Difficulty.ADVANCED]: {
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-100',
    dot: 'bg-orange-500',
    bar: 'bg-orange-500/90',
  },
  [Difficulty.EXPERT]: {
    color: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-100',
    dot: 'bg-rose-500',
    bar: 'bg-rose-500/90',
  },
};
