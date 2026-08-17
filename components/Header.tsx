'use client';

import React, { useState } from 'react';
import { Download, Sparkles, UserPlus, Star, Menu, X, LogOut, Plus } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';

interface HeaderProps {
  onOpenInstallModal: () => void;
  onOpenJoinModal: () => void;
  onGoToProfile?: () => void;
  onOpenCreateCenterModal?: () => void;
}

export default function Header({ 
  onOpenInstallModal, 
  onOpenJoinModal, 
  onGoToProfile,
  onOpenCreateCenterModal
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-[#0d0d0d] border-b border-[#ffffff10] transition-all">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* LOGO (LEFT) */}
        <div className="flex items-center gap-2.5 cursor-pointer group select-none">
          {/* Logo Star Icon */}
          <div className="text-[#eab308] flex items-center justify-center transition-transform group-hover:scale-110">
            <Star className="w-6 h-6 fill-[#eab308] text-[#eab308]" />
          </div>

          {/* Logo Brand Text */}
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black tracking-tighter text-white font-sans">
              STARRYZ
            </span>
            <span className="text-xl font-black text-[#eab308]">
              5
            </span>
          </div>
        </div>

        {/* DESKTOP NAVIGATION BUTTONS (RIGHT) */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={onGoToProfile}
                className="flex items-center gap-2 bg-[#141414] border border-[#ffffff10] hover:border-[#eab308]/50 pl-2.5 pr-3.5 py-1.5 rounded-full hover:bg-[#1a1a1a] transition-all cursor-pointer text-left"
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
                <span className="text-xs font-bold text-white max-w-[120px] truncate">
                  {user.displayName}
                </span>
              </button>
              {!user.isAnonymous && (
                <button
                  onClick={logout}
                  className="p-2 rounded-md bg-[#141414] border border-[#ffffff15] text-zinc-400 hover:text-white hover:border-red-500/50 transition-colors cursor-pointer"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenJoinModal}
              className="px-6 py-2 bg-[#eab308] text-black rounded-md font-bold text-xs tracking-widest hover:bg-[#d9a307] transition-colors active:scale-95 cursor-pointer"
            >
              UNIRSE
            </button>
          )}
        </div>

        {/* MOBILE MENU TOGGLE */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md bg-[#141414] border border-[#ffffff15] text-[#eab308] hover:bg-[#1a1a1a] transition-colors"
            aria-label="Abrir Menú"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* MOBILE DROPDOWN MENU */}
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
                  className="w-full py-2.5 px-4 rounded-md border border-red-500/30 text-red-400 font-semibold text-xs tracking-widest uppercase bg-red-950/20 hover:bg-red-950/40 flex items-center justify-center gap-2"
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
              className="w-full py-2.5 px-4 rounded-md bg-[#eab308] text-black font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4 text-black" />
              <span>UNIRSE</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
}

