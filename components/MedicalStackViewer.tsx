
import React, { useState, useEffect, useRef } from 'react';
import { ImageSeries } from '../types';
import {
  ZoomIn, ZoomOut, RotateCcw, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, Maximize2, Monitor, Layers, X
} from 'lucide-react';

const controlsClass =
  'p-3 bg-white/15 backdrop-blur-md hover:bg-blue-600 rounded-2xl text-white transition-all shadow-xl border border-white/10 active:scale-90 pointer-events-auto';

export const MedicalStackViewer = ({ series }: { series: ImageSeries[] }) => {
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
    setZoom(1);
    setPan({ x: 0, y: 0 });
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
      setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  if (!series || series.length === 0) {
    return (
      <div className="h-full min-h-[450px] flex flex-col items-center justify-center bg-slate-950 rounded-[2.5rem] border border-slate-800 p-8 text-center">
        <Monitor className="w-10 h-10 text-slate-800 mb-4" />
        <p className="text-slate-600 text-sm font-medium italic">Imagerie non disponible.</p>
      </div>
    );
  }

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
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold uppercase transition-all whitespace-nowrap border ${
            activeSeriesIdx === idx
              ? 'bg-white text-black border-white shadow-xl scale-105'
              : 'bg-black/40 text-white/40 border-white/10 hover:bg-black/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            {s.name}
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div
        className="relative bg-black rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-slate-800 group h-[600px] shadow-2xl flex flex-col"
        onWheel={handleWheel}
      >
        <div className="absolute top-0 inset-x-0 p-8 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start z-20 pointer-events-none">
          <div className="drop-shadow-md">
            <h5 className="text-white font-semibold text-xs uppercase tracking-widest opacity-80">{activeSeries.name}</h5>
            <p className="text-blue-400 text-sm font-light tracking-tighter">
              Coupe {sliceIdx + 1} / {maxSlices}
            </p>
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
          className="fixed inset-0 z-[200] bg-black flex flex-col animate-in fade-in duration-300"
          onWheel={handleWheel}
        >
          <div className="flex items-center justify-between px-10 py-8 bg-black border-b border-white/10">
            <div className="flex flex-col">
              <h2 className="text-white font-light text-2xl tracking-tighter">Diagnostic Expert IGP</h2>
              <p className="text-blue-400 text-xs uppercase font-bold tracking-widest mt-1">
                Série : {activeSeries.name} • Coupe {sliceIdx + 1}/{maxSlices}
              </p>
            </div>
            <div className="flex gap-6">
              <button
                onClick={resetView}
                className="px-6 py-3 bg-white/10 text-white rounded-2xl text-xs font-bold uppercase hover:bg-white/20 transition-all flex items-center gap-2"
              >
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
              <button
                onClick={() => setSliceIdx(s => Math.max(s - 1, 0))}
                className="p-5 bg-white/5 text-white rounded-3xl hover:bg-blue-600 transition-all"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <div className="flex items-center gap-6 text-white font-mono">
                <span className="text-sm opacity-40 font-bold uppercase tracking-widest">Image</span>
                <span className="text-3xl font-black">{sliceIdx + 1}</span>
                <span className="text-xl opacity-30">/ {maxSlices}</span>
              </div>
              <button
                onClick={() => setSliceIdx(s => Math.min(s + 1, maxSlices - 1))}
                className="p-5 bg-white/5 text-white rounded-3xl hover:bg-blue-600 transition-all"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>
            <SeriesSelector />
          </div>
        </div>
      )}
    </>
  );
};
