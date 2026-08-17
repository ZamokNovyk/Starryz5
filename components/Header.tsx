'use client';

import React, { useState } from 'react';
import { Download, Sparkles, UserPlus, Star, Menu, X } from 'lucide-react';

interface HeaderProps {
  onOpenInstallModal: () => void;
  onOpenJoinModal: () => void;
}

export default function Header({ onOpenInstallModal, onOpenJoinModal }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          {/* Unirse Button */}
          <button
            onClick={onOpenJoinModal}
            className="px-6 py-2 bg-[#eab308] text-black rounded-md font-bold text-xs tracking-widest hover:bg-[#d9a307] transition-colors active:scale-95 cursor-pointer"
          >
            UNIRSE
          </button>
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
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenInstallModal();
            }}
            className="w-full py-2.5 px-4 rounded-md border border-[#eab308] text-[#eab308] font-semibold text-xs tracking-widest uppercase bg-transparent flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 text-[#eab308]" />
            <span>INSTALAR APP</span>
          </button>

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
        </div>
      )}
    </header>
  );
}

