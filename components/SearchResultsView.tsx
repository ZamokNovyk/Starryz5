'use client';

import React from 'react';
import { Building2, SlidersHorizontal, ArrowLeft, GraduationCap, BookOpen } from 'lucide-react';
import { Institution } from '@/lib/mockData';

interface SearchResultsViewProps {
  query: string;
  results: Institution[];
  onSelectInstitution: (inst: Institution) => void;
  onBack: () => void;
}

export default function SearchResultsView({
  query,
  results,
  onSelectInstitution,
  onBack,
}: SearchResultsViewProps) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8 animate-in fade-in duration-300">
      
      {/* Botón de regreso */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-[#eab308] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver a la Red</span>
      </button>

      {/* Título de Resultados */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/50 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Resultados para <span className="text-[#eab308]">"{query}"</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-2">
            Se encontraron {results.length} resultados.
          </p>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0d0d0d] border border-zinc-800/80 hover:border-[#eab308]/40 hover:text-white text-zinc-400 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filtrar</span>
        </button>
      </div>

      {/* Lista de Instituciones */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold text-white uppercase tracking-wide">
          Instituciones
        </h2>

        {results.length === 0 ? (
          <div className="bg-[#0d0d0d] border border-zinc-800/40 rounded-2xl p-16 text-center text-zinc-400">
            <Building2 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-base font-bold text-white">No se encontraron instituciones reales</p>
            <p className="text-xs mt-1">Intenta con otro término de búsqueda o crea un nuevo centro educativo.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((inst) => {
              const Icon = inst.category === 'Colegio' 
                ? BookOpen 
                : inst.category === 'Instituto' 
                  ? Building2 
                  : GraduationCap;

              return (
                <div
                  key={inst.id}
                  onClick={() => onSelectInstitution(inst)}
                  className="group flex items-center gap-4 bg-[#0d0d0d] border border-zinc-800/30 hover:border-[#eab308]/40 rounded-xl p-4 transition-all duration-300 cursor-pointer hover:shadow-[0_4px_20px_rgba(234,179,8,0.05)]"
                >
                  {/* Icono izquierdo */}
                  <div className="p-3 bg-[#151515] text-zinc-400 group-hover:text-[#eab308] rounded-xl transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Detalles */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-[#eab308] transition-colors truncate">
                      {inst.name}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {inst.category}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
