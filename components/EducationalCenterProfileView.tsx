'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Share2, 
  BookOpen, 
  Search, 
  SlidersHorizontal, 
  List, 
  Grid, 
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
  Plus
} from 'lucide-react';
import { Institution } from '@/lib/mockData';
import { getProfessorsByInstitute, Professor as DbProfessor } from '@/src/lib/professors';
import AddMemberModal from '@/components/Modals/AddMemberModal';

interface EducationalCenterProfileViewProps {
  institution: Institution;
  onBack: () => void;
  onSelectProfessor?: (slug: string) => void;
}

type TabType = 'Wiki' | 'Profesores' | 'Confesiones' | 'Galeria';

interface Professor {
  id?: string;
  rank?: number;
  name: string;
  avatar: string;
  likes: number;
  students: number;
  confessions: number;
  score: number;
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
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [dbProfessors, setDbProfessors] = useState<DbProfessor[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Helper helper slug generator
  const getSlugFromName = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9]/g, '.') // replace non-alphanumeric with dot
      .replace(/\.+/g, '.') // collapse multiple dots
      .replace(/^\.|\.$/g, ''); // trim dots from start/end
  };

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

  // Convert real database payload into Professor list UI format
  const mappedDbProfessors: Professor[] = dbProfessors.map((dp) => ({
    id: dp.id,
    name: dp.nombre_completo || `${dp.nombre} ${dp.apellidos}`,
    avatar: dp.role === 'Alumno' 
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop'
      : '', // initials fallback
    likes: dp.knows_count || 0,
    students: dp.role === 'Alumno' ? 0 : 4,
    confessions: 0,
    score: dp.score || 0.0,
  }));

  // Add calculated dynamic ranks
  const finalProfessors = mappedDbProfessors.map((p, idx) => ({
    ...p,
    rank: idx + 1,
  }));

  // Filter list with searchTerm
  const filteredProfessors = finalProfessors.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );


  // Wiki, Confessions and Gallery are kept empty as they don't have database records yet
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

      {/* HEADER DE LA INSTITUCIÓN (Diseño idéntico a imagen 1) */}
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
            <button
              onClick={handleShare}
              className="p-3 rounded-full bg-[#151515] hover:bg-[#202020] border border-zinc-800 text-zinc-400 hover:text-[#eab308] transition-all cursor-pointer flex-shrink-0 self-center sm:self-start shadow-md"
              title="Compartir link"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
          {copied && (
            <p className="text-xs text-[#eab308] font-bold tracking-wide animate-pulse">
              ✓ ¡Enlace copiado al portapapeles!
            </p>
          )}
        </div>
      </div>

      {/* INPUT BUSCADOR (Diseño idéntico a imagen 1) */}
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

      {/* BARRA DE TABS / TAGS (Wiki, Profesores, Confesiones, Galeria - idéntico a la imagen 1 con tags solicitadas) */}
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

      {/* CONTROLES DE ORDEN / VISTA */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <div className="flex items-center bg-[#0d0d0d] border border-zinc-800/80 rounded-lg p-1">
          <button className="p-1.5 text-[#eab308] bg-[#151515] rounded-md">
            <List className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-zinc-500 hover:text-zinc-300">
            <Grid className="w-4 h-4" />
          </button>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d0d0d] border border-zinc-800/80 rounded-lg text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Ordenar</span>
        </button>
      </div>

      {/* RENDERIZADO DE CONTENIDOS SEGÚN LA TAB ACTIVA */}
      
      {/* 1. PROFESORES TAB (Diseño exacto de imagen 1) */}
      {activeTab === 'Profesores' && (
        <div className="space-y-3">
          {filteredProfessors.length === 0 ? (
            <div className="bg-[#0d0d0d] border border-zinc-800/40 rounded-xl p-12 text-center text-zinc-500 text-sm">
              No se encontraron profesores con la búsqueda actual.
            </div>
          ) : (
            filteredProfessors.map((p) => (
              <div
                key={p.rank}
                onClick={() => {
                  if (onSelectProfessor) {
                    onSelectProfessor(p.id || getSlugFromName(p.name));
                  }
                }}
                className="group flex items-center justify-between gap-4 bg-[#0d0d0d] border border-zinc-800/40 hover:border-[#eab308]/30 hover:bg-[#121212] rounded-xl p-4 transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Rank circular */}
                  <div className="w-8 h-8 rounded-full bg-[#131313] flex items-center justify-center text-xs font-black text-zinc-600 group-hover:text-[#eab308] transition-colors">
                    {p.rank}
                  </div>

                  {/* Avatar circular */}
                  {p.avatar ? (
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="w-11 h-11 rounded-full object-cover border border-zinc-800"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[#1e1e1e] border border-zinc-800 flex items-center justify-center text-white font-black text-sm uppercase">
                      {p.name.charAt(0)}
                    </div>
                  )}

                  {/* Datos del profesor */}
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-extrabold text-white group-hover:text-[#eab308] transition-colors leading-snug">
                      {p.name}
                    </h3>
                    <div className="flex items-center gap-3.5 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-zinc-600" />
                        {p.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-zinc-600" />
                        {p.students}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5 text-zinc-600" />
                        {p.confessions}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score en el extremo derecho */}
                <div className="flex items-center gap-1.5 text-sm sm:text-base font-black text-[#eab308]">
                  <Star className="w-4 h-4 fill-[#eab308] text-[#eab308]" />
                  <span>{p.score.toFixed(1)}</span>
                </div>
              </div>
            ))
          )}
        </div>
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
