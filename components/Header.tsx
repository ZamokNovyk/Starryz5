'use client';

import React, { useState } from 'react';
import { 
  Search, 
  UserPlus, 
  Star, 
  Menu, 
  X, 
  LogOut, 
  GraduationCap, 
  UserCheck, 
  Building2, 
  BookOpen
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import AutocompleteSearchBar from './AutocompleteSearchBar';
import { SearchSuggestion } from '@/src/lib/search';

interface HeaderProps {
  searchQuery?: string;
  onSearch?: (query: string) => void;
  onNavigate?: (url: string) => void;
  onOpenInstallModal: () => void;
  onOpenJoinModal: () => void;
  onGoToProfile?: () => void;
  onGoToHome?: () => void;
  onOpenCreateCenterModal?: () => void;
}

export default function Header({ 
  searchQuery = '',
  onSearch,
  onNavigate,
  onOpenInstallModal, 
  onOpenJoinModal, 
  onGoToProfile,
  onGoToHome,
  onOpenCreateCenterModal
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleSearchSubmit = (queryText: string) => {
    if (onSearch) {
      onSearch(queryText);
    }
    setMobileSearchOpen(false);
  };

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    setMobileSearchOpen(false);
    if (onNavigate && suggestion.url) {
      onNavigate(suggestion.url);
    } else if (onSearch) {
      onSearch(suggestion.title);
    }
  };

  const handleQuickCategorySearch = (cat: string) => {
    if (onSearch) {
      onSearch(cat);
    }
    setMobileSearchOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#0d0d0d] border-b border-[#ffffff10] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6">
          
          {/* 1. LOGO (IZQUIERDA) */}
          <div 
            onClick={onGoToHome}
            className="flex items-center gap-2 cursor-pointer group select-none flex-shrink-0"
          >
            <div className="text-[#eab308] flex items-center justify-center transition-transform group-hover:scale-110">
              <Star className="w-5 h-5 sm:w-6 sm:h-6 fill-[#eab308] text-[#eab308]" />
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-black tracking-tighter text-white font-sans">
                STARRYZ
              </span>
              <span className="text-lg sm:text-xl font-black text-[#eab308]">
                5
              </span>
            </div>
          </div>

          {/* 2. BUSCADOR CON AUTOCOMPLETADO Y TOLERANCIA A ERRORES (DESKTOP & TABLETS - CENTRO) */}
          <div className="hidden sm:flex flex-1 max-w-lg mx-2 lg:mx-6">
            <AutocompleteSearchBar
              value={searchQuery}
              placeholder="Buscar profesores, centros o alumnos..."
              onSearch={handleSearchSubmit}
              onSelectSuggestion={handleSuggestionSelect}
            />
          </div>

          {/* 3. ACCIONES DE LA DERECHA */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            
            {/* LUPA EN MÓVILES (ABRE LA VENTANA MODAL DE BÚSQUEDA) */}
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="sm:hidden p-2 rounded-xl bg-[#141414] border border-[#ffffff15] text-[#eab308] hover:bg-[#1a1a1a] transition-all active:scale-95 cursor-pointer"
              title="Buscar"
              aria-label="Abrir buscador"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* BOTONES DE USUARIO (DESKTOP) */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={onGoToProfile}
                    className="flex items-center gap-2 bg-[#141414] border border-[#ffffff10] hover:border-[#eab308]/50 pl-2 pr-3 py-1.5 rounded-full hover:bg-[#1a1a1a] transition-all cursor-pointer text-left"
                    title="Ver mi perfil"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'Usuario'}
                        className="w-6 h-6 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#eab308] text-black flex items-center justify-center text-[10px] font-black">
                        {user.displayName ? user.displayName.substring(0, 2).toUpperCase() : 'UA'}
                      </div>
                    )}
                    <span className="text-xs font-bold text-white max-w-[110px] truncate">
                      {user.displayName}
                    </span>
                  </button>
                  {!user.isAnonymous && (
                    <button
                      onClick={logout}
                      className="p-2 rounded-xl bg-[#141414] border border-[#ffffff15] text-zinc-400 hover:text-white hover:border-red-500/50 transition-colors cursor-pointer"
                      title="Cerrar Sesión"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={onOpenJoinModal}
                  className="px-5 py-2 bg-[#eab308] text-black rounded-xl font-black text-xs tracking-widest hover:bg-[#d9a307] transition-all active:scale-95 cursor-pointer shadow-sm uppercase"
                >
                  UNIRSE
                </button>
              )}
            </div>

            {/* MENÚ MÓVIL TOGGLE */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl bg-[#141414] border border-[#ffffff15] text-zinc-300 hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                aria-label="Abrir Menú"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>

        {/* 4. MENÚ DESPLEGABLE MÓVIL */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0d0d0d] border-b border-[#ffffff10] px-6 py-5 space-y-3 animate-in slide-in-from-top-4 duration-200">
            {user ? (
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onGoToProfile) onGoToProfile();
                  }}
                  className="w-full text-left flex items-center gap-3 bg-[#141414] border border-[#ffffff10] hover:border-[#eab308]/50 p-3 rounded-xl hover:bg-[#1a1a1a] transition-all cursor-pointer"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Usuario'}
                      className="w-10 h-10 rounded-full object-cover animate-in fade-in"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#eab308] text-black flex items-center justify-center text-xs font-black">
                      {user.displayName ? user.displayName.substring(0, 2).toUpperCase() : 'UA'}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-bold text-white">{user.displayName}</div>
                    <div className="text-[10px] text-zinc-500 font-medium truncate max-w-[200px]">
                      {user.email || 'Acceso Anónimo'}
                    </div>
                  </div>
                </button>
                {!user.isAnonymous && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl border border-red-500/30 text-red-400 font-semibold text-xs tracking-widest uppercase bg-red-950/20 hover:bg-red-950/40 flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>CERRAR SESIÓN</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenJoinModal();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#eab308] text-black font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 shadow-sm"
              >
                <UserPlus className="w-4 h-4 text-black" />
                <span>UNIRSE</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* 5. VENTANA MODAL FLOTANTE DE BÚSQUEDA EN CELULARES (CON AUTOCOMPLETADO Y TOLERANCIA) */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col p-4 sm:hidden animate-in fade-in duration-200">
          
          <div className="bg-[#0d0d0d] border border-zinc-800 rounded-3xl p-5 shadow-[0_15px_50px_rgba(0,0,0,0.9)] space-y-4 max-w-md w-full mx-auto my-auto animate-in zoom-in-95 duration-200">
            
            {/* Header del modal */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
              <div className="flex items-center gap-2 text-white font-black text-sm uppercase tracking-wider">
                <Search className="w-4 h-4 text-[#eab308]" />
                <span>Buscar en Starryz 5</span>
              </div>
              <button
                onClick={() => setMobileSearchOpen(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-[#141414] border border-zinc-800 cursor-pointer"
                aria-label="Cerrar buscador"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Buscador Autocompletado Móvil */}
            <div className="w-full">
              <AutocompleteSearchBar
                value={searchQuery}
                placeholder="Escribe profesores, centros..."
                autoFocus={true}
                onSearch={handleSearchSubmit}
                onSelectSuggestion={handleSuggestionSelect}
                onClose={() => setMobileSearchOpen(false)}
                inputClassName="py-3 text-base border-2 border-[#eab308]/70"
              />
            </div>

            {/* Accesos rápidos sugeridos */}
            <div className="pt-2">
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2.5">
                Búsquedas sugeridas:
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickCategorySearch('Universidad')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
                >
                  <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                  <span>Universidades</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickCategorySearch('Profesor')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#eab308]" />
                  <span>Profesores</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickCategorySearch('Instituto')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Institutos</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickCategorySearch('Colegio')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Colegios</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      )}
    </>
  );
}
