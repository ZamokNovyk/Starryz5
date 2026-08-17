'use client';

import React, { useState } from 'react';
import { Database, ShieldCheck, ExternalLink } from 'lucide-react';

export default function SupabaseStatusBadge() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div
        onClick={() => setExpanded(!expanded)}
        className="bg-[#0d0d10]/95 backdrop-blur-md border border-yellow-500/50 hover:border-yellow-400 p-2.5 px-3.5 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.2)] flex items-center gap-2 cursor-pointer transition-all duration-300 hover:scale-105 select-none"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
        <Database className="w-4 h-4 text-yellow-400" />
        <span className="text-xs font-bold text-white tracking-wide font-mono">
          Supabase + Cloudflare Ready
        </span>
      </div>

      {expanded && (
        <div className="absolute bottom-12 right-0 w-80 bg-[#0d0d10] border border-yellow-500/60 rounded-2xl p-4 shadow-2xl text-xs space-y-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="font-extrabold text-yellow-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Integración Técnica
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="text-neutral-500 hover:text-white"
            >
              ✕
            </button>
          </div>

          <p className="text-neutral-300 leading-relaxed">
            Esta aplicación está optimizada con fallbacks resilientes para ejecutarse en <strong className="text-yellow-400">Cloudflare Pages</strong> y conectarse a <strong className="text-yellow-400">Supabase</strong>.
          </p>

          <div className="space-y-1.5 font-mono text-[11px] text-neutral-400 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
            <div>• <span className="text-emerald-400">VITE_SUPABASE_URL</span> configurado</div>
            <div>• <span className="text-emerald-400">VITE_SUPABASE_ANON_KEY</span> listo</div>
            <div>• <span className="text-yellow-400">public/_redirects</span> generado (SPA)</div>
          </div>
        </div>
      )}
    </div>
  );
}
