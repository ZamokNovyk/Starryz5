'use client';

import React, { useState } from 'react';
import { Crown, Search, Sparkles, Building2, UserCheck, Flame, TrendingUp } from 'lucide-react';

interface HeroSectionProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  quickFilter: string;
  setQuickFilter: (category: string) => void;
  onSelectStudent?: (student: any) => void;
  onSelectInstitution?: (inst: any) => void;
}

export default function HeroSection({
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  quickFilter,
  setQuickFilter,
}: HeroSectionProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <section className="relative min-h-[580px] lg:min-h-[620px] flex flex-col items-center justify-center pt-12 pb-16 px-6 lg:px-8 bg-[#0a0a0a] bg-radial-grid overflow-hidden">
      {/* Immersive Glowing background element */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#eab30805] blur-[100px] rounded-full pointer-events-none"></div>

      {/* TOP CROWN CARD WITH ROTATION & GOLDEN GLOW */}
      <div className="relative z-10 mb-6 flex items-center justify-center">
        <div className="p-3 bg-[#0d0d0d] border border-[#eab308] rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.2)] transform -rotate-3 transition-transform duration-300 hover:rotate-0 hover:scale-105 cursor-pointer">
          <Crown className="w-8 h-8 text-[#eab308] stroke-[2]" />
        </div>
      </div>

      {/* MAIN TITLE (IMMERSIVE UI STYLE) */}
      <div className="relative z-10 text-center max-w-4xl mx-auto mb-8 select-none">
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-center leading-tight mb-2">
          MIDE TU{' '}
          <span className="relative inline-block text-[#eab308]">
            POPULARIDAD
            <span className="absolute left-0 bottom-1 w-full h-2 bg-[#eab30830] -rotate-1 rounded-full"></span>
          </span>{' '}
          <br className="hidden sm:block" />
          EN EL CAMPUS
        </h1>
      </div>

      {/* SEARCH BAR (PILL STYLE) */}
      <div className="relative z-20 w-full max-w-2xl mx-auto mb-10">
        <form onSubmit={onSearchSubmit} className="relative">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Busca alumnos o instituciones..."
              className={`w-full bg-[#0d0d0d] border ${
                isFocused ? 'border-[#eab308] ring-2 ring-[#eab308]/20' : 'border-[#ffffff20]'
              } px-8 py-4 sm:py-5 rounded-full text-base sm:text-lg text-white placeholder:text-zinc-500 focus:outline-none shadow-2xl transition-all font-sans pr-16`}
            />

            {/* Circular Search Button */}
            <button
              type="submit"
              className="absolute right-2 top-2 bottom-2 aspect-square bg-[#eab308] text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-lg"
              aria-label="Buscar"
            >
              <Search className="w-5 h-5 text-black stroke-[3]" />
            </button>
          </div>
        </form>

        {/* POPULAR SEARCH TAGS */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs">
          <span className="text-zinc-500 font-mono text-[11px] uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#eab308]" /> Populares:
          </span>
          {['UNAM', 'Tec de Monterrey', 'IPN', 'Alumnos Top', 'Ingeniería'].map((tag) => (
            <button
              key={tag}
              onClick={() => setSearchQuery(tag)}
              className="px-3 py-1 rounded-full bg-[#0d0d0d] border border-[#ffffff10] hover:border-[#eab30850] text-zinc-300 hover:text-[#eab308] transition-colors cursor-pointer text-xs"
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* QUICK CATEGORY FILTER BAR */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-3xl mx-auto">
        {[
          { id: 'all', label: 'Todos', icon: Flame },
          { id: 'instituciones', label: 'Instituciones', icon: Building2 },
          { id: 'alumnos', label: 'Alumnos Populares', icon: UserCheck },
          { id: 'tendencias', label: 'Tendencias Campus', icon: TrendingUp },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = quickFilter === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setQuickFilter(item.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#eab308] text-black shadow-md shadow-[#eab308]/20'
                  : 'bg-[#0d0d0d] border border-[#ffffff10] text-zinc-400 hover:text-white hover:border-[#ffffff20]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-black' : 'text-[#eab308]'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

