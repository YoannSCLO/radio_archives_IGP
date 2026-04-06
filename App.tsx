
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Specialty, Difficulty, Modality, RadioCase, ImageSeries } from './types';
import { SPECIALTY_MAP, DIFFICULTY_MAP } from './constants';
import { Badge } from './components/Badge';
import { CaseForm } from './components/CaseForm';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { semanticSearch } from './services/geminiService';
import { postPatientMapping, getStoredInboundToken, setStoredInboundToken } from './services/patientMappingService';
import { fetchSession, logout as authLogout, type SessionInfo } from './services/authService';
import { 
  Plus, 
  Search, 
  Database, 
  ChevronRight, 
  ChevronLeft,
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
  Maximize2,
  Star,
  Hash,
  ListFilter,
  Activity,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  KeyRound,
  LogOut,
  Pencil
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

const MedicalStackViewer = ({ series }: { series: ImageSeries[] }) => {
  const [activeSeriesIdx, setActiveSeriesIdx] = useState(0);
  const [sliceIdx, setSliceIdx] = useState(0);
  const [isMaximized, setIsMaximized] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const activeSeries = series[activeSeriesIdx];
  const maxSlices = activeSeries?.images.length || 0;

  useEffect(() => {
    setSliceIdx(0);
    resetView();
  }, [activeSeriesIdx]);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      setZoom(prev => Math.min(Math.max(prev - e.deltaY * 0.002, 0.5), 5));
      e.preventDefault();
    } else {
      if (e.deltaY > 0) setSliceIdx(prev => Math.min(prev + 1, maxSlices - 1));
      else setSliceIdx(prev => Math.max(prev - 1, 0));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const ViewerControls = () => (
    <>
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setZoom(z => Math.min(z + 0.3, 5))} className={controlsClass} title="Zoomer">
          <ZoomIn className="w-5 h-5" />
        </button>
        <button onClick={() => setZoom(z => Math.max(z - 0.3, 0.5))} className={controlsClass} title="Dézoomer">
          <ZoomOut className="w-5 h-5" />
        </button>
        <button onClick={resetView} className={controlsClass} title="Réinitialiser vue">
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setSliceIdx(s => Math.max(s - 1, 0))} className={controlsClass} title="Coupe précédente">
          <ChevronUp className="w-5 h-5" />
        </button>
        <div className="h-24 w-1.5 bg-white/10 rounded-full mx-auto overflow-hidden relative">
          <div 
            className="absolute top-0 left-0 w-full bg-blue-500 transition-all duration-200" 
            style={{ height: `${((sliceIdx + 1) / maxSlices) * 100}%` }}
          />
        </div>
        <button onClick={() => setSliceIdx(s => Math.min(s + 1, maxSlices - 1))} className={controlsClass} title="Coupe suivante">
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>
    </>
  );

  const SeriesSelector = () => (
    <div className="bg-slate-900/60 backdrop-blur-xl border-t border-white/5 p-4 flex justify-center gap-3 overflow-x-auto no-scrollbar pointer-events-auto">
      {series.map((s, idx) => (
        <button 
          key={idx}
          onClick={() => setActiveSeriesIdx(idx)}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold uppercase transition-all whitespace-nowrap border ${activeSeriesIdx === idx ? 'bg-white text-black border-white shadow-xl scale-105' : 'bg-black/40 text-white/40 border-white/10 hover:bg-black/60'}`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            {s.name}
          </div>
        </button>
      ))}
    </div>
  );

  if (!series || series.length === 0) {
    return (
      <div className="h-full min-h-[450px] flex flex-col items-center justify-center bg-slate-950 rounded-[2.5rem] border border-slate-800 p-8 text-center">
        <Monitor className="w-10 h-10 text-slate-800 mb-4" />
        <p className="text-slate-600 text-sm font-medium italic">Imagerie non disponible.</p>
      </div>
    );
  }

  const controlsClass = "p-3 bg-white/15 backdrop-blur-md hover:bg-blue-600 rounded-2xl text-white transition-all shadow-xl border border-white/10 active:scale-90 pointer-events-auto";

  return (
    <>
      <div 
        className="relative bg-black rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-slate-800 group h-[600px] shadow-2xl flex flex-col"
        onWheel={handleWheel}
      >
        <div className="absolute top-0 inset-x-0 p-8 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start z-20 pointer-events-none">
          <div className="drop-shadow-md">
            <h5 className="text-white font-semibold text-xs uppercase tracking-widest opacity-80">{activeSeries.name}</h5>
            <p className="text-blue-400 text-sm font-light tracking-tighter">Coupe {sliceIdx + 1} / {maxSlices}</p>
          </div>
          <div className="flex gap-3 pointer-events-auto">
            <button onClick={() => setIsMaximized(true)} className={controlsClass} title="Plein écran">
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <ViewerControls />

        <div 
          className="flex-1 w-full h-full flex items-center justify-center select-none bg-[#050505] overflow-hidden cursor-move"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img 
            src={activeSeries.images[sliceIdx]} 
            alt="Medical scan" 
            draggable={false}
            className="max-w-full max-h-full object-contain transition-transform duration-75 ease-out"
            style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)` }}
          />
        </div>

        <SeriesSelector />
      </div>

      {isMaximized && (
        <div 
          className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300"
          onWheel={handleWheel}
        >
          <div className="flex items-center justify-between px-10 py-8 bg-black border-b border-white/10">
            <div className="flex flex-col">
              <h2 className="text-white font-light text-2xl tracking-tighter">Diagnostic Expert IGP</h2>
              <p className="text-blue-400 text-xs uppercase font-bold tracking-widest mt-1">Série : {activeSeries.name} • Coupe {sliceIdx + 1}/{maxSlices}</p>
            </div>
            <div className="flex gap-6">
              <button onClick={resetView} className="px-6 py-3 bg-white/10 text-white rounded-2xl text-xs font-bold uppercase hover:bg-white/20 transition-all flex items-center gap-2">
                <RotateCcw className="w-5 h-5" /> Reset Vue
              </button>
              <button onClick={() => setIsMaximized(false)} className="p-4 bg-white/10 text-white rounded-full hover:bg-rose-600 transition-all">
                <X className="w-8 h-8" />
              </button>
            </div>
          </div>
          
          <div 
            className="flex-1 flex items-center justify-center overflow-hidden cursor-move relative group"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
             <ViewerControls />
             <img 
               src={activeSeries.images[sliceIdx]} 
               draggable={false}
               className="max-w-full max-h-full object-contain" 
               style={{ transform: `scale(${zoom * 1.5}) translate(${pan.x / (zoom * 1.5)}px, ${pan.y / (zoom * 1.5)}px)` }} 
             />
          </div>

          <div className="p-10 bg-black/90 backdrop-blur-2xl border-t border-white/10 flex flex-col gap-6">
              <div className="flex justify-center items-center gap-8">
                <button onClick={() => setSliceIdx(s => Math.max(s - 1, 0))} className="p-5 bg-white/5 text-white rounded-3xl hover:bg-blue-600 transition-all"><ChevronLeft className="w-8 h-8" /></button>
                <div className="flex items-center gap-6 text-white font-mono">
                  <span className="text-sm opacity-40 font-bold uppercase tracking-widest">Image</span>
                  <span className="text-3xl font-black">{sliceIdx + 1}</span>
                  <span className="text-xl opacity-30">/ {maxSlices}</span>
                </div>
                <button onClick={() => setSliceIdx(s => Math.min(s + 1, maxSlices - 1))} className="p-5 bg-white/5 text-white rounded-3xl hover:bg-blue-600 transition-all"><ChevronRight className="w-8 h-8" /></button>
              </div>
              <SeriesSelector />
          </div>
        </div>
      )}
    </>
  );
};

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

