'use client';

import React, { useState } from 'react';
import { Building2, Users, Star, CheckCircle2, MapPin, ArrowUpRight } from 'lucide-react';
import { Institution, MOCK_INSTITUTIONS } from '@/lib/mockData';

interface RegisteredInstitutionsProps {
  onSelectInstitution: (inst: Institution) => void;
  searchQuery: string;
}

export default function RegisteredInstitutions({
  onSelectInstitution,
  searchQuery,
}: RegisteredInstitutionsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  const categories = ['Todas', 'Universidad', 'Instituto', 'Colegio'];

  const filteredInstitutions = MOCK_INSTITUTIONS.filter((inst) => {
    const matchesCategory =
      selectedCategory === 'Todas' || inst.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.acronym.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.campus.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <section className="py-16 px-6 lg:px-8 max-w-7xl mx-auto border-t border-[#ffffff10]">
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
        <div>
          <div className="flex items-center gap-2 text-[#eab308] text-xs font-bold uppercase tracking-[0.2em] mb-2">
            <Building2 className="w-4 h-4 text-[#eab308]" />
            <span>RED EDUCATIVA STARRYZ</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase font-sans">
            INSTITUCIONES <span className="text-[#eab308]">REGISTRADAS</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-1 max-w-xl">
            Descubre los campus con mayor índice de popularidad y participación estudiantil.
          </p>
        </div>

        {/* CATEGORY FILTERS */}
        <div className="flex flex-wrap items-center gap-2 bg-[#0d0d0d] p-1.5 rounded-xl border border-[#ffffff10]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#eab308] text-black shadow-md shadow-[#eab308]/20'
                  : 'text-zinc-400 hover:text-white hover:bg-[#151515]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* INSTITUTION CARDS GRID */}
      {filteredInstitutions.length === 0 ? (
        <div className="bg-[#0d0d0d] border border-[#ffffff10] rounded-xl p-12 text-center text-zinc-400">
          <Building2 className="w-12 h-12 text-[#eab308]/50 mx-auto mb-3" />
          <p className="text-lg font-bold text-white">No se encontraron instituciones</p>
          <p className="text-sm mt-1">Intenta ajustando los términos de búsqueda o filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInstitutions.map((inst) => (
            <div
              key={inst.id}
              onClick={() => onSelectInstitution(inst)}
              className="group relative bg-[#0d0d0d] border border-[#ffffff10] hover:border-[#eab30840] rounded-xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_20px_rgba(234,179,8,0.15)] hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Banner Image */}
                <div className="relative h-44 w-full overflow-hidden bg-[#151515]">
                  <img
                    src={inst.image}
                    alt={inst.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/40 to-transparent"></div>

                  {/* Badge Acronym & Verified */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-3 py-1 rounded-md bg-black/80 backdrop-blur-md border border-[#eab308]/40 text-[#eab308] font-black text-xs tracking-wider">
                      {inst.acronym}
                    </span>
                    {inst.verified && (
                      <span className="p-1 rounded-full bg-[#eab308] text-black shadow-md">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>

                  {/* Score badge */}
                  <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md border border-[#ffffff20] px-2.5 py-1 rounded-md flex items-center gap-1.5 text-xs font-bold text-[#eab308]">
                    <Star className="w-3.5 h-3.5 fill-[#eab308] text-[#eab308]" />
                    <span>{inst.popularityScore} / 10</span>
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold text-white group-hover:text-[#eab308] transition-colors leading-snug">
                      {inst.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <MapPin className="w-3.5 h-3.5 text-[#eab308]" />
                    <span>{inst.campus}</span>
                  </div>

                  {/* Popularity Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-zinc-400 font-medium">
                      <span>Índice de Popularidad</span>
                      <span className="text-[#eab308] font-bold">{inst.popularityScore * 10}%</span>
                    </div>
                    <div className="w-full bg-[#151515] rounded-full h-2 overflow-hidden border border-[#ffffff10]">
                      <div
                        className="bg-[#eab308] h-full rounded-full transition-all duration-500"
                        style={{ width: `${inst.popularityScore * 10}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div className="px-5 py-3.5 border-t border-[#ffffff10] bg-[#0a0a0a] flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{inst.studentsCount.toLocaleString()} Alumnos</span>
                </div>
                <span className="text-[#eab308] group-hover:translate-x-1 transition-transform font-bold flex items-center gap-1">
                  Ver Campus <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

