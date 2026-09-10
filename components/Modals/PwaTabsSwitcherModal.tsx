'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Search,
  MoreVertical,
  LayoutGrid,
  Sparkles,
  GraduationCap,
  UserCheck,
  Building2,
  Wrench,
  Home,
  Check,
  ExternalLink,
  Crown,
  FileText,
  Sliders,
  Compass,
  Star
} from 'lucide-react';
import { usePwaTabs, PwaTab, TabType } from '@/src/context/PwaTabsContext';

interface PwaTabsSwitcherModalProps {
  onNavigate: (pathname: string, search?: string) => void;
}

/**
 * Retorna el icono favicon correspondiente a cada tipo de pestaña
 */
function getFaviconIcon(type: TabType) {
  switch (type) {
    case 'professor':
      return (
        <div className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
          <GraduationCap className="w-2.5 h-2.5" />
        </div>
      );
    case 'student':
      return (
        <div className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
          <UserCheck className="w-2.5 h-2.5" />
        </div>
      );
    case 'center':
      return (
        <div className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
          <Building2 className="w-2.5 h-2.5" />
        </div>
      );
    case 'tools':
      return (
        <div className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
          <Wrench className="w-2.5 h-2.5" />
        </div>
      );
    case 'search':
      return (
        <div className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
          <Search className="w-2.5 h-2.5" />
        </div>
      );
    case 'home':
    default:
      return (
        <div className="w-4 h-4 rounded-full bg-amber-500/25 text-[#eab308] flex items-center justify-center">
          <Star className="w-2.5 h-2.5 fill-[#eab308]" />
        </div>
      );
  }
}

/**
 * Renderiza la miniatura fotorrealista de la página similar a Google Chrome mobile
 */