/** Modification réservée à l’auteur lorsque la connexion est obligatoire. Sans auth obligatoire, tout utilisateur peut modifier (justification). */
function canEditCase(session: SessionInfo, c: RadioCase): boolean {
  if (!session.authRequired) return true;
  if (!session.authenticated) return false;
  const u = 'username' in session ? session.username?.trim().toLowerCase() : undefined;
  if (!u || !c.authorEmail) return false;
  return c.authorEmail === u;
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
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inboundTokenDraft, setInboundTokenDraft] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
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
    const saved = localStorage.getItem('radio_cases');
    const initialData = migrateLoadedCases(saved ? JSON.parse(saved) : []);
    setCases(initialData);
    isInitialMount.current = false;
  }, []);

  useEffect(() => {
    if (!isInitialMount.current) {
      localStorage.setItem('radio_cases', JSON.stringify(cases));
    }
  }, [cases]);

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

  const deleteCase = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Supprimer définitivement ce cas ?')) {
      setCases(prev => prev.filter(c => c.id !== id));
      setFavorites(prev => prev.filter(fid => fid !== id));
      if (expandedCaseId === id) setExpandedCaseId(null);
    }
  };

  const handleAuthLogout = async () => {
    await authLogout();
    const s = await fetchSession();
    setSession(s);
  };

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
          onSuccess={() => void fetchSession().then(setSession)}
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
      <header className="sticky top-0 z-40 bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl border-b border-slate-200/50 dark:border-slate-800/50 h-28 flex items-center">
        <div className="max-w-7xl mx-auto px-8 w-full flex items-center justify-between">
          <div className="flex items-center gap-12">
            <IGPLogo className="h-12 w-auto" />
            <div className="hidden md:block h-10 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
            <RadioArchiveLogo />
          </div>

          <div className="flex items-center gap-4">
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
              onClick={() => {
                setCaseToEdit(null);
                setIsFormOpen(true);
              }}
              className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-full font-bold text-base shadow-xl shadow-blue-500/30 active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>Nouveau Dossier</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-14">
        <div className="mb-20">
          <div className="flex items-center justify-between mb-10">
            <div className="flex flex-col">
              <h2 className="text-4xl font-light tracking-tighter text-slate-900 dark:text-white">Tableau de Bord <span className="text-blue-600 font-bold">IGP</span></h2>
              <p className="text-xs uppercase tracking-[0.4em] font-bold text-slate-400 mt-2">Statistiques</p>
            </div>
            <button onClick={() => setIsStatsOpen(!isStatsOpen)} className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-all shadow-md">
              <Activity className="w-5 h-5" />
              {isStatsOpen ? 'Masquer Insights' : 'VOIR'}
            </button>
          </div>
          
          {isStatsOpen && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-top-4 duration-500">
               <div className="bg-white dark:bg-slate-900/50 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group">
                <div className="flex items-center gap-4 mb-10">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600"><Hash className="w-5 h-5" /></div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Spécialités</h3>
                </div>
                <div className="space-y-6">
                  {stats.specialty.slice(0, 6).map(([name, count]) => (
                    <div key={name} className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-500 dark:text-slate-400 truncate w-40">{name}</span>
                        <span className="text-blue-600">{count}</span>
                      </div>
                      <div className="h-2 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600/60 rounded-full transition-all duration-1000" style={{ width: `${(count / (cases.length || 1)) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/50 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
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
                        <div className="h-2.5 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
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

              <div className="bg-white dark:bg-slate-900/50 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4 mb-10">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600"><Monitor className="w-5 h-5" /></div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Modalités</h3>
                </div>
                <div className="space-y-6">
                  {stats.modality.map(([name, count]) => (
                    <div key={name} className="flex items-center gap-5">
                      <span className="text-xs font-black text-slate-500 w-16">{name}</span>
                      <div className="flex-1 h-5 bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden relative">
                        <div className="h-full bg-emerald-500/40 transition-all duration-1000" style={{ width: `${(count / (cases.length || 1)) * 100}%` }} />
                        <span className="absolute right-3 top-0 text-[10px] font-black text-emerald-700 leading-5">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl p-4 rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 shadow-lg mb-8 flex flex-col lg:flex-row gap-6 items-center">
          <div className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar w-full lg:w-auto p-1">
            {tabs.map(tab => {
              const info = tabDetailedCounts[tab];
              const showRatio = searchQuery.length > 0 || smartResults !== null;
              return (
                <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex items-center gap-3 px-8 py-4 rounded-2xl whitespace-nowrap text-xs font-bold tracking-tight transition-all ${activeTab === tab ? 'bg-slate-950 dark:bg-white text-white dark:text-slate-950 shadow-xl scale-105' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  {tab === 'Favoris' && <Star className={`w-4 h-4 ${favorites.length > 0 ? 'fill-yellow-400 text-yellow-400' : ''}`} />}
                  {tab} 
                  <span className={`text-[11px] font-black ${activeTab === tab ? 'opacity-40' : 'text-slate-300'}`}>
                    {showRatio ? `${info?.visible}/${info?.total}` : info?.total}
                  </span>
                </button>
              );
            })}
            <button onClick={() => setIsSettingsOpen(true)} className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-600 transition-all ml-4 shadow-sm"><Settings2 className="w-5 h-5" /></button>
          </div>
          <div className="relative group w-full lg:w-96">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              value={searchQuery} 
              onChange={e => {setSearchQuery(e.target.value); if(!e.target.value) setSmartResults(null);}} 
              onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()}
              placeholder="Recherche n° de cas, lésion, diagnostic..." 
              className="w-full pl-14 pr-14 py-4.5 bg-slate-50 dark:bg-slate-950 border border-transparent dark:border-slate-800 focus:border-blue-500/30 rounded-2xl outline-none font-medium text-base transition-all shadow-inner" 
            />
            <button 
              onClick={handleSmartSearch} 
              disabled={isSmartLoading || !searchQuery} 
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-blue-500 disabled:opacity-20 transition-all hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              {isSmartLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 mb-12 text-xs font-black text-slate-400 uppercase tracking-[0.4em]">
           <ListFilter className="w-4 h-4" />
           <span>Cas affichés : <span className="text-blue-600 font-black">{filteredCases.length}</span> / Total Base : <span className="text-slate-900 dark:text-white font-black">{cases.length}</span></span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200/50 dark:border-slate-800/50 shadow-xl overflow-hidden no-print">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                <th className="px-12 py-8 text-xs font-black text-slate-400 uppercase tracking-widest">Référence dossier</th>
                <th className="px-12 py-8 text-xs font-black text-slate-400 uppercase tracking-widest">Spécialité & Niveau</th>
                <th className="px-12 py-8 text-xs font-black text-slate-400 uppercase tracking-widest">Diagnostic & Clinique</th>
                <th className="px-12 py-8 text-right">Options</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {filteredCases.map((c) => {
                const isExpanded = expandedCaseId === c.id;
                const isFavorite = favorites.includes(c.id);
                return (
                  <React.Fragment key={c.id}>
                    <tr 
                      onClick={() => setExpandedCaseId(isExpanded ? null : c.id)} 
                      className={`cursor-pointer group transition-all duration-300 ${isExpanded ? 'bg-blue-50/15 dark:bg-blue-900/5' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'}`}
                    >
                      <td className="px-12 py-10">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
                              {c.caseCode}
                            </span>
                            {isFavorite && <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
                          </div>
                        </div>
                      </td>
                      <td className="px-12 py-10">
                        <div className="flex flex-wrap gap-3">
                          <Badge label={c.specialty} colorClass={SPECIALTY_MAP[c.specialty].color} bgClass={SPECIALTY_MAP[c.specialty].bg} />
                          <Badge label={c.difficulty} colorClass={DIFFICULTY_MAP[c.difficulty].color} bgClass={DIFFICULTY_MAP[c.difficulty].bg} dotClass={DIFFICULTY_MAP[c.difficulty].dot} />
                        </div>
                      </td>
                      <td className="px-12 py-10">
                        <div className="flex flex-col max-w-sm">
                          <span className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate leading-snug">{c.diagnosis}</span>
                          <span className="text-sm text-slate-400 dark:text-slate-500 truncate mt-2 italic font-light leading-relaxed">{c.clinicalNote}</span>
                        </div>
                      </td>
                      <td className="px-12 py-10 text-right">
                        <div className="flex items-center justify-end gap-4" onClick={e => e.stopPropagation()}>
                           <button onClick={(e) => { e.stopPropagation(); toggleFavorite(c.id); }} className={`p-3 rounded-2xl transition-all ${isFavorite ? 'bg-yellow-400/15 text-yellow-500' : 'text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}>
                             <Star className={`w-5 h-5 ${isFavorite ? 'fill-yellow-400' : ''}`} />
                           </button>
                           {canEditCase(session, c) && (
                             <button
                               type="button"
                               title="Modifier ce cas (auteur)"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setCaseToEdit(c);
                                 setIsFormOpen(true);
                               }}
                               className="p-3 text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 rounded-2xl transition-all"
                             >
                               <Pencil className="w-5 h-5" />
                             </button>
                           )}
                           <button onClick={(e) => deleteCase(e, c.id)} className="p-3 text-slate-300 hover:text-rose-600 rounded-2xl transition-all">
                             <Trash2 className="w-5 h-5" />
                           </button>
                           <ChevronRight className={`w-6 h-6 text-slate-300 transition-transform ${isExpanded ? 'rotate-90 text-blue-500 scale-110' : ''}`} />
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/10 dark:bg-slate-900/10">
                        <td colSpan={4} className="px-14 py-14">
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-14">
                            <div className="lg:col-span-5 space-y-10">
                              <div>
                                <h4 className="text-xs font-black text-blue-600 uppercase tracking-[0.4em] mb-6">Diagnostic Final</h4>
                                <div className="p-8 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-md leading-relaxed text-base font-medium">
                                  {c.diagnosis}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] mb-6">Contexte Clinique</h4>
                                <p className="text-base text-slate-500 dark:text-slate-400 leading-loose font-light px-2">{c.clinicalNote}</p>
                              </div>
                              {(c.lastModifiedAt || c.lastEditJustification) && (
                                <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/30 px-6 py-4 text-sm text-amber-900 dark:text-amber-100/90">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-2">
                                    Dernière modification
                                  </p>
                                  {c.lastModifiedAt && (
                                    <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mb-2">
                                      {new Date(c.lastModifiedAt).toLocaleString('fr-FR')}
                                    </p>
                                  )}
                                  {c.lastEditJustification && (
                                    <p className="leading-relaxed">
                                      <span className="font-semibold">Justification : </span>
                                      {c.lastEditJustification}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
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
            <div className="py-32 flex flex-col items-center text-slate-400">
               <Database className="w-16 h-16 mb-6 opacity-10" />
               <p className="text-base font-light tracking-tight">Aucun cas clinique ne correspond à votre sélection.</p>
            </div>
          )}
        </div>
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-950/60 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-10 border-b dark:border-slate-800">
              <h2 className="text-2xl font-light tracking-tighter">Configuration</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto no-scrollbar">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Filtres spécialités</p>
                  <div className="space-y-4">
                    {Object.values(Specialty).map(s => (
                      <button key={s} onClick={() => toggleSpecialtyVisibility(s)} className={`flex items-center justify-between w-full p-5 rounded-2xl border transition-all ${visibleSpecialties.includes(s) ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 shadow-sm' : 'bg-transparent border-slate-100 dark:border-slate-800 opacity-60'}`}>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{s}</span>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${visibleSpecialties.includes(s) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 dark:border-slate-700'}`}>{visibleSpecialties.includes(s) && <Check className="w-5 h-5" strokeWidth={3} />}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <KeyRound className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Correspondance patient</p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Si la DSI vous a donné un jeton d&apos;accès, collez-le ici pour cette session (uniquement sur ce navigateur).
                  </p>
                  <input
                    type="password"
                    autoComplete="off"
                    value={inboundTokenDraft}
                    onChange={(e) => setInboundTokenDraft(e.target.value)}
                    placeholder="Jeton d'accès au proxy"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setStoredInboundToken(inboundTokenDraft); }}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest"
                    >
                      Enregistrer le jeton (session)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setStoredInboundToken(null); setInboundTokenDraft(''); }}
                      className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500"
                    >
                      Effacer
                    </button>
                  </div>
                </div>
            </div>
            <div className="p-10 border-t dark:border-slate-800">
              <button onClick={() => setIsSettingsOpen(false)} className="w-full py-5 bg-slate-950 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-black uppercase tracking-[0.25em] text-xs shadow-2xl active:scale-95 transition-transform">Valider la Configuration</button>
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
    </div>
  );
}
