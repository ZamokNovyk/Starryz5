'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Share2, 
  BookOpen, 
  Search, 
  SlidersHorizontal, 
  List, 
  LayoutGrid, 
  Heart, 
  Users, 
  MessageSquare, 
  Star, 
  Image as ImageIcon,
  MessageCircle,
  Award,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Plus,
  User
} from 'lucide-react';
import { Institution } from '@/lib/mockData';
import { getProfessorsByInstitute, Professor as DbProfessor } from '@/src/lib/professors';
import AddMemberModal from '@/components/Modals/AddMemberModal';
import BookmarkButton from '@/components/BookmarkButton';

interface EducationalCenterProfileViewProps {
  institution: Institution;
  onBack: () => void;
  onSelectProfessor?: (slug: string) => void;
}

type TabType = 'Wiki' | 'Profesores' | 'Confesiones' | 'Galeria';
type ViewMode = 'list' | 'grid';
type SortOption = 'alphabetical' | 'score_desc' | 'score_asc' | 'fans_desc' | 'knows_desc' | 'crushes_desc';

interface MemberItem {
  id: string;
  name: string;
  avatar: string;
  fans: number;
  knows: number;
  crushes: number;
  score: number;
  role: 'Alumno' | 'Profesor';
}

interface Confession {
  id: number;
  author: string;
  content: string;
  time: string;
  likes: number;
  comments: number;
}

interface WikiArticle {
  id: number;
  title: string;
  category: string;
  likes: number;
  views: number;
}