function TabPreviewSnapshot({ tab, isActive }: { tab: PwaTab; isActive: boolean }) {
  // 1. Si la pestaña tiene una captura real (snapshot del DOM de la página), la renderizamos como Google Chrome
  if (tab.snapshotUrl) {
    return (
      <div className="w-full h-full bg-[#121316] relative overflow-hidden flex items-start justify-center select-none">
        <img
          src={tab.snapshotUrl}
          alt={tab.title}
          className="w-full h-full object-cover object-top pointer-events-none select-none transition-transform duration-200"
          loading="lazy"
        />
        <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      </div>
    );
  }

  // 2. Renderizado alternativo dinámico con los datos específicos de la pestaña
  switch (tab.type) {
    case 'student':
      return (
        <div className="w-full h-full bg-[#14151a] p-3 flex flex-col justify-between text-left select-none relative overflow-hidden">
          {/* Cabecera del perfil */}
          <div>
            <div className="h-10 w-full rounded-t-lg bg-gradient-to-r from-amber-600/40 via-purple-600/30 to-amber-500/40 relative">
              <div className="absolute -bottom-3 left-2 w-7 h-7 rounded-full bg-amber-500/30 border-2 border-[#14151a] flex items-center justify-center text-amber-300 font-black text-[10px]">
                {tab.title.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="mt-4 px-1">
              <div className="text-[11px] font-black text-white truncate">{tab.title}</div>
              <div className="text-[9px] text-zinc-400 truncate">Estudiante verificado</div>
            </div>
          </div>

          {/* Mini métricas */}
          <div className="grid grid-cols-2 gap-1.5 my-2">
            <div className="p-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-center">
              <span className="text-[9px] text-rose-400 font-extrabold block">❤️ 120+</span>
              <span className="text-[7px] text-zinc-500 uppercase">Flechazos</span>
            </div>
            <div className="p-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-center">
              <span className="text-[9px] text-amber-400 font-extrabold block">⭐ 4.9</span>
              <span className="text-[7px] text-zinc-500 uppercase">Valoración</span>
            </div>
          </div>

          {/* Botones de acción mini */}
          <div className="space-y-1">
            <div className="w-full py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-[8px] font-bold text-amber-300 text-center">
              Ver perfil completo
            </div>
          </div>
        </div>
      );

    case 'professor':
      return (
        <div className="w-full h-full bg-[#12131a] p-3 flex flex-col justify-between text-left select-none">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-800/80">
              <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 text-[10px] font-bold">
                <GraduationCap className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black text-white truncate">{tab.title}</div>
                <div className="text-[8px] text-indigo-400 font-semibold">Docente Evaluado</div>
              </div>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} className="text-amber-400 text-[10px]">★</span>
                ))}
                <span className="text-[8px] text-zinc-400 font-bold ml-1">4.8 / 5.0</span>
              </div>
              <div className="p-1.5 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-[8px] text-zinc-300 leading-tight line-clamp-2">
                &quot;Excelente docente, explica con claridad y apoya en prácticas.&quot;
              </div>
            </div>
          </div>

          <div className="w-full py-1 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[8px] text-center">
            Calificaciones & Reseñas
          </div>
        </div>
      );

    case 'center':
      return (
        <div className="w-full h-full bg-[#111317] p-2.5 flex flex-col justify-between text-left select-none">
          <div>
            <div className="h-11 w-full rounded-md bg-gradient-to-br from-sky-600/30 to-blue-900/40 p-2 flex items-end">
              <div className="text-[10px] font-black text-white truncate drop-shadow">
                {tab.title}
              </div>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5 text-[8px] text-sky-400 font-bold">
                <Building2 className="w-3 h-3 shrink-0" />
                <span className="truncate">Instituto de Educación Superior</span>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1 text-center">
                <div className="bg-zinc-900 p-1 rounded border border-zinc-800 text-[7px] text-zinc-300">
                  Carreras
                </div>
                <div className="bg-zinc-900 p-1 rounded border border-zinc-800 text-[7px] text-zinc-300">
                  Docentes
                </div>
                <div className="bg-zinc-900 p-1 rounded border border-zinc-800 text-[7px] text-zinc-300">
                  Alumnos
                </div>
              </div>
            </div>
          </div>

          <div className="w-full py-1 rounded bg-sky-500/20 text-sky-300 font-bold text-[8px] text-center border border-sky-500/30">
            Explorar Centro
          </div>
        </div>
      );

    case 'tools':
      return (
        <div className="w-full h-full bg-[#131318] p-3 flex flex-col justify-between text-left select-none">
          <div>
            <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-zinc-800">
              <Wrench className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] font-bold text-white">Utilidades de Estudio</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 flex flex-col items-center justify-center text-center">
                <FileText className="w-3.5 h-3.5 text-rose-400 mb-0.5" />
                <span className="text-[8px] font-bold text-zinc-200">Comprimir</span>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 flex flex-col items-center justify-center text-center">
                <Sliders className="w-3.5 h-3.5 text-purple-400 mb-0.5" />
                <span className="text-[8px] font-bold text-zinc-200">Organizar</span>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-col items-center justify-center text-center col-span-2">
                <span className="text-[8px] font-bold text-amber-300">🎡 Ruleta de Sorteos</span>
              </div>
            </div>
          </div>

          <div className="text-[7px] text-zinc-500 text-center">
            Procesamiento 100% local
          </div>
        </div>
      );

    case 'search':
      return (
        <div className="w-full h-full bg-[#131418] p-3 flex flex-col justify-between text-left select-none">
          <div>
            {/* Barra de búsqueda mini */}
            <div className="w-full px-2 py-1.5 rounded-full bg-zinc-900 border border-zinc-700 flex items-center gap-1.5 mb-2.5">
              <Search className="w-2.5 h-2.5 text-blue-400 shrink-0" />
              <span className="text-[9px] text-zinc-300 truncate">
                {tab.previewSubtitle?.replace('Filtro ', '') || 'Buscar personas...'}
              </span>
            </div>

            {/* Chips de filtro */}
            <div className="flex gap-1 mb-2">
              <span className="text-[7px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">Todo</span>
              <span className="text-[7px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">Docentes</span>
              <span className="text-[7px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">Centros</span>
            </div>

            {/* Mini resultados */}
            <div className="space-y-1.5">
              <div className="p-1.5 rounded bg-zinc-900/90 border border-zinc-800/80">
                <div className="text-[8px] font-bold text-blue-400 truncate">Resultados encontrados</div>
                <div className="text-[7px] text-zinc-400 mt-0.5 line-clamp-1">Perfiles coincidentes con la búsqueda</div>
              </div>
            </div>
          </div>

          <div className="w-full py-1 rounded bg-blue-500/20 text-blue-300 font-bold text-[8px] text-center">
            Ver resultados
          </div>
        </div>
      );

    case 'home':
    default:
      return (
        <div className="w-full h-full bg-[#0f1013] p-3 flex flex-col justify-between text-left select-none relative">
          <div>
            {/* Header Starryz Mini */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 mb-2">
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-[#eab308] text-[#eab308]" />
                <span className="text-[10px] font-black text-white tracking-wider">Starryz</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>

            {/* Hero mini */}
            <div className="w-full p-2 rounded-lg bg-gradient-to-r from-amber-500/15 via-zinc-900 to-amber-500/10 border border-amber-500/20 mb-2">
              <div className="text-[9px] font-black text-white">Campus Digital</div>
              <div className="text-[7px] text-zinc-400 mt-0.5">Rankings y Comunidades</div>
            </div>

            {/* Accesos rápidos mini */}
            <div className="grid grid-cols-2 gap-1">
              <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800 flex items-center gap-1">
                <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                <span className="text-[7px] text-zinc-300 font-bold truncate">Rankings</span>
              </div>
              <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800 flex items-center gap-1">
                <Compass className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                <span className="text-[7px] text-zinc-300 font-bold truncate">Explorar</span>
              </div>
            </div>
          </div>

          <div className="w-full py-1 rounded bg-amber-500/20 text-amber-400 font-bold text-[8px] text-center border border-amber-500/30">
            {isActive ? 'Pestaña actual' : 'Abrir campus'}
          </div>
        </div>
      );
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

  const [tabSearchQuery, setTabSearchQuery] = useState('');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar el menú de tres puntos si se hace click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [moreMenuOpen]);

  // Si no está abierto, no renderizamos
  if (!isTabsSwitcherOpen) return null;

  // Filtrar pestañas en tiempo real según el buscador
  const filteredTabs = tabs.filter((t) => {
    if (!tabSearchQuery.trim()) return true;
    const query = tabSearchQuery.toLowerCase().trim();
    const titleMatch = t.title.toLowerCase().includes(query);
    const pathMatch = t.pathname.toLowerCase().includes(query);
    const subtitleMatch = t.previewSubtitle?.toLowerCase().includes(query);
    return titleMatch || pathMatch || subtitleMatch;
  });

  return (
    <div className="fixed inset-0 z-[100] bg-[#131314] text-white flex flex-col animate-in fade-in duration-150 select-none overflow-hidden">
      
      {/* ========================================================= */}
      {/* 1. BARRA SUPERIOR ESTILO GOOGLE CHROME                   */}
      {/* ========================================================= */}
      <header className="px-3 sm:px-4 py-2.5 bg-[#131314] flex items-center justify-between shrink-0 border-b border-zinc-800/40">
        
        {/* Botón "+": Nueva Pestaña (Izquierda) */}
        <button
          onClick={() => {
            createNewTab('/', onNavigate);
          }}
          className="w-10 h-10 rounded-2xl bg-[#282a2d] hover:bg-[#35373b] active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm"
          title="Abrir nueva pestaña"
          aria-label="Abrir nueva pestaña"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Agrupador Central: [ Contador de Pestañas | Icono Cuadrícula ] */}
        <div className="flex items-center bg-[#282a2d] p-1 rounded-2xl border border-zinc-700/40 gap-1 shadow-sm">
          {/* Contador de pestañas (Pill con número) */}
          <div 
            className="min-w-[34px] h-[34px] px-2 rounded-xl bg-[#37393e] flex items-center justify-center text-xs font-black text-white"
            title={`${tabs.length} pestañas abiertas`}
          >
            {tabs.length}
          </div>

          {/* Icono de cuadrícula (Visual Google Tabs) */}
          <div 
            className="w-[34px] h-[34px] rounded-xl flex items-center justify-center text-zinc-300"
            title="Vista de pestañas"
          >
            <LayoutGrid className="w-4 h-4" />
          </div>
        </div>

        {/* Menú de Opciones Tres Puntos "⋮" y Botón Listo */}
        <div className="flex items-center gap-1.5 relative" ref={moreMenuRef}>
          {/* Botón 3 puntos */}
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className="w-10 h-10 rounded-2xl hover:bg-[#282a2d] text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Más opciones"
            aria-label="Más opciones"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Botón "Listo" o "✕" para volver a la app */}
          <button
            onClick={() => setIsTabsSwitcherOpen(false)}
            className="px-3 py-2 rounded-xl bg-[#282a2d] hover:bg-[#35373b] text-xs font-bold text-zinc-200 hover:text-white transition-all cursor-pointer"
            title="Volver a la pestaña actual"
          >
            Listo
          </button>

          {/* Dropdown del menú de 3 puntos */}
          {moreMenuOpen && (
            <div className="absolute right-0 top-12 w-56 bg-[#282a2d] border border-zinc-700/70 rounded-2xl shadow-2xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  setMoreMenuOpen(false);
                  createNewTab('/', onNavigate);
                }}
                className="w-full px-4 py-2.5 text-left text-xs font-medium text-zinc-200 hover:bg-[#383a3e] flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-zinc-400" />
                <span>Nueva pestaña</span>
              </button>

              <button
                onClick={() => {
                  setMoreMenuOpen(false);
                  createNewTab('/search', onNavigate);
                }}
                className="w-full px-4 py-2.5 text-left text-xs font-medium text-zinc-200 hover:bg-[#383a3e] flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4 text-zinc-400" />
                <span>Nueva búsqueda</span>
              </button>

              <div className="h-px bg-zinc-700/60 my-1" />

              <button
                onClick={() => {
                  setMoreMenuOpen(false);
                  closeAllTabs(onNavigate);
                }}
                className="w-full px-4 py-2.5 text-left text-xs font-medium text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Cerrar todas las pestañas</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. BARRA DE BÚSQUEDA IDÉNTICA A GOOGLE CHROME              */}
      {/*    "Realiza búsquedas en las pestañas"                    */}
      {/* ========================================================= */}
      <div className="px-3 sm:px-4 pt-2 pb-3 shrink-0 bg-[#131314]">
        <div className="w-full max-w-2xl mx-auto relative flex items-center">
          <div className="absolute left-3.5 pointer-events-none text-zinc-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={tabSearchQuery}
            onChange={(e) => setTabSearchQuery(e.target.value)}
            placeholder="Realiza búsquedas en las pestañas"
            className="w-full h-11 pl-10 pr-9 rounded-full bg-[#282a2d] hover:bg-[#303236] focus:bg-[#35373c] text-sm text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-all"
          />
          {tabSearchQuery && (
            <button
              onClick={() => setTabSearchQuery('')}
              className="absolute right-3 p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
              title="Borrar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. CUADRÍCULA DE TARJETAS EN 2 COLUMNAS (GOOGLE STYLE)     */}
      {/* ========================================================= */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-4 pb-20 pt-1 max-w-4xl w-full mx-auto">
        {filteredTabs.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6">
            <Search className="w-10 h-10 text-zinc-600 mb-3" />
            <p className="text-sm font-semibold text-zinc-300">No se encontraron pestañas</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              No hay ninguna pestaña abierta que coincida con &quot;{tabSearchQuery}&quot;
            </p>
            <button
              onClick={() => setTabSearchQuery('')}
              className="mt-4 px-4 py-2 rounded-full bg-[#282a2d] text-xs font-bold text-zinc-200 hover:text-white transition"
            >
              Mostrar todas las pestañas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredTabs.map((tab) => {
              const isActive = tab.id === activeTabId;

              return (
                <div
                  key={tab.id}
                  onClick={() => switchTab(tab.id, onNavigate)}
                  className={`group relative rounded-[20px] overflow-hidden flex flex-col h-[230px] sm:h-[260px] select-none transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'ring-[2.5px] ring-[#a8c7fa] shadow-[0_4px_24px_rgba(168,199,250,0.25)] scale-[1.01]'
                      : 'border border-zinc-700/60 hover:border-zinc-500 bg-[#1e1f20]'
                  }`}
                >
                  {/* CABECERA INTEGRADA DE LA TARJETA (ESTILO CHROME) */}
                  <div
                    className={`h-9 px-2.5 flex items-center justify-between gap-1.5 shrink-0 z-10 ${
                      isActive ? 'bg-[#2b303c]' : 'bg-[#282a2d]'
                    }`}
                  >
                    {/* Favicon / Icono */}
                    <div className="shrink-0">
                      {getFaviconIcon(tab.type)}
                    </div>

                    {/* Título de la pestaña */}
                    <span 
                      className={`text-xs font-medium truncate flex-1 ${
                        isActive ? 'text-white font-semibold' : 'text-zinc-200'
                      }`}
                      title={tab.title}
                    >
                      {tab.title}
                    </span>

                    {/* Botón de cierre "✕" */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id, onNavigate);
                      }}
                      className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                      title="Cerrar pestaña"
                      aria-label="Cerrar pestaña"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* CUERPO DE LA TARJETA CON SNAPSHOT VISUAL DE LA PÁGINA */}
                  <div className="flex-1 overflow-hidden relative">
                    <TabPreviewSnapshot tab={tab} isActive={isActive} />

                    {/* Indicador de pestaña activa si está seleccionada */}
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#a8c7fa] shadow-[0_0_8px_#a8c7fa]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

    </div>
  );
}
