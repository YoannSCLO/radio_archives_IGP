
import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import { Specialty, Difficulty, RadioCase } from './types';
import { SPECIALTY_MAP, DIFFICULTY_MAP } from './constants';
import { Badge } from './components/Badge';
import { CaseForm } from './components/CaseForm';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { AdminPendingRegistrations } from './components/AdminPendingRegistrations';
import { PasswordInputWithToggle } from './components/PasswordInputWithToggle';
import { MedicalStackViewer } from './components/MedicalStackViewer';
import { TrainingModule } from './components/TrainingModule';
import { semanticSearch } from './services/geminiService';
import { postPatientMapping, getStoredInboundToken, setStoredInboundToken } from './services/patientMappingService';
import {
  changePassword,
  fetchSession,
  logout as authLogout,
  type SessionInfo,
} from './services/authService';
import {
  createCaseOnServer,
  deleteCaseOnServer,
  fetchCasesFromServer,
  updateCaseOnServer,
} from './services/casesApi';
import {
  Plus,
  Search,
  Database,
  ChevronRight,
  Trash2,
  Sun,
  Moon,
  Sparkles,
  Loader2,
  Monitor,
  LayoutDashboard,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Settings2,
  X,
  Check,
  Star,
  Hash,
  ListFilter,
  Activity,
  KeyRound,
  LogOut,
  Pencil,
  ShieldCheck,
  GraduationCap,
  Sliders,
  Link,
  UserCog,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

const IGPLogo = ({ className = "h-12" }: { className?: string }) => (
  <svg viewBox="0 0 450 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="110" cy="90" r="70" stroke="#164E63" strokeWidth="6" strokeDasharray="300 100" />
    <circle cx="110" cy="90" r="55" stroke="#0891B2" strokeWidth="6" strokeDasharray="200 80" />
    <circle cx="110" cy="90" r="40" stroke="#164E63" strokeWidth="6" strokeDasharray="150 50" />
    <circle cx="110" cy="90" r="25" stroke="#0891B2" strokeWidth="6" strokeDasharray="100 40" />
    <circle cx="110" cy="90" r="10" fill="#164E63" className="dark:fill-cyan-500" />
    <text x="210" y="95" fontFamily="Inter, sans-serif" fontSize="100" fontWeight="900" letterSpacing="-4" fill="#1E40AF" className="dark:fill-white">IGP</text>
    <text x="212" y="130" fontFamily="Inter, sans-serif" fontSize="32" fontWeight="400" letterSpacing="6" fill="#64748b" className="dark:fill-slate-400 uppercase">Imagerie</text>
  </svg>
);

const RadioArchiveLogo = () => (
  <div className="flex items-center gap-4 group cursor-default">
    <div className="w-12 h-12 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center transition-all group-hover:scale-105 duration-300">
      <LayoutDashboard className="w-6 h-6 text-white dark:text-slate-900" />
    </div>
    <div className="flex flex-col -space-y-1">
      <span className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">RADIO</span>
      <span className="text-xs font-medium tracking-[0.25em] text-blue-600 uppercase">Archive</span>
    </div>
  </div>
);


// MedicalStackViewer is now in components/MedicalStackViewer.tsx

const CASE_CODE_RE = /^CASE-(\d+)$/;

function extractCaseCode(c: Record<string, unknown>): string | null {
  const cc = c.caseCode;
  if (typeof cc === 'string' && CASE_CODE_RE.test(cc)) return cc;
  const pid = c.patientId;
  if (typeof pid === 'string' && CASE_CODE_RE.test(pid)) return pid;
  return null;
}

function getNextCaseCode(cases: RadioCase[]): string {
  let max = 0;
  for (const c of cases) {
    const m = CASE_CODE_RE.exec(c.caseCode);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `CASE-${String(max + 1).padStart(5, '0')}`;
}

/** Modification réservée à l'auteur lorsque la connexion est obligatoire.
 *  Les administrateurs peuvent modifier n'importe quel cas.
 *  Sans auth obligatoire, tout utilisateur peut modifier (avec justification). */
function canEditCase(session: SessionInfo, c: RadioCase): boolean {
  if (!session.authRequired) return true;
  if (!session.authenticated) return false;
  // L'administrateur a un droit de modification universel
  if ('isAdmin' in session && session.isAdmin) return true;
  const u = 'username' in session ? session.username?.trim().toLowerCase() : undefined;
  if (!u || !c.authorEmail) return false;
  return c.authorEmail === u;
}

/** Vrai si l'utilisateur connecté est admin ET que le cas appartient à quelqu'un d'autre. */
function isAdminOverride(session: SessionInfo, c: RadioCase): boolean {
  if (!session.authRequired || !session.authenticated) return false;
  if (!('isAdmin' in session) || !session.isAdmin) return false;
  const u = 'username' in session ? session.username?.trim().toLowerCase() : undefined;
  return !!(u && c.authorEmail && c.authorEmail !== u);
}

function migrateLoadedCases(raw: unknown): RadioCase[] {
  if (!Array.isArray(raw)) return [];
  const list = raw.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object');

  let maxNum = 0;
  const rows = list.map((c) => {
    const code = extractCaseCode(c);
    if (code) {
      const m = CASE_CODE_RE.exec(code)!;
      maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
    return {
      id: String(c.id),
      code,
      dateAdded: String(c.dateAdded ?? ''),
      c,
    };
  });

  const needAssign = rows.filter((x) => !x.code);
  const sortedNeed = [...needAssign].sort((a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime());
  const codeById = new Map<string, string>();
  let next = maxNum + 1;
  for (const item of sortedNeed) {
    codeById.set(item.id, `CASE-${String(next++).padStart(5, '0')}`);
  }

  return rows.map(({ c, id, code }) => {
    const caseCode = code ?? codeById.get(id)!;
    const rest: Record<string, unknown> = { ...c };
    delete rest.lastName;
    delete rest.firstName;
    delete rest.patientId;
    delete rest.caseCode;
    return { ...rest, caseCode } as RadioCase;
  });
}

export default function App() {
  const [cases, setCases] = useState<RadioCase[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('radio_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState<Specialty | 'Tous' | 'Favoris'>('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [caseToEdit, setCaseToEdit] = useState<RadioCase | null>(null);
  /** `server` = base PostgreSQL partagée ; `local` = navigateur uniquement. */
  const [casesStorage, setCasesStorage] = useState<'server' | 'local'>('local');
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inboundTokenDraft, setInboundTokenDraft] = useState('');
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [isTrainingOpen, setIsTrainingOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'specialties' | 'account' | 'token'>('specialties');
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [visibleSpecialties, setVisibleSpecialties] = useState<Specialty[]>(() => {
    const saved = localStorage.getItem('visible_specialties');
    return saved ? JSON.parse(saved) : Object.values(Specialty).slice(0, 6);
  });

  const pwdIdCur = useId();
  const pwdIdNew = useId();
  const pwdIdConf = useId();

  const isInitialMount = useRef(true);

  useEffect(() => {
    localStorage.setItem('visible_specialties', JSON.stringify(visibleSpecialties));
  }, [visibleSpecialties]);

  useEffect(() => {
    localStorage.setItem('radio_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (isSettingsOpen) {
      setInboundTokenDraft(getStoredInboundToken() ?? '');
      setPwdCurrent('');
      setPwdNew('');
      setPwdConfirm('');
      setPwdMsg(null);
      setSettingsTab('specialties');
    }
  }, [isSettingsOpen]);

  useEffect(() => {
    void fetchSession().then((s) => {
      setSession(s);
      setAuthLoading(false);
    });
  }, []);

  const tabs = useMemo(() => ['Tous', 'Favoris', ...visibleSpecialties], [visibleSpecialties]);
  const [isSmartLoading, setIsSmartLoading] = useState(false);
  const [smartResults, setSmartResults] = useState<{ matches: {id: string, reason: string}[], suggestedKeywords: string[] } | null>(null);

  useEffect(() => {
    if (isDark) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDark]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const remote = await fetchCasesFromServer();
      if (cancelled) return;
      if (remote !== null) {
        setCases(remote);
        setCasesStorage('server');
        isInitialMount.current = false;
        return;
      }
      const saved = localStorage.getItem('radio_cases');
      setCases(migrateLoadedCases(saved ? JSON.parse(saved) : []));
      setCasesStorage('local');
      isInitialMount.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Après connexion, basculer sur la base partagée si disponible. */
  useEffect(() => {
    if (!session || !session.authRequired || !session.authenticated) return;
    let cancelled = false;
    void (async () => {
      const remote = await fetchCasesFromServer();
      if (cancelled || remote === null) return;
      setCases(remote);
      setCasesStorage('server');
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!isInitialMount.current && casesStorage === 'local') {
      localStorage.setItem('radio_cases', JSON.stringify(cases));
    }
  }, [cases, casesStorage]);

  const searchMatchedCases = useMemo(() => {
    return cases.filter(c => {
      const basicSearch = 
        c.caseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.clinicalNote.toLowerCase().includes(searchQuery.toLowerCase());

      const isSmartMatch = smartResults?.matches.some(m => m.id === c.id);
      
      return basicSearch || isSmartMatch;
    });
  }, [cases, searchQuery, smartResults]);

  const filteredCases = useMemo(() => {
    return searchMatchedCases.filter(c => {
      if (activeTab === 'Tous') return true;
      if (activeTab === 'Favoris') return favorites.includes(c.id);
      return c.specialty === activeTab;
    }).sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  }, [searchMatchedCases, activeTab, favorites]);

  const tabDetailedCounts = useMemo(() => {
    const results: Record<string, { visible: number; total: number }> = {};
    tabs.forEach(tab => {
      let totalInCategory = 0;
      let visibleInCategory = 0;
      if (tab === 'Tous') {
        totalInCategory = cases.length;
        visibleInCategory = searchMatchedCases.length;
      } else if (tab === 'Favoris') {
        totalInCategory = favorites.length;
        visibleInCategory = searchMatchedCases.filter(c => favorites.includes(c.id)).length;
      } else {
        totalInCategory = cases.filter(c => c.specialty === tab).length;
        visibleInCategory = searchMatchedCases.filter(c => c.specialty === tab).length;
      }
      results[tab] = { visible: visibleInCategory, total: totalInCategory };
    });
    return results;
  }, [cases, searchMatchedCases, favorites, tabs]);

  const stats = useMemo(() => {
    const specialtyDist: Record<string, number> = {};
    const difficultyDist: Record<string, number> = {};
    const modalityDist: Record<string, number> = {};
    
    cases.forEach(c => {
      specialtyDist[c.specialty] = (specialtyDist[c.specialty] || 0) + 1;
      difficultyDist[c.difficulty] = (difficultyDist[c.difficulty] || 0) + 1;
      modalityDist[c.modality] = (modalityDist[c.modality] || 0) + 1;
    });
    
    return {
      specialty: Object.entries(specialtyDist).sort((a, b) => b[1] - a[1]),
      /** Toujours les 4 niveaux, ordre fixe (du plus accessible au plus expert). */
      difficultyByLevel: Object.values(Difficulty).map((d) => [d, difficultyDist[d] ?? 0] as [string, number]),
      modality: Object.entries(modalityDist).sort((a, b) => b[1] - a[1]),
    };
  }, [cases]);

  const toggleSpecialtyVisibility = (s: Specialty) => {
    setVisibleSpecialties(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]);
  };

  const handleSmartSearch = async () => {
    if (!searchQuery) return;
    setIsSmartLoading(true);
    const results = await semanticSearch(searchQuery, cases);
    setSmartResults(results);
    setIsSmartLoading(false);
  };

  const handleAddCase = async (
    data: Omit<RadioCase, 'id' | 'dateAdded' | 'caseCode' | 'authorEmail' | 'lastModifiedAt' | 'lastEditJustification'>,
    patientMapping?: { ipp: string; lastName?: string; firstName?: string } | null
  ) => {
    if (casesStorage === 'server') {
      const created = await createCaseOnServer(data);
      if (!created) {
        window.alert(
          "Enregistrement sur le serveur impossible (vérifiez DATABASE_URL, la connexion et que vous êtes connecté si l'auth est activée)."
        );
        return;
      }
      setCases((prev) => [created, ...prev]);
      if (patientMapping?.ipp) {
        const result = await postPatientMapping({
          caseCode: created.caseCode,
          caseId: created.id,
          ipp: patientMapping.ipp,
          lastName: patientMapping.lastName,
          firstName: patientMapping.firstName,
        });
        if (result.ok === false) {
          const { reason } = result;
          if (reason === "not_configured") {
            window.alert(
              "Un IPP a été saisi mais le proxy serveur n'est pas configuré (variable PATIENT_MAPPING_UPSTREAM_URL côté hébergement). Le cas est enregistré sur le serveur mais la correspondance patient n'a pas été transmise."
            );
          } else if (reason === "unauthorized") {
            window.alert(
              "Accès refusé (401). Indiquez le jeton dans Réglages → correspondance patient, puis réessayez."
            );
          } else {
            window.alert(
              "La correspondance patient n'a pas été transmise. Vérifiez le réseau et l'endpoint upstream."
            );
          }
        }
      }
      setIsFormOpen(false);
      return;
    }

    let nextCode = '';
    let newId = '';
    const authorEmail =
      session &&
      session.authRequired &&
      session.authenticated &&
      'username' in session &&
      session.username
        ? session.username.trim().toLowerCase()
        : undefined;
    setCases((prev) => {
      nextCode = getNextCaseCode(prev);
      newId = Math.random().toString(36).substr(2, 9);
      const newCase: RadioCase = {
        ...data,
        caseCode: nextCode,
        id: newId,
        dateAdded: new Date().toISOString(),
        ...(authorEmail ? { authorEmail } : {}),
      };
      return [newCase, ...prev];
    });

    if (patientMapping?.ipp) {
      const result = await postPatientMapping({
        caseCode: nextCode,
        caseId: newId,
        ipp: patientMapping.ipp,
        lastName: patientMapping.lastName,
        firstName: patientMapping.firstName,
      });
      if (result.ok === false) {
        const { reason } = result;
        if (reason === "not_configured") {
          window.alert(
            "Un IPP a été saisi mais le proxy serveur n'est pas configuré (variable PATIENT_MAPPING_UPSTREAM_URL côté hébergement). Le cas est enregistré en local uniquement."
          );
        } else if (reason === "unauthorized") {
          window.alert(
            "Accès refusé (401). Indiquez le jeton dans Réglages → correspondance patient, puis réessayez."
          );
        } else {
          window.alert(
            "Le cas a été enregistré localement, mais la transmission vers votre base sécurisée a échoué. Vérifiez le réseau et l'endpoint upstream."
          );
        }
      }
    }

    setIsFormOpen(false);
  };

  const handleUpdateCase = async (
    caseId: string,
    data: Omit<RadioCase, 'id' | 'dateAdded' | 'caseCode' | 'authorEmail' | 'lastModifiedAt' | 'lastEditJustification'>,
    justification: string,
    patientMapping?: { ipp: string; lastName?: string; firstName?: string } | null
  ) => {
    if (casesStorage === 'server') {
      const updated = await updateCaseOnServer(
        caseId,
        {
          specialty: data.specialty,
          difficulty: data.difficulty,
          modality: data.modality,
          clinicalNote: data.clinicalNote,
          diagnosis: data.diagnosis,
          series: data.series,
        },
        justification
      );
      if (!updated) {
        window.alert(
          "Mise à jour serveur impossible (droits, justification ou connexion). Réessayez après vérification."
        );
        return;
      }
      setCases((prev) => prev.map((c) => (c.id === caseId ? updated : c)));
      if (patientMapping?.ipp) {
        const result = await postPatientMapping({
          caseCode: updated.caseCode,
          caseId,
          ipp: patientMapping.ipp,
          lastName: patientMapping.lastName,
          firstName: patientMapping.firstName,
        });
        if (result.ok === false) {
          const { reason } = result;
          if (reason === 'not_configured') {
            window.alert(
              "Un IPP a été saisi mais le proxy serveur n'est pas configuré (variable PATIENT_MAPPING_UPSTREAM_URL côté hébergement)."
            );
          } else if (reason === 'unauthorized') {
            window.alert(
              "Accès refusé (401). Indiquez le jeton dans Réglages → correspondance patient, puis réessayez."
            );
          } else {
            window.alert(
              "La correspondance patient n'a pas été transmise. Vérifiez le réseau et l'endpoint upstream."
            );
          }
        }
      }
      setCaseToEdit(null);
      setIsFormOpen(false);
      return;
    }

    let code = '';
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== caseId) return c;
        code = c.caseCode;
        return {
          ...c,
          ...data,
          id: c.id,
          caseCode: c.caseCode,
          dateAdded: c.dateAdded,
          authorEmail: c.authorEmail,
          lastModifiedAt: new Date().toISOString(),
          lastEditJustification: justification.trim(),
        };
      })
    );

    if (patientMapping?.ipp) {
      const result = await postPatientMapping({
        caseCode: code,
        caseId,
        ipp: patientMapping.ipp,
        lastName: patientMapping.lastName,
        firstName: patientMapping.firstName,
      });
      if (result.ok === false) {
        const { reason } = result;
        if (reason === 'not_configured') {
          window.alert(
            "Un IPP a été saisi mais le proxy serveur n'est pas configuré (variable PATIENT_MAPPING_UPSTREAM_URL côté hébergement). Le cas est enregistré en local uniquement."
          );
        } else if (reason === 'unauthorized') {
          window.alert(
            "Accès refusé (401). Indiquez le jeton dans Réglages → correspondance patient, puis réessayez."
          );
        } else {
          window.alert(
            "Le cas a été enregistré localement, mais la transmission vers votre base sécurisée a échoué. Vérifiez le réseau et l'endpoint upstream."
          );
        }
      }
    }

    setCaseToEdit(null);
    setIsFormOpen(false);
  };

  const deleteCase = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer définitivement ce cas ?')) return;
    if (casesStorage === 'server') {
      const ok = await deleteCaseOnServer(id);
      if (!ok) {
        window.alert('Suppression serveur impossible (droits ou connexion).');
        return;
      }
    }
    setCases((prev) => prev.filter((c) => c.id !== id));
    setFavorites((prev) => prev.filter((fid) => fid !== id));
    if (expandedCaseId === id) setExpandedCaseId(null);
  };

  const handleChangePassword = async () => {
    setPwdMsg(null);
    if (pwdNew.length < 8) {
      setPwdMsg({
        type: 'err',
        text: 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
      });
      return;
    }
    if (pwdNew !== pwdConfirm) {
      setPwdMsg({
        type: 'err',
        text: 'La confirmation ne correspond pas au nouveau mot de passe.',
      });
      return;
    }
    setPwdLoading(true);
    try {
      const out = await changePassword(pwdCurrent, pwdNew);
      if (out === 'ok') {
        setPwdCurrent('');
        setPwdNew('');
        setPwdConfirm('');
        setPwdMsg({
          type: 'ok',
          text: 'Mot de passe mis à jour. Utilisez-le à la prochaine connexion.',
        });
      } else if (out === 'wrong') {
        setPwdMsg({ type: 'err', text: 'Mot de passe actuel incorrect.' });
      } else if (out === 'weak') {
        setPwdMsg({
          type: 'err',
          text: 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
        });
      } else if (out === 'single_user') {
        setPwdMsg({
          type: 'err',
          text: "Ce mode d'authentification ne permet pas le changement depuis l'app.",
        });
      } else {
        setPwdMsg({ type: 'err', text: 'Impossible de mettre à jour. Réessayez.' });
      }
    } finally {
      setPwdLoading(false);
    }
  };

  const handleAuthLogout = async () => {
    await authLogout();
    const s = await fetchSession();
    setSession(s);
  };

  // Computed before render for use in settings drawer
  const canChangePwd =
    session !== null &&
    session.authRequired &&
    session.authenticated &&
    'canChangePassword' in session &&
    !!(session as { canChangePassword?: boolean }).canChangePassword;

  if (authLoading || session === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-[#020617]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <p className="text-sm text-slate-400">Chargement…</p>
      </div>
    );
  }

  if (session.authRequired && !session.authenticated) {
    if (session.multiUser && session.allowPublicRegistration && authView === 'register') {
      return (
        <RegisterForm
          isDark={isDark}
          onRegistered={() => setAuthView('login')}
          onBack={() => setAuthView('login')}
        />
      );
    }
    return (
      <LoginForm
        isDark={isDark}
        onSuccess={() => void fetchSession().then(setSession)}
        onGoRegister={
          session.multiUser && session.allowPublicRegistration
            ? () => setAuthView('register')
            : undefined
        }
        registrationHint={
          session.authRequired ? session.registrationHint : undefined
        }
      />
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50/40 dark:bg-[#020617] text-slate-900 dark:text-slate-100 transition-all duration-700`}>
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0b1120]/90 backdrop-blur-3xl border-b border-slate-200/50 dark:border-white/5 h-24 flex items-center" style={{boxShadow:'0 1px 0 0 rgba(0,0,0,.06), 0 4px 24px -4px rgba(0,0,0,.04)'}}>
        <div className="max-w-7xl mx-auto px-8 w-full flex items-center justify-between">
          <div className="flex items-center gap-12">
            <IGPLogo className="h-12 w-auto" />
            <div className="hidden md:block h-10 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
            <RadioArchiveLogo />
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {session.authRequired &&
              session.authenticated &&
              'isAdmin' in session &&
              session.isAdmin && (
                <span
                  role="status"
                  aria-label="Profil administrateur"
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100 border border-amber-200/90 dark:border-amber-700/60 shadow-sm"
                  title="Vous avez le profil administrateur (validation des inscriptions)"
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 opacity-90" aria-hidden />
                  <span className="hidden min-[400px]:inline">Admin</span>
                </span>
              )}
            {session.authRequired && session.authenticated && (
              <button
                type="button"
                onClick={() => void handleAuthLogout()}
                className="p-4 rounded-full bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 hover:text-rose-500 transition-all shadow-sm"
                title="Déconnexion"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => setIsDark(!isDark)} className="p-4 rounded-full bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 hover:text-blue-500 transition-all shadow-sm">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-4 rounded-full bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 hover:text-blue-600 transition-all shadow-sm shrink-0"
              title="Réglages"
              aria-label="Ouvrir les réglages"
            >
              <Settings2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsTrainingOpen(true)}
              disabled={cases.length === 0}
              className="hidden sm:flex items-center gap-2 bg-slate-900 dark:bg-white hover:bg-slate-700 dark:hover:bg-slate-100 text-white dark:text-slate-900 px-6 py-3.5 rounded-full font-bold text-sm shadow-lg active:scale-95 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Lancer le mode entraînement"
            >
              <GraduationCap className="w-5 h-5" />
              <span>Entraînement</span>
            </button>
            <button
              onClick={() => {
                setCaseToEdit(null);
                setIsFormOpen(true);
              }}
              className="flex items-center gap-2 sm:gap-3 bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-8 py-3.5 rounded-full font-bold text-sm sm:text-base shadow-xl shadow-blue-500/30 active:scale-95 transition-all shrink-0"
            >
              <Plus className="w-5 h-5" />
              <span>Nouveau Dossier</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-14">
        {session.authRequired &&
          session.authenticated &&
          'isAdmin' in session &&
          session.isAdmin && (
            <div className="mb-10 max-w-xl">
              <AdminPendingRegistrations isDark={isDark} />
            </div>
          )}
        <div className="mb-20">
          <div className="flex items-center justify-between mb-10">
            <div className="flex flex-col">
              <h2 className="text-4xl font-light tracking-tighter text-slate-900 dark:text-white">Tableau de Bord <span className="text-blue-600 font-bold">IGP</span></h2>
              <p className="text-xs uppercase tracking-[0.4em] font-bold text-slate-400 mt-2">Statistiques</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsTrainingOpen(true)}
                disabled={cases.length === 0}
                className="sm:hidden flex items-center gap-2 px-5 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 border border-transparent rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 dark:hover:bg-slate-100 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <GraduationCap className="w-4 h-4" />
                Entraîn.
              </button>
              <button onClick={() => setIsStatsOpen(!isStatsOpen)} className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-all shadow-md">
                <Activity className="w-5 h-5" />
                {isStatsOpen ? 'Masquer' : 'Stats'}
              </button>
            </div>
          </div>
          
          {isStatsOpen && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-top-4 duration-500">
              {/* Total quick metrics */}
              <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4 mb-2">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-950/10 border border-blue-100 dark:border-blue-800/40 rounded-2xl p-5 flex flex-col gap-1">
                  <span className="text-3xl font-black text-blue-600">{cases.length}</span>
                  <span className="text-xs font-bold text-blue-500/70 uppercase tracking-widest">Cas total</span>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-950/10 border border-purple-100 dark:border-purple-800/40 rounded-2xl p-5 flex flex-col gap-1">
                  <span className="text-3xl font-black text-purple-600">{stats.specialty.length}</span>
                  <span className="text-xs font-bold text-purple-500/70 uppercase tracking-widest">Spécialités</span>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-950/10 border border-emerald-100 dark:border-emerald-800/40 rounded-2xl p-5 flex flex-col gap-1">
                  <span className="text-3xl font-black text-emerald-600">{stats.modality.length}</span>
                  <span className="text-xs font-bold text-emerald-500/70 uppercase tracking-widest">Modalités</span>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-950/10 border border-amber-100 dark:border-amber-800/40 rounded-2xl p-5 flex flex-col gap-1">
                  <span className="text-3xl font-black text-amber-600">{favorites.length}</span>
                  <span className="text-xs font-bold text-amber-500/70 uppercase tracking-widest">Favoris</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/60 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4 mb-10">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600"><Hash className="w-5 h-5" /></div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Spécialités</h3>
                </div>
                <div className="space-y-5">
                  {stats.specialty.slice(0, 6).map(([name, count]) => (
                    <div key={name} className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-500 dark:text-slate-400 truncate w-40">{name}</span>
                        <span className="text-blue-600 tabular-nums">{count}</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-700"
                          style={{ width: `${(count / (cases.length || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/60 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4 mb-10">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600"><BarChart3 className="w-5 h-5" /></div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Complexité</h3>
                </div>
                <div className="space-y-5">
                  {stats.difficultyByLevel.map(([name, count]) => {
                    const cfg = DIFFICULTY_MAP[name as Difficulty];
                    return (
                      <div key={name} className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className={`${cfg.color}`}>{name}</span>
                          <span className={`tabular-nums ${cfg.color}`}>{count}</span>
                        </div>
                        <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
                            style={{ width: `${cases.length ? (count / cases.length) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/60 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4 mb-10">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600"><Monitor className="w-5 h-5" /></div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Modalités</h3>
                </div>
                <div className="space-y-5">
                  {stats.modality.map(([name, count]) => (
                    <div key={name} className="flex items-center gap-5">
                      <span className="text-xs font-black text-slate-500 w-20 shrink-0">{name}</span>
                      <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/50 transition-all duration-700"
                          style={{ width: `${(count / (cases.length || 1)) * 100}%` }}
                        />
                        <span className="absolute right-3 top-0 text-[10px] font-black text-emerald-700 dark:text-emerald-400 leading-5">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filter + search bar */}
        <div className="bg-white dark:bg-[#0d1424] rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-sm mb-5 overflow-hidden">
          {/* Tabs row */}
          <div className="flex items-center gap-0 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-white/5 px-4">
            {tabs.map(tab => {
              const info = tabDetailedCounts[tab];
              const showRatio = searchQuery.length > 0 || smartResults !== null;
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`relative flex items-center gap-2 px-4 py-4 whitespace-nowrap text-xs font-bold transition-colors ${
                    isActive
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400'
                  }`}
                >
                  {tab === 'Favoris' && <Star className={`w-3.5 h-3.5 shrink-0 ${favorites.length > 0 ? 'fill-yellow-400 text-yellow-400' : ''}`} />}
                  {tab}
                  <span className={`text-[10px] font-black tabular-nums ${isActive ? 'text-blue-500' : 'text-slate-300 dark:text-slate-700'}`}>
                    {showRatio ? `${info?.visible}/${info?.total}` : info?.total}
                  </span>
                  {/* Active underline */}
                  {isActive && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-600 rounded-full" />}
                </button>
              );
            })}
          </div>

          {/* Search row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSmartResults(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()}
                placeholder="Chercher un cas, un diagnostic, une lésion…"
                className="w-full pl-11 pr-11 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 focus:border-blue-400 dark:focus:border-blue-500/50 rounded-xl outline-none text-sm font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all"
              />
              <button
                onClick={handleSmartSearch}
                disabled={isSmartLoading || !searchQuery}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-blue-500 disabled:opacity-25 transition-all hover:bg-blue-50 dark:hover:bg-blue-500/10"
                title="Recherche sémantique IA"
              >
                {isSmartLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </button>
            </div>

            {/* Count pill */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 shrink-0">
              <ListFilter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-bold text-blue-600 tabular-nums">{filteredCases.length}</span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">{cases.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0d1424] rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-7 py-5 text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">Référence</th>
                <th className="px-7 py-5 text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">Spécialité</th>
                <th className="px-7 py-5 text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">Diagnostic</th>
                <th className="px-7 py-5 text-right text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
              {filteredCases.map((c) => {
                const isExpanded = expandedCaseId === c.id;
                const isFavorite = favorites.includes(c.id);
                const adminOverride = isAdminOverride(session, c);
                return (
                  <React.Fragment key={c.id}>
                    <tr
                      onClick={() => setExpandedCaseId(isExpanded ? null : c.id)}
                      className={`cursor-pointer group transition-colors duration-150 ${isExpanded ? 'bg-blue-50/30 dark:bg-blue-950/20' : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.02]'}`}
                    >
                      {/* Reference */}
                      <td className="px-7 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-8 rounded-full shrink-0 ${isExpanded ? 'bg-blue-500' : 'bg-slate-200 dark:bg-white/10'}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 tracking-tight">{c.caseCode}</span>
                              {isFavorite && <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0" />}
                            </div>
                            <span className="text-[11px] text-slate-400 dark:text-slate-600 font-medium mt-0.5 block">{c.modality}</span>
                          </div>
                        </div>
                      </td>

                      {/* Specialty + difficulty */}
                      <td className="px-7 py-5">
                        <div className="flex flex-col gap-1.5">
                          <Badge label={c.specialty} colorClass={SPECIALTY_MAP[c.specialty].color} bgClass={SPECIALTY_MAP[c.specialty].bg} />
                          <Badge label={c.difficulty} colorClass={DIFFICULTY_MAP[c.difficulty].color} bgClass={DIFFICULTY_MAP[c.difficulty].bg} dotClass={DIFFICULTY_MAP[c.difficulty].dot} />
                        </div>
                      </td>

                      {/* Diagnosis + note */}
                      <td className="px-7 py-5">
                        <div className="flex flex-col gap-1 max-w-md">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-1">{c.diagnosis}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed line-clamp-1 italic">{c.clinicalNote}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-7 py-5">
                        <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                          {/* Favorite */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(c.id); }}
                            className={`p-2 rounded-xl transition-all ${isFavorite ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-500/10' : 'text-slate-300 dark:text-slate-700 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-500/10'}`}
                            title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          >
                            <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-400' : ''}`} />
                          </button>

                          {/* Edit — visible only if allowed */}
                          {canEditCase(session, c) && (
                            <button
                              type="button"
                              title={adminOverride ? 'Modifier (droits administrateur)' : 'Modifier ce cas'}
                              onClick={(e) => { e.stopPropagation(); setCaseToEdit(c); setIsFormOpen(true); }}
                              className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                adminOverride
                                  ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20'
                                  : 'text-slate-400 dark:text-slate-600 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                              }`}
                            >
                              {adminOverride && <ShieldCheck className="w-3.5 h-3.5 shrink-0" />}
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={(e) => deleteCase(e, c.id)}
                            className="p-2 rounded-xl text-slate-300 dark:text-slate-700 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {/* Expand */}
                          <div className={`p-2 rounded-xl transition-all text-slate-400 ${isExpanded ? 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' : ''}`}>
                            <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr className="bg-slate-50/30 dark:bg-blue-950/10">
                        <td colSpan={4} className="px-8 py-8">
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Left: clinical info */}
                            <div className="lg:col-span-5 flex flex-col gap-5">
                              {/* Diagnosis card */}
                              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-500 mb-3">Diagnostic Final</p>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">{c.diagnosis}</p>
                              </div>

                              {/* Clinical note */}
                              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-3">Contexte Clinique</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{c.clinicalNote}</p>
                              </div>

                              {/* Meta: author + modality */}
                              <div className="flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                  <Monitor className="w-3.5 h-3.5" /> {c.modality}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                  {new Date(c.dateAdded).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                                {c.authorEmail && (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    {c.authorEmail}
                                  </span>
                                )}
                              </div>

                              {/* Last edit */}
                              {(c.lastModifiedAt || c.lastEditJustification) && (
                                <div className="rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-4">
                                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-600 dark:text-amber-500 mb-2">Dernière modification</p>
                                  {c.lastModifiedAt && (
                                    <p className="text-xs text-amber-700/70 dark:text-amber-300/60 mb-1.5">
                                      {new Date(c.lastModifiedAt).toLocaleString('fr-FR')}
                                    </p>
                                  )}
                                  {c.lastEditJustification && (
                                    <p className="text-xs text-amber-900 dark:text-amber-200/80 leading-relaxed">
                                      <span className="font-semibold">Justification : </span>
                                      {c.lastEditJustification}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Right: viewer */}
                            <div className="lg:col-span-7">
                              <MedicalStackViewer series={c.series || []} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {filteredCases.length === 0 && (
            <div className="py-28 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-2">
                <Database className="w-7 h-7 opacity-30" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-500">Aucun cas ne correspond à votre sélection.</p>
              {cases.length === 0 && (
                <button
                  onClick={() => { setCaseToEdit(null); setIsFormOpen(true); }}
                  className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-sm shadow-lg transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Créer le premier cas
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Settings Drawer ───────────────────────────────────── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex" aria-modal="true">
          {/* Backdrop */}
          <div
            className="flex-1 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsSettingsOpen(false)}
          />

          {/* Drawer */}
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">

            {/* Drawer header */}
            <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Settings2 className="w-4 h-4 text-slate-500" />
                </div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Réglages</h2>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab nav */}
            <div className="flex gap-1 px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <button
                onClick={() => setSettingsTab('specialties')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex-1 justify-center ${settingsTab === 'specialties' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Sliders className="w-4 h-4" />
                <span className="hidden sm:inline">Spécialités</span>
              </button>
              {canChangePwd && (
                <button
                  onClick={() => setSettingsTab('account')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex-1 justify-center ${settingsTab === 'account' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <UserCog className="w-4 h-4" />
                  <span className="hidden sm:inline">Compte</span>
                </button>
              )}
              <button
                onClick={() => setSettingsTab('token')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex-1 justify-center ${settingsTab === 'token' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Link className="w-4 h-4" />
                <span className="hidden sm:inline">Correspondance</span>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 no-scrollbar">

              {/* ── Tab: Spécialités ───────────────── */}
              {settingsTab === 'specialties' && (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Onglets visibles</p>
                    <p className="text-xs text-slate-500 leading-relaxed mb-5">
                      Choisissez les spécialités affichées dans la barre de navigation.
                    </p>

                    {/* Select all / none */}
                    <div className="flex gap-2 mb-5">
                      <button
                        onClick={() => setVisibleSpecialties(Object.values(Specialty))}
                        className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5"
                      >
                        <ToggleRight className="w-4 h-4 text-blue-500" />
                        Tout afficher
                      </button>
                      <button
                        onClick={() => setVisibleSpecialties([])}
                        className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5"
                      >
                        <ToggleLeft className="w-4 h-4 text-slate-400" />
                        Tout masquer
                      </button>
                    </div>

                    {/* Grid of specialty toggles */}
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(Specialty).map(s => {
                        const cfg = SPECIALTY_MAP[s];
                        const isOn = visibleSpecialties.includes(s);
                        const caseCount = cases.filter(c => c.specialty === s).length;
                        return (
                          <button
                            key={s}
                            onClick={() => toggleSpecialtyVisibility(s)}
                            className={`relative flex flex-col gap-1.5 p-4 rounded-2xl border-2 text-left transition-all group ${
                              isOn
                                ? `${cfg.bg} border-transparent shadow-sm`
                                : 'bg-slate-50 dark:bg-slate-800/50 border-transparent opacity-50 hover:opacity-75'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-black leading-tight ${isOn ? cfg.color : 'text-slate-500'}`}>
                                {s}
                              </span>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 transition-all ${
                                isOn
                                  ? 'bg-current border-current'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`} style={isOn ? { color: 'transparent', background: 'currentColor' } : {}}>
                                {isOn && <Check className={`w-3 h-3 ${cfg.color}`} strokeWidth={3} />}
                              </div>
                            </div>
                            {caseCount > 0 && (
                              <span className={`text-[10px] font-bold tabular-nums ${isOn ? cfg.color : 'text-slate-400'} opacity-70`}>
                                {caseCount} cas
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Summary */}
                    <div className="mt-5 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between">
                      <span className="text-xs text-slate-500">Spécialités affichées</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {visibleSpecialties.length} / {Object.values(Specialty).length}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab: Compte ───────────────────── */}
              {settingsTab === 'account' && canChangePwd && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Mot de passe</p>
                      <p className="text-xs text-slate-500 leading-relaxed mb-5">
                        Comptes enregistrés via PostgreSQL. En mode fichier d'environnement, le changement s'effectue côté serveur.
                      </p>

                      <div className="space-y-3">
                        <div>
                          <label htmlFor={pwdIdCur} className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                            Mot de passe actuel
                          </label>
                          <PasswordInputWithToggle
                            id={pwdIdCur}
                            value={pwdCurrent}
                            onChange={setPwdCurrent}
                            autoComplete="current-password"
                            inputClass="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                            isDark={isDark}
                            placeholder="••••••••"
                          />
                        </div>
                        <div>
                          <label htmlFor={pwdIdNew} className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                            Nouveau mot de passe
                          </label>
                          <PasswordInputWithToggle
                            id={pwdIdNew}
                            value={pwdNew}
                            onChange={setPwdNew}
                            autoComplete="new-password"
                            inputClass="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                            isDark={isDark}
                            minLength={8}
                            placeholder="8 caractères minimum"
                          />
                        </div>
                        <div>
                          <label htmlFor={pwdIdConf} className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                            Confirmation
                          </label>
                          <PasswordInputWithToggle
                            id={pwdIdConf}
                            value={pwdConfirm}
                            onChange={setPwdConfirm}
                            autoComplete="new-password"
                            inputClass="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                            isDark={isDark}
                            minLength={8}
                            placeholder="Répéter le nouveau mot de passe"
                          />
                        </div>
                      </div>

                      {pwdMsg && (
                        <div className={`mt-4 flex items-start gap-3 p-4 rounded-xl text-sm ${
                          pwdMsg.type === 'ok'
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300'
                        }`}>
                          {pwdMsg.type === 'ok'
                            ? <Check className="w-4 h-4 shrink-0 mt-0.5" />
                            : <X className="w-4 h-4 shrink-0 mt-0.5" />}
                          {pwdMsg.text}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={pwdLoading}
                        onClick={() => void handleChangePassword()}
                        className="w-full mt-5 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                      >
                        {pwdLoading ? 'Mise à jour…' : 'Enregistrer le nouveau mot de passe'}
                      </button>
                    </div>
                  </div>
                )}

              {/* ── Tab: Correspondance ───────────── */}
              {settingsTab === 'token' && (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Jeton d'accès patient</p>
                    <p className="text-xs text-slate-500 leading-relaxed mb-5">
                      Si la DSI vous a remis un jeton d'accès au proxy de correspondance, collez-le ici. Il est conservé uniquement dans ce navigateur pour la session en cours.
                    </p>

                    <div className="relative mb-3">
                      <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        autoComplete="off"
                        value={inboundTokenDraft}
                        onChange={e => setInboundTokenDraft(e.target.value)}
                        placeholder="Coller le jeton ici…"
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none focus:border-emerald-400 dark:focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    {/* Token status indicator */}
                    {getStoredInboundToken() && (
                      <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Jeton actif dans cette session</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setStoredInboundToken(inboundTokenDraft)}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={() => { setStoredInboundToken(null); setInboundTokenDraft(''); }}
                        className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-800 transition-all"
                      >
                        Effacer
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isFormOpen && (
        <CaseForm
          key={caseToEdit?.id ?? 'new'}
          mode={caseToEdit ? 'edit' : 'create'}
          caseToEdit={caseToEdit ?? undefined}
          nextCaseCode={getNextCaseCode(cases)}
          onSave={handleAddCase}
          onUpdate={handleUpdateCase}
          onClose={() => {
            setIsFormOpen(false);
            setCaseToEdit(null);
          }}
          isDark={isDark}
        />
      )}

      {isTrainingOpen && (
        <TrainingModule
          cases={cases}
          onClose={() => setIsTrainingOpen(false)}
        />
      )}
    </div>
  );
}