export default function EducationalCenterProfileView({
  institution,
  onBack,
  onSelectProfessor,
}: EducationalCenterProfileViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('Profesores');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [dbProfessors, setDbProfessors] = useState<DbProfessor[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close sort menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    }
    if (isSortMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSortMenuOpen]);

  const loadMembers = async () => {
    try {
      setLoadingMembers(true);
      const data = await getProfessorsByInstitute(institution.id || institution.slug || '');
      setDbProfessors(data);
    } catch (err) {
      console.error('Error al cargar miembros de Supabase:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Fetch real database members when the institution changes
  useEffect(() => {
    loadMembers();
  }, [institution]);

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Convert real database payload into member list UI format
  const mappedMembers: MemberItem[] = dbProfessors.map((dp) => ({
    id: dp.id,
    name: dp.nombre_completo || `${dp.nombre || ''} ${dp.apellidos || ''}`.trim() || 'Miembro',
    avatar: dp.avatar_url || '',
    fans: typeof dp.fans_count === 'number' ? dp.fans_count : 0,
    knows: typeof dp.knows_count === 'number' ? dp.knows_count : 0,
    crushes: typeof dp.crushes_count === 'number' ? dp.crushes_count : 0,
    score: typeof dp.score === 'number' ? Number(dp.score) : 0.0,
    role: dp.role || 'Profesor',
  }));

  // Filter list with searchTerm
  const filteredMembers = mappedMembers.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort based on current selection
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    switch (sortBy) {
      case 'alphabetical':
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      case 'score_desc':
        return b.score - a.score || b.fans - a.fans || a.name.localeCompare(b.name);
      case 'score_asc':
        return a.score - b.score || a.fans - b.fans || a.name.localeCompare(b.name);
      case 'fans_desc':
        return b.fans - a.fans || b.score - a.score || a.name.localeCompare(b.name);
      case 'knows_desc':
        return b.knows - a.knows || b.score - a.score || a.name.localeCompare(b.name);
      case 'crushes_desc':
        return b.crushes - a.crushes || b.score - a.score || a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  // Calculate dynamic rank for each member
  const rankedMembers = sortedMembers.map((m, idx) => ({
    ...m,
    rank: idx + 1,
  }));

  const sortOptions: { id: SortOption; label: string }[] = [
    { id: 'alphabetical', label: 'Alfabéticamente (A-Z)' },
    { id: 'score_desc', label: 'Mejor Calificación' },
    { id: 'score_asc', label: 'Peor Calificación' },
    { id: 'fans_desc', label: 'Más Fans' },
    { id: 'knows_desc', label: 'Más "Yo te conozco"' },
    { id: 'crushes_desc', label: 'Más Crushes' },
  ];

  // Wiki, Confessions and Gallery
  const wikiArticles: WikiArticle[] = [];
  const confessionsList: Confession[] = [];
  const galleryImages: { url: string; caption: string }[] = [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* Volver a la Red */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-[#eab308] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a la Red</span>
        </button>
      </div>

      {/* HEADER DE LA INSTITUCIÓN */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pt-2 pb-4">
        {/* Avatar circular */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#181818] border border-zinc-800 flex items-center justify-center text-zinc-500 text-3xl font-black shadow-lg flex-shrink-0">
          {institution.acronym ? institution.acronym.substring(0, 1) : 'I'}
        </div>

        {/* Nombre y Compartir */}
        <div className="flex-1 text-center sm:text-left space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h1 className="text-2xl sm:text-3.5xl font-black text-white leading-tight uppercase tracking-tight">
              {institution.name}
            </h1>
            <div className="flex items-center gap-2 flex-shrink-0 self-center sm:self-start">
              <BookmarkButton
                itemId={institution.id || institution.slug || ''}
                itemType="center"
                itemName={institution.name}
                itemImage={null}
                itemSubtitle={institution.acronym || 'Centro Educativo'}
              />
              <button
                onClick={handleShare}
                className="p-3 rounded-full bg-[#151515] hover:bg-[#202020] border border-zinc-800 text-zinc-400 hover:text-[#eab308] transition-all cursor-pointer shadow-md"
                title="Compartir link"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          {copied && (
            <p className="text-xs text-[#eab308] font-bold tracking-wide animate-pulse">
              ✓ ¡Enlace copiado al portapapeles!
            </p>
          )}
        </div>
      </div>

      {/* INPUT BUSCADOR */}
      <div className="relative w-full">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar estudiante o profesor..."
          className="w-full bg-[#0d0d0d] border border-zinc-800/80 rounded-full py-3.5 pl-14 pr-6 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#eab308]/40 transition-all font-medium"
        />
      </div>

      {/* BARRA DE TABS / TAGS */}
      <div className="bg-[#0d0d0d] border border-zinc-800/80 rounded-xl p-1 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 min-w-max">
          
          {/* TAB WIKI */}
          <button
            onClick={() => setActiveTab('Wiki')}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'Wiki'
                ? 'bg-[#eab308] text-black font-extrabold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#151515]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Wiki</span>
          </button>

          {/* TAB PROFESORES */}
          <button
            onClick={() => setActiveTab('Profesores')}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'Profesores'
                ? 'bg-[#eab308] text-black font-extrabold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#151515]'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Profesores</span>
          </button>

          {/* TAB CONFESIONES */}
          <button
            onClick={() => setActiveTab('Confesiones')}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'Confesiones'
                ? 'bg-[#eab308] text-black font-extrabold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#151515]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Confesiones</span>
          </button>

          {/* TAB GALERIA */}
          <button
            onClick={() => setActiveTab('Galeria')}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'Galeria'
                ? 'bg-[#eab308] text-black font-extrabold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#151515]'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Galeria</span>
          </button>

        </div>
      </div>

      {/* CONTROLES DE ORDEN / VISTA (Lista, Mosaico y Menú Ordenar) */}
      <div className="flex items-center justify-end gap-3 pt-1 relative">
        
        {/* Toggle Lista / Mosaico */}
        <div className="flex items-center bg-[#0d0d0d] border border-zinc-800/80 rounded-xl p-1 shadow-sm">
          <button 
            type="button"
            onClick={() => setViewMode('list')}
            title="Vista de Lista"
            className={`p-2 rounded-lg transition-all cursor-pointer ${
              viewMode === 'list' 
                ? 'text-[#eab308] bg-[#1a1a1a] shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => setViewMode('grid')}
            title="Vista de Mosaico"
            className={`p-2 rounded-lg transition-all cursor-pointer ${
              viewMode === 'grid' 
                ? 'text-[#eab308] bg-[#1a1a1a] shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        {/* Botón Ordenar */}
        <div className="relative" ref={sortMenuRef}>
          <button 
            type="button"
            onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
            className={`flex items-center gap-2 px-3.5 py-2 bg-[#0d0d0d] border ${
              isSortMenuOpen ? 'border-[#eab308]/60 text-white' : 'border-zinc-800/80 text-zinc-400'
            } rounded-xl text-xs font-bold uppercase tracking-wider hover:text-white hover:border-zinc-700 transition-all cursor-pointer shadow-sm`}
          >
            <SlidersHorizontal className="w-4 h-4 text-[#eab308]" />
            <span>Ordenar</span>
          </button>

          {/* Menú Desplegable Ordenar por (Idéntico a imagen 4) */}
          {isSortMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-60 bg-[#0d0d0d] border border-zinc-800 rounded-2xl p-2 shadow-[0_10px_35px_rgba(0,0,0,0.85)] z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 text-xs font-black text-white uppercase tracking-wider border-b border-zinc-800/80 mb-1">
                Ordenar por
              </div>
              <div className="space-y-0.5">
                {sortOptions.map((opt) => {
                  const isSelected = sortBy === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSortBy(opt.id);
                        setIsSortMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[#1a1a1a] text-white font-bold'
                          : 'text-zinc-400 hover:bg-[#141414] hover:text-zinc-200'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isSelected ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-transparent'
                      }`} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RENDERIZADO DE CONTENIDOS SEGÚN LA TAB ACTIVA */}
      
      {/* 1. PROFESORES TAB */}
      {activeTab === 'Profesores' && (
        <>
          {rankedMembers.length === 0 ? (
            <div className="bg-[#0d0d0d] border border-zinc-800/40 rounded-2xl p-12 text-center text-zinc-500 text-sm">
              {loadingMembers ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-[#eab308] border-t-transparent rounded-full animate-spin"></div>
                  <span>Cargando miembros...</span>
                </div>
              ) : (
                'No se encontraron miembros con la búsqueda actual.'
              )}
            </div>
          ) : viewMode === 'list' ? (
            /* VISTA DE LISTA (Idéntico a imagen 2 y 3) */
            <div className="space-y-3">
              {rankedMembers.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    if (onSelectProfessor) {
                      onSelectProfessor(p.id);
                    }
                  }}
                  className="group flex items-center justify-between gap-4 bg-[#0d0d0d] border border-zinc-800/40 hover:border-[#eab308]/30 hover:bg-[#121212] rounded-2xl p-4 transition-all duration-300 cursor-pointer shadow-sm"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Rank circular */}
                    <div className="w-8 h-8 rounded-full bg-[#131313] border border-zinc-800/80 flex items-center justify-center text-xs font-black text-zinc-500 group-hover:text-[#eab308] transition-colors flex-shrink-0">
                      {p.rank}
                    </div>

                    {/* Avatar circular */}
                    {p.avatar ? (
                      <img
                        src={p.avatar}
                        alt={p.name}
                        className="w-11 h-11 rounded-full object-cover border border-zinc-800 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-[#1e1e1e] border border-zinc-800 flex items-center justify-center text-white font-black text-sm uppercase flex-shrink-0">
                        {p.name.charAt(0)}
                      </div>
                    )}

                    {/* Datos del profesor */}
                    <div className="space-y-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-extrabold text-white group-hover:text-[#eab308] transition-colors leading-snug truncate">
                        {p.name}
                      </h3>
                      <div className="flex items-center gap-3.5 text-xs text-zinc-500">
                        <span className="flex items-center gap-1.5" title={`${p.fans} Fans`}>
                          <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
                          <span>{p.fans}</span>
                        </span>
                        <span className="flex items-center gap-1.5" title={`${p.knows} Yo te conozco`}>
                          <Users className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10" />
                          <span>{p.knows}</span>
                        </span>
                        <span className="flex items-center gap-1.5" title={`${p.crushes} Crushes`}>
                          <span className="text-xs leading-none">💘</span>
                          <span>{p.crushes}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Score en el extremo derecho */}
                  <div className="flex items-center gap-1.5 text-sm sm:text-base font-black text-[#eab308] flex-shrink-0">
                    <Star className="w-4 h-4 fill-[#eab308] text-[#eab308]" />
                    <span>{p.score.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* VISTA DE MOSAICO (Idéntico a imagen 5) */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
              {rankedMembers.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    if (onSelectProfessor) {
                      onSelectProfessor(p.id);
                    }
                  }}
                  className="group relative bg-[#0d0d0d] border border-zinc-800/60 hover:border-[#eab308]/50 hover:bg-[#121212] rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col justify-between shadow-md hover:shadow-[0_8px_30px_rgba(234,179,8,0.12)] hover:-translate-y-0.5"
                >
                  {/* Top Badges (Rank y Score) */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none">
                    <span className="w-6 h-6 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-white font-black text-[11px] flex items-center justify-center shadow">
                      {p.rank}
                    </span>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-[#eab308]/30 text-[#eab308] font-black text-[11px] shadow">
                      <Star className="w-3 h-3 fill-[#eab308] text-[#eab308]" />
                      <span>{p.score.toFixed(1)}</span>
                    </span>
                  </div>

                  {/* Imagen / Avatar Header */}
                  <div className="relative w-full aspect-square bg-[#151515] overflow-hidden flex items-center justify-center">
                    {p.avatar ? (
                      <img
                        src={p.avatar}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#181818] to-[#121212]">
                        <User className="w-14 h-14 text-zinc-700 stroke-[1.25] group-hover:text-zinc-500 transition-colors" />
                      </div>
                    )}
                  </div>

                  {/* Info Footer */}
                  <div className="p-3 bg-[#0d0d0d] space-y-1.5 border-t border-zinc-800/40">
                    <h3 className="font-extrabold text-xs sm:text-sm text-white group-hover:text-[#eab308] transition-colors truncate" title={p.name}>
                      {p.name}
                    </h3>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-0.5">
                      <span className="flex items-center gap-1" title={`${p.fans} Fans`}>
                        <Heart className="w-3 h-3 text-pink-500 fill-pink-500" />
                        <span>{p.fans}</span>
                      </span>
                      <span className="flex items-center gap-1" title={`${p.knows} Yo te conozco`}>
                        <Users className="w-3 h-3 text-amber-500 fill-amber-500/10" />
                        <span>{p.knows}</span>
                      </span>
                      <span className="flex items-center gap-1" title={`${p.crushes} Crushes`}>
                        <span className="text-[11px] leading-none">💘</span>
                        <span>{p.crushes}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 2. WIKI TAB */}
      {activeTab === 'Wiki' && (
        <div className="space-y-3">
          {wikiArticles.length === 0 ? (
            <div className="bg-[#0d0d0d] border border-zinc-800/40 rounded-xl p-12 text-center text-zinc-500 text-sm">
              No hay artículos en la Wiki todavía.
            </div>
          ) : (
            wikiArticles.map(article => (
              <div
                key={article.id}
                className="bg-[#0d0d0d] border border-zinc-800/40 rounded-xl p-5 hover:border-[#eab308]/40 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-[#1a1a1a] text-[#eab308] rounded-md border border-[#eab308]/20">
                      {article.category}
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold text-white mt-2 hover:text-[#eab308] transition-colors cursor-pointer">
                      {article.title}
                    </h3>
                  </div>
                  <div className="text-zinc-500 text-xs flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Útil</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500">
                  Creado por la comunidad de alumnos para facilitar el acceso a información oficial del campus.
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. CONFESIONES TAB */}
      {activeTab === 'Confesiones' && (
        <div className="space-y-3">
          {confessionsList.length === 0 ? (
            <div className="bg-[#0d0d0d] border border-zinc-800/40 rounded-xl p-12 text-center text-zinc-500 text-sm">
              No hay confesiones registradas aún para esta institución.
            </div>
          ) : (
            confessionsList.map(conf => (
              <div
                key={conf.id}
                className="bg-[#0d0d0d] border border-zinc-800/40 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#eab308] tracking-wide uppercase">
                    {conf.author}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {conf.time}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-medium">
                  "{conf.content}"
                </p>
                <div className="flex items-center gap-4 pt-1 border-t border-zinc-800/20 text-xs text-zinc-500">
                  <button className="flex items-center gap-1 hover:text-red-400 transition-colors cursor-pointer">
                    <Heart className="w-4 h-4" />
                    <span>{conf.likes}</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-[#eab308] transition-colors cursor-pointer">
                    <MessageCircle className="w-4 h-4" />
                    <span>{conf.comments} comentarios</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 4. GALERIA TAB */}
      {activeTab === 'Galeria' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {galleryImages.length === 0 ? (
            <div className="col-span-full bg-[#0d0d0d] border border-zinc-800/40 rounded-xl p-12 text-center text-zinc-500 text-sm">
              La galería está vacía en este momento.
            </div>
          ) : (
            galleryImages.map((img, idx) => (
              <div
                key={idx}
                className="group relative bg-[#0d0d0d] border border-zinc-800/40 rounded-xl overflow-hidden aspect-video shadow-md"
              >
                <img
                  src={img.url}
                  alt={img.caption}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
                <div className="absolute bottom-3 left-3">
                  <p className="text-xs font-bold text-white tracking-wide uppercase">
                    {img.caption}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Botón flotante para Añadir Miembro dentro del Perfil del Centro */}
      <button
        onClick={() => setAddMemberOpen(true)}
        className="fixed bottom-24 right-6 sm:right-8 z-40 flex items-center gap-2 px-5 py-3.5 bg-[#eab308] text-black font-black text-xs uppercase tracking-widest rounded-2xl shadow-[0_4px_25px_rgba(234,179,8,0.45)] hover:scale-105 active:scale-95 transition-all cursor-pointer border-none"
        title="Añadir Miembro (Profesor / Alumno)"
      >
        <Plus className="w-4 h-4 stroke-[3]" />
        <span>Añadir Miembro</span>
      </button>

      {/* Modal de Añadir Miembro */}
      <AddMemberModal
        isOpen={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        instituteId={institution.id || institution.slug || ''}
        onSuccess={loadMembers}
      />

    </div>
  );
}
