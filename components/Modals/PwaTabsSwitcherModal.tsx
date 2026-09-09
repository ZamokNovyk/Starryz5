'use client';

import React from 'react';
import {
  X,
  Plus,
  Trash2,
  ExternalLink,
  GraduationCap,
  UserCheck,
  Building2,
  Wrench,
  Search,
  Home,
  CheckCircle2,
  Sparkles,
  Layers,
  Smartphone
} from 'lucide-react';
import { usePwaTabs, PwaTab, TabType } from '@/src/context/PwaTabsContext';

interface PwaTabsSwitcherModalProps {
  onNavigate: (pathname: string, search?: string) => void;
}

function getTabIcon(type: TabType) {
  switch (type) {
    case 'professor':
      return <GraduationCap className="w-5 h-5 text-indigo-400" />;
    case 'student':
      return <UserCheck className="w-5 h-5 text-amber-400" />;
    case 'center':
      return <Building2 className="w-5 h-5 text-sky-400" />;
    case 'tools':
      return <Wrench className="w-5 h-5 text-purple-400" />;
    case 'search':
      return <Search className="w-5 h-5 text-blue-400" />;
    case 'home':
    default:
      return <Home className="w-5 h-5 text-emerald-400" />;
  }
}

function getTabBadge(type: TabType) {
  switch (type) {
    case 'professor':
      return { text: 'PROFESOR', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
    case 'student':
      return { text: 'ESTUDIANTE', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    case 'center':
      return { text: 'CENTRO', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' };
    case 'tools':
      return { text: 'HERRAMIENTAS', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
    case 'search':
      return { text: 'BÚSQUEDA', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
    case 'admin':
      return { text: 'ADMIN', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
    case 'home':
    default:
      return { text: 'CAMPUS', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
  }
}

export default function PwaTabsSwitcherModal({ onNavigate }: PwaTabsSwitcherModalProps) {
  const {
    isTabsSwitcherOpen,
    setIsTabsSwitcherOpen,
    tabs,
    activeTabId,
    switchTab,
    closeTab,
    closeAllTabs,
    createNewTab
  } = usePwaTabs();

  if (!isTabsSwitcherOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#07080b]/95 backdrop-blur-2xl flex flex-col animate-in fade-in duration-200">
      
      {/* Top Header Bar */}
      <header className="px-4 sm:px-6 py-3.5 border-b border-zinc-800/80 bg-[#0e0f14] flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black">
            <span className="text-xs">{tabs.length}</span>
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2 tracking-tight">
              Pestañas de la App
              <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Smartphone className="w-2.5 h-2.5" /> PWA Activa
              </span>
            </h2>
            <p className="text-[11px] text-zinc-400">Navega y compara perfiles simultáneamente</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tabs.length > 1 && (
            <button
              onClick={() => closeAllTabs(onNavigate)}
              className="px-2.5 py-1.5 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/60 transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              title="Cerrar todas las pestañas"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cerrar todas</span>
            </button>
          )}

          <button
            onClick={() => createNewTab('/', onNavigate)}
            className="px-3.5 py-1.5 rounded-xl bg-[#eab308] hover:bg-[#ca9a07] text-black text-xs font-black transition-all flex items-center gap-1.5 shadow-[0_2px_12px_rgba(234,179,8,0.3)] active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nueva</span>
          </button>

          <button
            onClick={() => setIsTabsSwitcherOpen(false)}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
            title="Volver"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Tabs Grid Container */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto pb-28">
        
        {/* Quick Launch Short-cuts */}
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 shrink-0">
            Abrir nueva:
          </span>
          <button
            onClick={() => createNewTab('/', onNavigate)}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 text-zinc-300 hover:text-white transition flex items-center gap-1.5 shrink-0 text-xs cursor-pointer"
          >
            <Home className="w-3.5 h-3.5 text-emerald-400" />
            <span>Campus</span>
          </button>
          <button
            onClick={() => createNewTab('/search', onNavigate)}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 text-zinc-300 hover:text-white transition flex items-center gap-1.5 shrink-0 text-xs cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-blue-400" />
            <span>Buscador</span>
          </button>
          <button
            onClick={() => createNewTab('/herramientas', onNavigate)}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 text-zinc-300 hover:text-white transition flex items-center gap-1.5 shrink-0 text-xs cursor-pointer"
          >
            <Wrench className="w-3.5 h-3.5 text-purple-400" />
            <span>Herramientas</span>
          </button>
        </div>

        {/* Tab Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const badge = getTabBadge(tab.type);

            return (
              <div
                key={tab.id}
                onClick={() => switchTab(tab.id, onNavigate)}
                className={`group relative rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer flex flex-col justify-between border-2 select-none ${
                  isActive
                    ? 'border-[#eab308] bg-[#14151d] shadow-[0_0_25px_rgba(234,179,8,0.2)] scale-[1.01]'
                    : 'border-zinc-800 hover:border-zinc-700 bg-[#0e0f14] hover:bg-[#12131a]'
                }`}
              >
                {/* Card Window Header */}
                <div className={`px-3.5 py-2.5 border-b flex items-center justify-between gap-2 ${
                  isActive ? 'bg-[#181924] border-amber-500/30' : 'bg-[#121318] border-zinc-800/80'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border tracking-wider uppercase ${badge.color}`}>
                      {badge.text}
                    </span>
                    <span className="text-xs font-bold text-white truncate" title={tab.title}>
                      {tab.title}
                    </span>
                  </div>

                  {/* Close Tab Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id, onNavigate);
                    }}
                    className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/80 transition-colors shrink-0 cursor-pointer"
                    title="Cerrar pestaña"
                    aria-label="Cerrar pestaña"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Card Preview Body */}
                <div className="p-4 sm:p-5 flex flex-col justify-between flex-1 gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isActive ? 'bg-amber-500/10 border-amber-500/40' : 'bg-zinc-900 border-zinc-800'
                    }`}>
                      {getTabIcon(tab.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                        {tab.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                        {tab.previewSubtitle || tab.pathname}
                      </p>
                      <span className="text-[10px] font-mono text-zinc-500 truncate block mt-1">
                        {tab.pathname}{tab.search}
                      </span>
                    </div>
                  </div>

                  {/* Status footer */}
                  <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                    {isActive ? (
                      <span className="flex items-center gap-1.5 text-amber-400 font-extrabold text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                        Pestaña activa
                      </span>
                    ) : (
                      <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors">
                        Toca para abrir
                      </span>
                    )}

                    <span className="text-[10px] text-zinc-600 font-medium">
                      {new Date(tab.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Bottom Quick New Tab Button for Mobile thumb ergonomics */}
      <footer className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-[#07080b] via-[#07080b]/90 to-transparent flex justify-center pointer-events-none">
        <button
          onClick={() => createNewTab('/', onNavigate)}
          className="pointer-events-auto px-6 py-3 rounded-full bg-[#eab308] hover:bg-[#ca9a07] text-black font-black text-xs uppercase tracking-wider shadow-[0_4px_25px_rgba(234,179,8,0.4)] transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Abrir Nueva Pestaña</span>
        </button>
      </footer>

    </div>
  );
}
