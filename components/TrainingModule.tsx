
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { RadioCase, Specialty, Difficulty } from '../types';
import { SPECIALTY_MAP, DIFFICULTY_MAP } from '../constants';
import { Badge } from './Badge';
import { MedicalStackViewer } from './MedicalStackViewer';
import {
  GraduationCap, X, ChevronRight, Check, AlertCircle,
  Trophy, RotateCcw, Target, BookOpen, Eye, PenLine,
  Shuffle, Award, Zap, SkipForward, Play,
  ThumbsUp, ThumbsDown, BarChart3, Clock, CheckCircle2,
  XCircle, Minus, ArrowRight,
} from 'lucide-react';

type TrainingMode = 'quiz' | 'explore';
type TrainingScreen = 'setup' | 'question' | 'summary';

interface TrainingAnswer {
  caseId: string;
  caseCode: string;
  specialty: Specialty;
  difficulty: Difficulty;
  userAnswer: string;
  correctAnswer: string;
  selfMarkedCorrect: boolean | null;
  skipped: boolean;
}

interface Props {
  cases: RadioCase[];
  onClose: () => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}min ${s}s` : `${m}min`;
}

function getScoreLabel(pct: number): { label: string; color: string } {
  if (pct >= 90) return { label: 'Excellent !', color: 'text-emerald-400' };
  if (pct >= 75) return { label: 'Très bien', color: 'text-blue-400' };
  if (pct >= 60) return { label: 'Bien', color: 'text-cyan-400' };
  if (pct >= 40) return { label: 'En progression', color: 'text-amber-400' };
  return { label: 'Continue à pratiquer', color: 'text-slate-400' };
}

const CASE_COUNTS = [5, 10, 20, -1] as const;
const CASE_COUNT_LABELS: Record<number, string> = { 5: '5', 10: '10', 20: '20', [-1]: 'Tous' };

export const TrainingModule: React.FC<Props> = ({ cases, onClose }) => {
  // ── setup state ──────────────────────────────────────────────
  const [screen, setScreen] = useState<TrainingScreen>('setup');
  const [mode, setMode] = useState<TrainingMode>('quiz');
  const [selectedSpecialties, setSelectedSpecialties] = useState<Set<Specialty>>(new Set());
  const [selectedDifficulties, setSelectedDifficulties] = useState<Set<Difficulty>>(new Set());
  const [caseCount, setCaseCount] = useState<number>(10);

  // ── session state ─────────────────────────────────────────────
  const [sessionCases, setSessionCases] = useState<RadioCase[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [answers, setAnswers] = useState<TrainingAnswer[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [reviewCaseIdx, setReviewCaseIdx] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── derived ───────────────────────────────────────────────────
  const filteredPool = useMemo(() => {
    return cases.filter(c => {
      const specOk = selectedSpecialties.size === 0 || selectedSpecialties.has(c.specialty);
      const diffOk = selectedDifficulties.size === 0 || selectedDifficulties.has(c.difficulty);
      return specOk && diffOk;
    });
  }, [cases, selectedSpecialties, selectedDifficulties]);

  const availableCount = caseCount === -1 ? filteredPool.length : Math.min(caseCount, filteredPool.length);
  const currentCase = sessionCases[currentIdx];
  const isLastCase = currentIdx === sessionCases.length - 1;
  const currentAnswer = answers.find(a => a.caseId === currentCase?.id);
  const score = answers.filter(a => a.selfMarkedCorrect === true).length;
  const answeredNonSkipped = answers.filter(a => !a.skipped);
  const scorePercent = answeredNonSkipped.length > 0 ? Math.round((score / answeredNonSkipped.length) * 100) : 0;
  const totalDuration = endTime && startTime ? Math.round((endTime - startTime) / 1000) : 0;

  // ── handlers ──────────────────────────────────────────────────
  const toggleSpecialty = (s: Specialty) =>
    setSelectedSpecialties(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  const toggleDifficulty = (d: Difficulty) =>
    setSelectedDifficulties(prev => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });

  const startSession = useCallback(() => {
    if (availableCount === 0) return;
    const shuffled = shuffleArray(filteredPool);
    const selected = caseCount === -1 ? shuffled : shuffled.slice(0, caseCount);
    setSessionCases(selected);
    setCurrentIdx(0);
    setAnswers([]);
    setUserAnswer('');
    setIsRevealed(false);
    setStartTime(Date.now());
    setScreen('question');
    setTimeout(() => textareaRef.current?.focus(), 200);
  }, [availableCount, filteredPool, caseCount]);

  const handleReveal = () => {
    setIsRevealed(true);
    if (mode === 'explore' && !currentAnswer) {
      setAnswers(prev => [
        ...prev,
        {
          caseId: currentCase.id,
          caseCode: currentCase.caseCode,
          specialty: currentCase.specialty,
          difficulty: currentCase.difficulty,
          userAnswer: '',
          correctAnswer: currentCase.diagnosis,
          selfMarkedCorrect: null,
          skipped: false,
        },
      ]);
    }
  };

  const handleSubmit = () => {
    if (mode === 'quiz' && !userAnswer.trim()) return;
    setIsRevealed(true);
  };

  const handleSelfMark = (correct: boolean) => {
    const base = {
      caseId: currentCase.id,
      caseCode: currentCase.caseCode,
      specialty: currentCase.specialty,
      difficulty: currentCase.difficulty,
      userAnswer: userAnswer.trim(),
      correctAnswer: currentCase.diagnosis,
      skipped: false,
    };
    setAnswers(prev => {
      const others = prev.filter(a => a.caseId !== currentCase.id);
      return [...others, { ...base, selfMarkedCorrect: correct }];
    });
  };

  const handleNext = () => {
    if (isLastCase) {
      setEndTime(Date.now());
      setScreen('summary');
    } else {
      setCurrentIdx(i => i + 1);
      setUserAnswer('');
      setIsRevealed(false);
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  };

  const handleSkip = () => {
    setAnswers(prev => {
      const others = prev.filter(a => a.caseId !== currentCase.id);
      return [
        ...others,
        {
          caseId: currentCase.id,
          caseCode: currentCase.caseCode,
          specialty: currentCase.specialty,
          difficulty: currentCase.difficulty,
          userAnswer: '',
          correctAnswer: currentCase.diagnosis,
          selfMarkedCorrect: null,
          skipped: true,
        },
      ];
    });
    handleNext();
  };

  const isSelfMarked = currentAnswer?.selfMarkedCorrect !== undefined && currentAnswer?.selfMarkedCorrect !== null;
  const canProceed = mode === 'explore' ? isRevealed : isSelfMarked;

  // ── SETUP SCREEN ─────────────────────────────────────────────
  if (screen === 'setup') {
    return (
      <div className="fixed inset-0 z-[150] bg-slate-950 flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto no-scrollbar">
          {/* Header */}
          <div className="flex items-start justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-600/30">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tighter text-white">Mode Entraînement</h1>
                <p className="text-slate-500 text-sm mt-0.5">Testez vos connaissances sur les cas cliniques</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 rounded-2xl bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Mode */}
          <div className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Mode d'entraînement</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setMode('quiz')}
                className={`p-5 rounded-2xl border-2 text-left transition-all ${
                  mode === 'quiz'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-xl ${mode === 'quiz' ? 'bg-blue-500/20' : 'bg-white/10'}`}>
                    <PenLine className={`w-5 h-5 ${mode === 'quiz' ? 'text-blue-400' : 'text-slate-400'}`} />
                  </div>
                  <span className={`font-bold text-sm ${mode === 'quiz' ? 'text-white' : 'text-slate-400'}`}>Quiz</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">Formulez votre hypothèse avant de voir le diagnostic correct</p>
              </button>
              <button
                onClick={() => setMode('explore')}
                className={`p-5 rounded-2xl border-2 text-left transition-all ${
                  mode === 'explore'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-xl ${mode === 'explore' ? 'bg-purple-500/20' : 'bg-white/10'}`}>
                    <Eye className={`w-5 h-5 ${mode === 'explore' ? 'text-purple-400' : 'text-slate-400'}`} />
                  </div>
                  <span className={`font-bold text-sm ${mode === 'explore' ? 'text-white' : 'text-slate-400'}`}>Exploration</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">Analysez les images puis révélez le diagnostic pour apprendre</p>
              </button>
            </div>
          </div>

          {/* Specialty filter */}
          <div className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4">
              Spécialités
              <span className="ml-2 text-slate-600 normal-case">
                {selectedSpecialties.size === 0 ? '(toutes)' : `(${selectedSpecialties.size} sélectionnée${selectedSpecialties.size > 1 ? 's' : ''})`}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.values(Specialty).map(s => {
                const cfg = SPECIALTY_MAP[s];
                const isSelected = selectedSpecialties.has(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleSpecialty(s)}
                    className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide border transition-all ${
                      isSelected
                        ? `${cfg.bg} ${cfg.color} border-transparent scale-105`
                        : 'bg-white/5 text-slate-500 border-white/10 hover:border-white/20 hover:text-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty filter */}
          <div className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Niveaux de difficulté</p>
            <div className="flex flex-wrap gap-3">
              {Object.values(Difficulty).map(d => {
                const cfg = DIFFICULTY_MAP[d];
                const isSelected = selectedDifficulties.has(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleDifficulty(d)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold border transition-all ${
                      isSelected
                        ? `${cfg.bg} ${cfg.color} border-transparent scale-105`
                        : 'bg-white/5 text-slate-500 border-white/10 hover:border-white/20 hover:text-slate-300'
                    }`}
                  >
                    {isSelected && <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />}
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Case count */}
          <div className="mb-10">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Nombre de cas</p>
            <div className="flex gap-3">
              {CASE_COUNTS.map(n => (
                <button
                  key={n}
                  onClick={() => setCaseCount(n)}
                  disabled={n !== -1 && n > filteredPool.length}
                  className={`flex-1 py-3 rounded-2xl text-sm font-black border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                    caseCount === n
                      ? 'bg-white text-slate-950 border-white'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {CASE_COUNT_LABELS[n]}
                </button>
              ))}
            </div>
          </div>

          {/* Start button */}
          <div className="bg-white/5 rounded-2xl p-5 mb-6 flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm">
                {availableCount} cas disponibles
              </p>
              <p className="text-slate-500 text-xs mt-0.5">
                {selectedSpecialties.size === 0 && selectedDifficulties.size === 0
                  ? 'Toutes spécialités · Tous niveaux'
                  : [
                      selectedSpecialties.size > 0 && `${selectedSpecialties.size} spécialité${selectedSpecialties.size > 1 ? 's' : ''}`,
                      selectedDifficulties.size > 0 && `${selectedDifficulties.size} niveau${selectedDifficulties.size > 1 ? 'x' : ''}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Shuffle className="w-4 h-4" />
              <span className="text-xs">Ordre aléatoire</span>
            </div>
          </div>

          <button
            onClick={startSession}
            disabled={availableCount === 0}
            className="w-full py-5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-blue-600/30 active:scale-95 flex items-center justify-center gap-3"
          >
            <Play className="w-5 h-5 fill-white" />
            Commencer la session
          </button>
        </div>
      </div>
    );
  }

  // ── SUMMARY SCREEN ────────────────────────────────────────────
  if (screen === 'summary') {
    const { label: scoreLabel, color: scoreColor } = getScoreLabel(scorePercent);
    const incorrectAnswers = answers.filter(a => a.selfMarkedCorrect === false);
    const skippedAnswers = answers.filter(a => a.skipped);

    // By specialty
    const bySpecialty = Object.values(Specialty)
      .map(s => {
        const inSession = answers.filter(a => a.specialty === s);
        const correct = inSession.filter(a => a.selfMarkedCorrect === true).length;
        return { specialty: s, total: inSession.length, correct };
      })
      .filter(x => x.total > 0);

    const reviewCase = reviewCaseIdx !== null ? sessionCases[reviewCaseIdx] : null;

    if (reviewCase) {
      return (
        <div className="fixed inset-0 z-[150] bg-slate-950 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-10">
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => setReviewCaseIdx(null)}
                className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
              >
                ← Retour au bilan
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-6">
                <div className="flex flex-wrap gap-3">
                  <Badge label={reviewCase.specialty} colorClass={SPECIALTY_MAP[reviewCase.specialty].color} bgClass={SPECIALTY_MAP[reviewCase.specialty].bg} />
                  <Badge label={reviewCase.difficulty} colorClass={DIFFICULTY_MAP[reviewCase.difficulty].color} bgClass={DIFFICULTY_MAP[reviewCase.difficulty].bg} dotClass={DIFFICULTY_MAP[reviewCase.difficulty].dot} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">Contexte clinique</p>
                  <div className="bg-white/5 rounded-2xl p-5 text-slate-300 text-sm leading-relaxed border border-white/5">
                    {reviewCase.clinicalNote}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">Diagnostic correct</p>
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-emerald-300 font-semibold">
                    {reviewCase.diagnosis}
                  </div>
                </div>
                {answers.find(a => a.caseId === reviewCase.id)?.userAnswer && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">Votre réponse</p>
                    <div className={`rounded-2xl p-5 text-sm border ${
                      answers.find(a => a.caseId === reviewCase.id)?.selfMarkedCorrect
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}>
                      {answers.find(a => a.caseId === reviewCase.id)?.userAnswer}
                    </div>
                  </div>
                )}
              </div>
              <div className="lg:col-span-7">
                <MedicalStackViewer series={reviewCase.series || []} />
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-[150] bg-slate-950 overflow-y-auto animate-in fade-in duration-300">
        <div className="max-w-2xl mx-auto px-6 py-16">
          {/* Score */}
          <div className="text-center mb-12">
            <div className="w-24 h-24 rounded-full bg-blue-600/20 border-2 border-blue-500/50 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-600/20">
              <Trophy className="w-10 h-10 text-blue-400" />
            </div>
            <h1 className="text-5xl font-black text-white mb-2">{scorePercent}<span className="text-2xl text-slate-500">%</span></h1>
            <p className={`text-xl font-bold ${scoreColor} mb-1`}>{scoreLabel}</p>
            <p className="text-slate-500 text-sm">
              {score} correcte{score > 1 ? 's' : ''} · {incorrectAnswers.length} incorrecte{incorrectAnswers.length > 1 ? 's' : ''} · {skippedAnswers.length} passée{skippedAnswers.length > 1 ? 's' : ''}
              {totalDuration > 0 && ` · ${formatDuration(totalDuration)}`}
            </p>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-black text-emerald-400">{score}</p>
              <p className="text-xs text-slate-500 mt-1">Correctes</p>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 text-center">
              <XCircle className="w-6 h-6 text-rose-400 mx-auto mb-2" />
              <p className="text-2xl font-black text-rose-400">{incorrectAnswers.length}</p>
              <p className="text-xs text-slate-500 mt-1">Incorrectes</p>
            </div>
            <div className="bg-slate-500/10 border border-slate-500/20 rounded-2xl p-5 text-center">
              <Minus className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-2xl font-black text-slate-400">{skippedAnswers.length}</p>
              <p className="text-xs text-slate-500 mt-1">Passées</p>
            </div>
          </div>

          {/* By specialty */}
          {bySpecialty.length > 0 && (
            <div className="mb-10">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-5">Par spécialité</p>
              <div className="space-y-3">
                {bySpecialty.map(({ specialty, total, correct }) => {
                  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                  const cfg = SPECIALTY_MAP[specialty];
                  return (
                    <div key={specialty} className="flex items-center gap-4">
                      <span className={`text-xs font-bold w-32 truncate ${cfg.color}`}>{specialty}</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-slate-400 w-14 text-right">
                        {correct}/{total}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Review incorrect */}
          {incorrectAnswers.length > 0 && (
            <div className="mb-10">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Revoir les cas incorrects</p>
              <div className="space-y-2">
                {incorrectAnswers.map(a => {
                  const idx = sessionCases.findIndex(c => c.id === a.caseId);
                  return (
                    <button
                      key={a.caseId}
                      onClick={() => setReviewCaseIdx(idx)}
                      className="w-full flex items-center justify-between p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl text-left hover:bg-rose-500/10 transition-all group"
                    >
                      <div>
                        <span className="text-rose-400 text-xs font-black font-mono">{a.caseCode}</span>
                        <p className="text-slate-300 text-sm font-medium mt-0.5 truncate max-w-xs">{a.correctAnswer}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setScreen('setup'); setAnswers([]); setSessionCases([]); }}
              className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-3"
            >
              <RotateCcw className="w-5 h-5" />
              Nouvelle session
            </button>
            <button
              onClick={onClose}
              className="w-full py-4 rounded-2xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 font-bold text-sm transition-all border border-white/10"
            >
              Retour aux archives
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── QUESTION SCREEN ───────────────────────────────────────────
  if (!currentCase) return null;

  const progress = ((currentIdx + 1) / sessionCases.length) * 100;
  const specialtyCfg = SPECIALTY_MAP[currentCase.specialty];
  const difficultyCfg = DIFFICULTY_MAP[currentCase.difficulty];

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950 flex flex-col animate-in fade-in duration-200">
      {/* Top bar */}
      <div className="flex-none px-8 py-5 border-b border-white/5 flex items-center gap-6 bg-slate-950/90 backdrop-blur-xl">
        <button
          onClick={onClose}
          className="p-2.5 rounded-xl bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all shrink-0"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
              Cas {currentIdx + 1} / {sessionCases.length}
            </span>
            <span className="text-xs font-black text-blue-400">
              {score} correct{score > 1 ? 's' : ''}
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase ${mode === 'quiz' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
          {mode === 'quiz' ? 'Quiz' : 'Exploration'}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left column */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Case header */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-slate-500 text-sm font-bold">{currentCase.caseCode}</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-slate-500 text-xs uppercase tracking-widest">{currentCase.modality}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Badge label={currentCase.specialty} colorClass={specialtyCfg.color} bgClass={specialtyCfg.bg} />
                  <Badge label={currentCase.difficulty} colorClass={difficultyCfg.color} bgClass={difficultyCfg.bg} dotClass={difficultyCfg.dot} />
                </div>
              </div>

              {/* Clinical note */}
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">Contexte clinique</p>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-slate-300 text-sm leading-relaxed">
                  {currentCase.clinicalNote}
                </div>
              </div>

              {/* Answer area */}
              {!isRevealed ? (
                <div className="flex flex-col gap-4">
                  {mode === 'quiz' ? (
                    <>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">
                          Votre hypothèse diagnostique
                        </p>
                        <textarea
                          ref={textareaRef}
                          value={userAnswer}
                          onChange={e => setUserAnswer(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && e.ctrlKey) handleSubmit();
                          }}
                          placeholder="Décrivez votre diagnostic… (Ctrl+Entrée pour valider)"
                          rows={4}
                          className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 rounded-2xl px-5 py-4 text-white text-sm placeholder:text-slate-600 outline-none resize-none transition-all leading-relaxed"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleSubmit}
                          disabled={!userAnswer.trim()}
                          className="flex-1 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Check className="w-5 h-5" />
                          Soumettre
                        </button>
                        <button
                          onClick={handleSkip}
                          className="px-5 py-4 rounded-2xl bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10 font-bold text-sm transition-all border border-white/10"
                          title="Passer ce cas"
                        >
                          <SkipForward className="w-5 h-5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={handleReveal}
                        className="flex-1 py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Eye className="w-5 h-5" />
                        Révéler le diagnostic
                      </button>
                      <button
                        onClick={handleSkip}
                        className="px-5 py-4 rounded-2xl bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10 font-bold text-sm transition-all border border-white/10"
                        title="Passer ce cas"
                      >
                        <SkipForward className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Revealed state */
                <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-300">
                  {/* Correct diagnosis */}
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">Diagnostic correct</p>
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-emerald-300 font-semibold text-sm leading-relaxed">
                      {currentCase.diagnosis}
                    </div>
                  </div>

                  {/* User answer comparison (quiz mode) */}
                  {mode === 'quiz' && userAnswer.trim() && (
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">Votre réponse</p>
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-slate-300 text-sm leading-relaxed">
                        {userAnswer}
                      </div>
                    </div>
                  )}

                  {/* Self-assessment (quiz mode) */}
                  {mode === 'quiz' && !isSelfMarked && (
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">Auto-évaluation</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleSelfMark(true)}
                          className="flex-1 py-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-sm hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          Correct
                        </button>
                        <button
                          onClick={() => handleSelfMark(false)}
                          className="flex-1 py-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-sm hover:bg-rose-500/20 transition-all flex items-center justify-center gap-2"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          Incorrect
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mark result display */}
                  {isSelfMarked && (
                    <div className={`flex items-center gap-3 p-4 rounded-2xl border text-sm font-bold ${
                      currentAnswer?.selfMarkedCorrect
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}>
                      {currentAnswer?.selfMarkedCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      {currentAnswer?.selfMarkedCorrect ? 'Bien joué !' : 'À retravailler'}
                    </div>
                  )}

                  {/* Next button */}
                  {(mode === 'explore' || isSelfMarked) && (
                    <button
                      onClick={handleNext}
                      className="w-full py-4 rounded-2xl bg-white text-slate-950 font-black text-sm uppercase tracking-wider transition-all active:scale-95 hover:bg-slate-100 flex items-center justify-center gap-2"
                    >
                      {isLastCase ? (
                        <>
                          <Trophy className="w-5 h-5" />
                          Voir le bilan
                        </>
                      ) : (
                        <>
                          Cas suivant
                          <ChevronRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right column: viewer */}
            <div className="lg:col-span-7">
              <MedicalStackViewer series={currentCase.series || []} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
