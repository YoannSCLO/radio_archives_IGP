
import React, { useState, useRef } from 'react';
import { Specialty, Difficulty, Modality, RadioCase, ImageSeries } from '../types';
import { analyzeCase } from '../services/geminiService';
import { Loader2, Sparkles, X, ClipboardList, User, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';

interface CaseFormProps {
  onSave: (data: Omit<RadioCase, 'id' | 'dateAdded'>) => void;
  onClose: () => void;
  isDark?: boolean;
}

export const CaseForm: React.FC<CaseFormProps> = ({ onSave, onClose, isDark }) => {
  const [formData, setFormData] = useState({
    patientId: '',
    lastName: '',
    firstName: '',
    specialty: Specialty.NEURORADIOLOGY,
    difficulty: Difficulty.BEGINNER,
    modality: Modality.MRI,
    clinicalNote: '',
    diagnosis: '',
    series: [] as ImageSeries[]
  });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async () => {
    if (!formData.clinicalNote) return;
    setIsAnalyzing(true);
    const result = await analyzeCase(formData.clinicalNote);
    if (result) {
      const suggestedSpecialty = Object.values(Specialty).find(s => 
        s.toLowerCase().includes(result.specialty.toLowerCase())
      ) || formData.specialty;

      const suggestedDifficulty = Object.values(Difficulty).find(d => 
        d.toLowerCase().includes(result.difficulty.toLowerCase())
      ) || formData.difficulty;

      setFormData(prev => ({
        ...prev,
        specialty: suggestedSpecialty,
        difficulty: suggestedDifficulty,
        diagnosis: result.summary || prev.diagnosis
      }));
    }
    setIsAnalyzing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push(base64);
    }

    setFormData(prev => ({
      ...prev,
      series: [...prev.series, { name: `Série ${prev.series.length + 1}`, images: newImages }]
    }));
  };

  const removeSeries = (index: number) => {
    setFormData(prev => ({
      ...prev,
      series: prev.series.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const inputClasses = `w-full px-4 py-3 border rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all text-sm font-medium ${
    isDark 
    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 shadow-inner' 
    : 'bg-slate-50 border-slate-100 text-slate-900 placeholder-slate-400 shadow-inner'
  }`;

  const labelClasses = `block text-[11px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'} rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in duration-200`}>
        <div className={`flex items-center justify-between px-8 py-6 border-b ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-50 bg-white'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-xl text-white">
              <ClipboardList className="w-5 h-5" />
            </div>
            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Édition du Cas Clinique</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
          {/* Section Identité */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-blue-500" />
                <span className={labelClasses}>Identité du Patient</span>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <input required type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} placeholder="Nom" className={inputClasses} />
               <input required type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} placeholder="Prénom" className={inputClasses} />
             </div>
             <input required type="text" value={formData.patientId} onChange={e => setFormData({...formData, patientId: e.target.value})} placeholder="Identifiant Patient (ID / IPP)" className={inputClasses} />
          </div>

          {/* Section Médicale */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClasses}>Modalité</label>
              <select value={formData.modality} onChange={e => setFormData({...formData, modality: e.target.value as Modality})} className={inputClasses}>
                {Object.values(Modality).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClasses}>Discipline</label>
              <select value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value as Specialty})} className={inputClasses}>
                {Object.values(Specialty).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClasses}>Complexité</label>
              <select value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: e.target.value as Difficulty})} className={inputClasses}>
                {Object.values(Difficulty).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Séries d'images (Radiopaedia style) */}
          <div className="bg-blue-50/30 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <span className={labelClasses}>Séries d'intérêt (Stacks)</span>
              </div>
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-[10px] font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-all"
              >
                <Plus className="w-3 h-3" /> Ajouter une Pile
              </button>
              <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            </div>
            
            <div className="space-y-3">
              {formData.series.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden">
                      {s.images[0] && <img src={s.images[0]} alt="preview" className="w-full h-full object-cover" />}
                    </div>
                    <div>
                      <input 
                        type="text" 
                        value={s.name} 
                        onChange={(e) => {
                          const newSeries = [...formData.series];
                          newSeries[idx].name = e.target.value;
                          setFormData({...formData, series: newSeries});
                        }}
                        className="text-xs font-bold bg-transparent outline-none border-b border-transparent focus:border-blue-500"
                      />
                      <p className="text-[10px] text-slate-400">{s.images.length} coupes (slices)</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeSeries(idx)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {formData.series.length === 0 && (
                <p className="text-[10px] text-slate-400 italic text-center py-4">Aucune série d'images pour le moment.</p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className={labelClasses}>Anamnèse & Clinique</label>
              <button type="button" onClick={handleAnalyze} disabled={isAnalyzing || !formData.clinicalNote} className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-all px-3 py-1.5 rounded-lg ${isDark ? 'text-blue-400 bg-blue-900/30 hover:bg-blue-900/50' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'} disabled:opacity-30`}>
                {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Analyse IA
              </button>
            </div>
            <textarea rows={3} required value={formData.clinicalNote} onChange={e => setFormData({...formData, clinicalNote: e.target.value})} className={`${inputClasses} resize-none`} placeholder="Renseignements cliniques..." />
          </div>

          <div>
            <label className={labelClasses}>Sémiologie & Diagnostic</label>
            <textarea rows={2} required value={formData.diagnosis} onChange={e => setFormData({...formData, diagnosis: e.target.value})} className={`${inputClasses} resize-none`} placeholder="Diagnostic final..." />
          </div>
        </form>

        <div className={`p-8 border-t flex gap-4 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-50 bg-slate-50/50'}`}>
          <button type="button" onClick={onClose} className="flex-1 px-6 py-3 text-sm font-bold rounded-2xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">Annuler</button>
          <button onClick={handleSubmit} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Sauvegarder</button>
        </div>
      </div>
    </div>
  );
};
