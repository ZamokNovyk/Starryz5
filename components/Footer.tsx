'use client';

import React from 'react';
import { Star } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#0d0d0d] border-t border-[#ffffff05] text-zinc-500 text-xs py-10 px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-[#eab30810] border border-[#eab30830] flex items-center justify-center">
            <Star className="w-3.5 h-3.5 text-[#eab308] fill-[#eab308]" />
          </div>
          <span className="font-black text-white text-sm tracking-wider">
            STARRYZ <span className="text-[#eab308]">5</span>
          </span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-500 text-xs">Plataforma de Popularidad Universitaria</span>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-zinc-400 text-xs">
          <a href="#ranking" className="hover:text-[#eab308] transition-colors">Ranking Campus</a>
          <a href="#instituciones" className="hover:text-[#eab308] transition-colors">Instituciones</a>
          <a href="#alumnos" className="hover:text-[#eab308] transition-colors">Alumnos Populares</a>
          <span className="text-zinc-700">•</span>
          <span className="text-zinc-500 flex items-center gap-1">
            Optimizado para Cloudflare Pages & Supabase
          </span>
        </div>

        {/* Copyright */}
        <div className="text-zinc-600 text-[10px] font-mono tracking-widest uppercase">
          © {new Date().getFullYear()} STARRYZ 5. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}

