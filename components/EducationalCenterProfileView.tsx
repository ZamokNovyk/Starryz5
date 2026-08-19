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
  User,
  RotateCcw,
  Building2,
  Flame,
  Smile,
  Copy,
  Check,
  Database,
  Send,
  CornerDownRight,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Institution } from '@/lib/mockData';
import { getProfessorsByInstitute, Professor as DbProfessor } from '@/src/lib/professors';
import { 
  getCenterConfessions, 
  toggleConfessionReaction, 
  formatTimeAgo, 
  CenterConfession, 
  ConfessionCategory, 
  ReactionType,
  CONFESSIONS_SETUP_SQL,
  getConfessionComments,
  createConfessionComment,
  ConfessionComment,
  getMyConfessionIds,
  deleteCenterConfession
} from '@/src/lib/confessions';
import AddMemberModal from '@/components/Modals/AddMemberModal';
import PublishConfessionModal from '@/components/Modals/PublishConfessionModal';
import ConfessionCommentsModal from '@/components/Modals/ConfessionCommentsModal';
import BookmarkButton from '@/components/BookmarkButton';
import { useAuth } from '@/src/context/AuthContext';

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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('Profesores');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [dbProfessors, setDbProfessors] = useState<DbProfessor[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Confessions state
  const [confessions, setConfessions] = useState<CenterConfession[]>([]);
  const [loadingConfessions, setLoadingConfessions] = useState(false);
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [confessionCategory, setConfessionCategory] = useState<ConfessionCategory>('all');
  const [confessionSort, setConfessionSort] = useState<'recent' | 'popular' | 'my_confessions'>('recent');
  const [confessionViewMode, setConfessionViewMode] = useState<ViewMode>('grid');
  const [isConfessionSortOpen, setIsConfessionSortOpen] = useState(false);
  const [publishConfessionOpen, setPublishConfessionOpen] = useState(false);

  // Comments modal state
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [selectedConfessionForModal, setSelectedConfessionForModal] = useState<CenterConfession | null>(null);

  // Delete modal state & toast
  const [confessionToDelete, setConfessionToDelete] = useState<CenterConfession | null>(null);
  const [isDeletingConfession, setIsDeletingConfession] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleToggleComments = async (confessionId: string) => {
    if (expandedCommentsId === confessionId) {
      setExpandedCommentsId(null);
      return;
    }

    setExpandedCommentsId(confessionId);

    if (!commentsMap[confessionId]) {
      setLoadingCommentsMap((prev) => ({ ...prev, [confessionId]: true }));
      const list = await getConfessionComments(confessionId);
      setCommentsMap((prev) => ({ ...prev, [confessionId]: list }));
      setLoadingCommentsMap((prev) => ({ ...prev, [confessionId]: false }));
    }
  };

  const handleSendComment = async (confessionId: string) => {
    const text = (commentInputText[confessionId] || '').trim();
    if (!text) return;

    const alias = (commentAliasText[confessionId] || '').trim() || (user ? (user.displayName || user.email?.split('@')[0]) : 'Anónimo');

    setSubmittingCommentMap((prev) => ({ ...prev, [confessionId]: true }));

    try {
      const newComment = await createConfessionComment({
        confession_id: confessionId,
        firebase_uid: user?.uid || null,
        author_name: alias || 'Anónimo',
        content: text,
        is_anonymous: !alias || alias === 'Anónimo',
      });

      // Update comments list
      setCommentsMap((prev) => ({
        ...prev,
        [confessionId]: [...(prev[confessionId] || []), newComment],
      }));

      // Update count on confession
      setConfessions((prev) =>
        prev.map((c) => (c.id === confessionId ? { ...c, comments_count: c.comments_count + 1 } : c))
      );

      // Clear input text
      setCommentInputText((prev) => ({ ...prev, [confessionId]: '' }));
    } catch (err) {
      console.error('Error al enviar respuesta:', err);
    } finally {
      setSubmittingCommentMap((prev) => ({ ...prev, [confessionId]: false }));
    }
  };

  const sortMenuRef = useRef<HTMLDivElement>(null);
  const confessionSortMenuRef = useRef<HTMLDivElement>(null);

  // Close sort menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
      if (confessionSortMenuRef.current && !confessionSortMenuRef.current.contains(event.target as Node)) {
        setIsConfessionSortOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    // Limpiar claves residuales de localStorage de pruebas previas
    try {
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('center_confessions_')) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (e) {}

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  const loadConfessions = async () => {
    try {
      setLoadingConfessions(true);
      const res = await getCenterConfessions(
        institution.id || institution.slug || '',
        confessionCategory,
        confessionSort === 'my_confessions' ? 'recent' : confessionSort,
        user?.uid
      );
      setConfessions(res.data);
      setIsTableMissing(res.isTableMissing);
    } catch (err) {
      console.warn('Aviso al cargar confesiones:', err);
    } finally {
      setLoadingConfessions(false);
    }
  };

  // Fetch real database members when the institution changes
  useEffect(() => {
    loadMembers();
  }, [institution]);

  // Fetch confessions when tab, category, sort or institution changes
  useEffect(() => {
    if (activeTab === 'Confesiones') {
      loadConfessions();
    }
  }, [institution, activeTab, confessionCategory, confessionSort]);

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle live toggle reaction
  const handleReactionClick = async (confessionId: string, reactionType: ReactionType) => {
    // Optimistic UI update
    setConfessions((prev) =>
      prev.map((c) => {
        if (c.id !== confessionId) return c;
        const isReacted = c.userReactions[reactionType];
        return {
          ...c,
          reactions: {
            ...c.reactions,
            [reactionType]: Math.max(0, c.reactions[reactionType] + (isReacted ? -1 : 1)),
          },
          userReactions: {
            ...c.userReactions,
            [reactionType]: !isReacted,
          },
        };
      })
    );

    try {
      await toggleConfessionReaction(confessionId, reactionType, user?.uid);
    } catch (err) {
      console.error('Error al reaccionar:', err);
      loadConfessions();
    }
  };

  const confirmDeleteConfession = async () => {
    if (!confessionToDelete) return;
    try {
      setIsDeletingConfession(true);
      const res = await deleteCenterConfession(confessionToDelete.id);
      if (res.success) {
        setConfessions((prev) => prev.filter((c) => c.id !== confessionToDelete.id));
        setConfessionToDelete(null);
        setToastMessage('Confesión eliminada con éxito');
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        alert('No se pudo borrar de Supabase: ' + (res.error || 'Asegúrate de ejecutar el código SQL para permitir DELETE.'));
      }
    } catch (err: any) {
      console.error('Error al eliminar confesión:', err);
      alert('Error de conexión al intentar borrar.');
    } finally {
      setIsDeletingConfession(false);
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
  const filteredMembers = mappedMembers.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter confessions with searchTerm & 'my_confessions' filter
  const myConfessionIds = getMyConfessionIds();
  const filteredConfessions = confessions.filter((c) => {
    const matchesSearch =
      searchTerm === '' ||
      c.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.author_name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (confessionSort === 'my_confessions') {
      const isMineByUid = Boolean(user?.uid && c.firebase_uid === user.uid);
      const isMineByLocalId = myConfessionIds.includes(c.id);
      return isMineByUid || isMineByLocalId;
    }

    return true;
  });

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

  // Wiki and Gallery
  const wikiArticles: WikiArticle[] = [];
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
      {activeTab === 'Profesores' && (
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
      )}

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

      {/* 3. CONFESIONES TAB (100% FUNCIONAL CON SUPABASE) */}
      {activeTab === 'Confesiones' && (
        <div className="space-y-5">
          {/* Sub-Header / Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Category Chips */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setConfessionCategory('all')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  confessionCategory === 'all'
                    ? 'bg-[#eab308] text-black shadow-md shadow-[#eab308]/20'
                    : 'bg-[#0d0d0d] text-zinc-400 border border-zinc-800/80 hover:text-white hover:border-zinc-700'
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setConfessionCategory('crush')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  confessionCategory === 'crush'
                    ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                    : 'bg-[#0d0d0d] text-zinc-400 border border-zinc-800/80 hover:text-pink-400 hover:border-pink-500/30'
                }`}
              >
                <span>❤️</span>
                <span>Crush/Amor</span>
              </button>
              <button
                type="button"
                onClick={() => setConfessionCategory('professors')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  confessionCategory === 'professors'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-[#0d0d0d] text-zinc-400 border border-zinc-800/80 hover:text-emerald-400 hover:border-emerald-500/30'
                }`}
              >
                <span>👨‍🏫</span>
                <span>Profesores</span>
              </button>
              <button
                type="button"
                onClick={() => setConfessionCategory('exams')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  confessionCategory === 'exams'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-[#0d0d0d] text-zinc-400 border border-zinc-800/80 hover:text-blue-400 hover:border-blue-500/30'
                }`}
              >
                <span>📝</span>
                <span>Exámenes</span>
              </button>
              <button
                type="button"
                onClick={() => setConfessionCategory('anecdotes')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  confessionCategory === 'anecdotes'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'bg-[#0d0d0d] text-zinc-400 border border-zinc-800/80 hover:text-amber-400 hover:border-amber-500/30'
                }`}
              >
                <span>🔥</span>
                <span>Anécdotas</span>
              </button>
            </div>

            {/* View Mode & Sort for Confessions */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {/* Toggle Lista / Mosaico */}
              <div className="flex items-center bg-[#0d0d0d] border border-zinc-800/80 rounded-xl p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setConfessionViewMode('list')}
                  title="Vista de Lista"
                  className={`p-2 rounded-lg transition-all cursor-pointer ${
                    confessionViewMode === 'list'
                      ? 'text-[#eab308] bg-[#1a1a1a] shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfessionViewMode('grid')}
                  title="Vista de Mosaico"
                  className={`p-2 rounded-lg transition-all cursor-pointer ${
                    confessionViewMode === 'grid'
                      ? 'text-[#eab308] bg-[#1a1a1a] shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>

              {/* Botón Filtros / Ordenar Confesiones */}
              <div className="relative" ref={confessionSortMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsConfessionSortOpen(!isConfessionSortOpen)}
                  className={`flex items-center gap-2 px-3.5 py-2 bg-[#0d0d0d] border ${
                    isConfessionSortOpen ? 'border-[#eab308]/60 text-white' : 'border-zinc-800/80 text-zinc-400'
                  } rounded-xl text-xs font-black uppercase tracking-wider hover:text-white hover:border-zinc-700 transition-all cursor-pointer shadow-sm`}
                >
                  <SlidersHorizontal className="w-4 h-4 text-[#eab308]" />
                  <span>
                    FILTROS: {
                      confessionSort === 'recent' 
                        ? 'RECIENTES' 
                        : confessionSort === 'popular' 
                        ? 'MÁS POPULARES' 
                        : 'MIS CONFESIONES'
                    }
                  </span>
                </button>

                {isConfessionSortOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[#0d0d0d] border border-zinc-800 rounded-2xl p-2 shadow-[0_10px_35px_rgba(0,0,0,0.85)] z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 text-xs font-black text-white uppercase tracking-wider border-b border-zinc-800/80 mb-1">
                      Filtros del Muro
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setConfessionSort('recent');
                        setIsConfessionSortOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2.5 cursor-pointer ${
                        confessionSort === 'recent' ? 'bg-[#1a1a1a] text-white font-bold' : 'text-zinc-400 hover:bg-[#141414]'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${confessionSort === 'recent' ? 'bg-[#eab308]' : 'bg-transparent'}`} />
                      <span>Más Recientes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfessionSort('popular');
                        setIsConfessionSortOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2.5 cursor-pointer ${
                        confessionSort === 'popular' ? 'bg-[#1a1a1a] text-white font-bold' : 'text-zinc-400 hover:bg-[#141414]'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${confessionSort === 'popular' ? 'bg-[#eab308]' : 'bg-transparent'}`} />
                      <span>Más Populares</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfessionSort('my_confessions');
                        setIsConfessionSortOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2.5 cursor-pointer ${
                        confessionSort === 'my_confessions' ? 'bg-[#1a1a1a] text-[#eab308] font-bold' : 'text-zinc-400 hover:bg-[#141414]'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${confessionSort === 'my_confessions' ? 'bg-[#eab308]' : 'bg-transparent'}`} />
                      <span>Ver mis confesiones</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Banner Principal del Muro Anónimo */}
          <div className="bg-[#0d0d0d] border border-zinc-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#eab308] text-2xl shrink-0 shadow-inner">
                🕶️
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white">
                  Muro Anónimo de {institution.name}
                </h3>
                <p className="text-xs text-zinc-400 font-medium mt-0.5">
                  Exprésate libremente de forma 100% confidencial.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setPublishConfessionOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-[#eab308] hover:bg-[#ca8a04] text-black font-black text-xs uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(234,179,8,0.3)] hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>NUEVA CONFESIÓN</span>
              </button>
            </div>
          </div>

          {/* Listado de Confesiones */}
          {loadingConfessions ? (
            <div className="bg-[#0d0d0d] border border-zinc-800/40 rounded-xl p-14 text-center text-zinc-400">
              <div className="w-8 h-8 border-2 border-[#eab308] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold text-white uppercase tracking-wider">Cargando confesiones del muro...</p>
            </div>
          ) : isTableMissing ? (
            <div className="bg-[#0d0d0d] border border-amber-500/30 rounded-2xl p-6 sm:p-8 space-y-4 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Database className="w-6 h-6" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h4 className="text-base font-black text-white">Tabla de Confesiones pendiente en Supabase</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    La tabla <code className="text-[#eab308] bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">public.center_confessions</code> aún no ha sido creada en tu base de datos Supabase. Ejecuta el script SQL en el <strong className="text-white">Editor SQL de Supabase</strong> para habilitar el muro al instante.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      navigator.clipboard.writeText(CONFESSIONS_SETUP_SQL);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2500);
                    }
                  }}
                  className="px-5 py-2.5 bg-[#eab308] hover:bg-[#ca8a04] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>¡SCRIPT SQL COPIADO!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>COPIAR SCRIPT SQL</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={loadConfessions}
                  className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reintentar Conexión</span>
                </button>
              </div>
            </div>
          ) : filteredConfessions.length === 0 ? (
            <div className="bg-[#0d0d0d] border border-zinc-800/40 rounded-2xl p-12 text-center space-y-4">
              <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-2xl mx-auto text-zinc-500">
                💬
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-base font-bold text-white">
                  {confessionSort === 'my_confessions'
                    ? 'No has publicado confesiones aún'
                    : 'No hay confesiones registradas aún'}
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {confessionSort === 'my_confessions'
                    ? 'Todas las confesiones que publiques desde este dispositivo o cuenta aparecerán en esta sección.'
                    : `Sé el primero en compartir un secreto, anécdota o mensaje anónimo en el muro de ${institution.name}.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPublishConfessionOpen(true)}
                className="px-6 py-2.5 bg-[#eab308] hover:bg-[#ca8a04] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
              >
                + CREAR PRIMERA CONFESIÓN
              </button>
            </div>
          ) : (
            <div
              className={
                confessionViewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                  : 'space-y-3.5'
              }
            >
              {filteredConfessions.map((conf) => {
                // Card style styling
                const isPink = conf.card_style === 'pink';
                const isFire = conf.card_style === 'fire';

                // Category badge labeling & styling
                let categoryLabel = 'Anécdotas';
                let categoryBadgeClass = 'bg-[#181818] text-zinc-300 border-zinc-700/60';

                if (conf.category === 'crush') {
                  categoryLabel = 'Crush/Amor';
                  categoryBadgeClass = 'bg-pink-950/40 text-pink-400 border-pink-500/30';
                } else if (conf.category === 'professors') {
                  categoryLabel = 'Profesores';
                  categoryBadgeClass = 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30';
                } else if (conf.category === 'exams') {
                  categoryLabel = 'Exámenes';
                  categoryBadgeClass = 'bg-blue-950/40 text-blue-400 border-blue-500/30';
                } else if (conf.category === 'anecdotes') {
                  categoryLabel = 'Anécdotas';
                  categoryBadgeClass = 'bg-amber-950/40 text-amber-400 border-amber-500/30';
                }

                return (
                  <div
                    key={conf.id}
                    className={`bg-[#0d0d0d] rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 ${
                      isPink
                        ? 'border border-pink-500/40 hover:border-pink-500/80 shadow-[0_0_25px_rgba(236,72,153,0.08)]'
                        : isFire
                        ? 'border border-amber-500/40 hover:border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.08)]'
                        : 'border border-zinc-800/80 hover:border-zinc-700 shadow-sm'
                    }`}
                  >
                    <div>
                      {/* Header Author & Category */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#181818] border border-amber-500/30 flex items-center justify-center text-[#eab308] shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-xs text-white tracking-wide">
                                {conf.author_name}
                              </span>
                              {!conf.is_anonymous && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#eab308] fill-[#eab308]/20 shrink-0" />
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-500 font-medium block">
                              {formatTimeAgo(conf.created_at)}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg border uppercase tracking-wider shrink-0 ${categoryBadgeClass}`}
                        >
                          {categoryLabel}
                        </span>
                      </div>

                      {/* Content */}
                      <p className="text-xs sm:text-sm text-zinc-200 font-medium leading-relaxed my-3">
                        {conf.content}
                      </p>
                    </div>

                    {/* Footer Reactions & Action Bar */}
                    <div className="pt-3 border-t border-zinc-800/40 mt-3 space-y-2.5">
                      {/* Row 1: All 5 Reactions Together */}
                      <div className="grid grid-cols-5 gap-1 text-xs">
                        {/* Reaction 1: Heart ❤️ */}
                        <button
                          type="button"
                          onClick={() => handleReactionClick(conf.id, 'heart')}
                          className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            conf.userReactions.heart
                              ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm'
                              : 'bg-zinc-900/80 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 border border-zinc-800/60'
                          }`}
                          title="Amor / Crush"
                        >
                          <span>❤️</span>
                          <span className="text-[11px]">{conf.reactions.heart}</span>
                        </button>

                        {/* Reaction 2: Laugh 😂 */}
                        <button
                          type="button"
                          onClick={() => handleReactionClick(conf.id, 'laugh')}
                          className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            conf.userReactions.laugh
                              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 shadow-sm'
                              : 'bg-zinc-900/80 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-800 border border-zinc-800/60'
                          }`}
                          title="Risa / Jaja"
                        >
                          <span>😂</span>
                          <span className="text-[11px]">{conf.reactions.laugh}</span>
                        </button>

                        {/* Reaction 3: Fire 🔥 */}
                        <button
                          type="button"
                          onClick={() => handleReactionClick(conf.id, 'fire')}
                          className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            conf.userReactions.fire
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                              : 'bg-zinc-900/80 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 border border-zinc-800/60'
                          }`}
                          title="Picante / Fuego"
                        >
                          <span>🔥</span>
                          <span className="text-[11px]">{conf.reactions.fire}</span>
                        </button>

                        {/* Reaction 4: Cry / Tragedia 😭 */}
                        <button
                          type="button"
                          onClick={() => handleReactionClick(conf.id, 'cry')}
                          className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            conf.userReactions.cry
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm'
                              : 'bg-zinc-900/80 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 border border-zinc-800/60'
                          }`}
                          title="F / Tragedia"
                        >
                          <span>😭</span>
                          <span className="text-[11px]">{conf.reactions.cry}</span>
                        </button>

                        {/* Reaction 5: Shock / Asombro 🤯 */}
                        <button
                          type="button"
                          onClick={() => handleReactionClick(conf.id, 'shock')}
                          className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            conf.userReactions.shock
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-sm'
                              : 'bg-zinc-900/80 text-zinc-400 hover:text-purple-400 hover:bg-zinc-800 border border-zinc-800/60'
                          }`}
                          title="Asombro / Drama"
                        >
                          <span>🤯</span>
                          <span className="text-[11px]">{conf.reactions.shock}</span>
                        </button>
                      </div>

                      {/* Row 2: Action Bar Underneath (Delete if mine or Admin + Response Button) */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40">
                        {/* Left Side: Delete confession (author or admin) */}
                        {(((user as any)?.role === 'admin' || user?.email === 'wikistars12@gmail.com') ||
                          (user?.uid && conf.firebase_uid === user.uid) ||
                          myConfessionIds.includes(conf.id)) ? (
                          <button
                            type="button"
                            onClick={() => setConfessionToDelete(conf)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                            title={(user as any)?.role === 'admin' ? "Eliminar confesión (Modo Admin)" : "Eliminar mi confesión"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar</span>
                          </button>
                        ) : (
                          <div />
                        )}

                        {/* Right Side: Comments Modal Trigger Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedConfessionForModal(conf);
                            setCommentsModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/90 text-zinc-300 hover:text-[#eab308] hover:bg-zinc-800 border border-zinc-800/80 hover:border-[#eab308]/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ml-auto"
                          title="Responder / Ver Respuestas"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-[#eab308]" />
                          <span>Responder ({conf.comments_count})</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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

      {/* Botón flotante para Añadir Miembro / Nueva Confesión según tab activa */}
      {activeTab === 'Profesores' ? (
        <button
          onClick={() => setAddMemberOpen(true)}
          className="fixed bottom-24 right-6 sm:right-8 z-40 flex items-center gap-2 px-5 py-3.5 bg-[#eab308] text-black font-black text-xs uppercase tracking-widest rounded-2xl shadow-[0_4px_25px_rgba(234,179,8,0.45)] hover:scale-105 active:scale-95 transition-all cursor-pointer border-none"
          title="Añadir Miembro (Profesor / Alumno)"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Añadir Miembro</span>
        </button>
      ) : activeTab === 'Confesiones' ? (
        <button
          onClick={() => setPublishConfessionOpen(true)}
          className="fixed bottom-24 right-6 sm:right-8 z-40 flex items-center gap-2 px-5 py-3.5 bg-[#eab308] text-black font-black text-xs uppercase tracking-widest rounded-2xl shadow-[0_4px_25px_rgba(234,179,8,0.45)] hover:scale-105 active:scale-95 transition-all cursor-pointer border-none"
          title="Publicar Confesión"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nueva Confesión</span>
        </button>
      ) : null}

      {/* Modal de Añadir Miembro */}
      <AddMemberModal
        isOpen={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        instituteId={institution.id || institution.slug || ''}
        onSuccess={loadMembers}
      />

      {/* Modal de Publicar Confesión */}
      <PublishConfessionModal
        isOpen={publishConfessionOpen}
        onClose={() => setPublishConfessionOpen(false)}
        institutionId={institution.id || institution.slug || ''}
        institutionName={institution.name}
        onSuccess={loadConfessions}
      />

      {/* Modal de Respuestas a Confesión */}
      <ConfessionCommentsModal
        isOpen={commentsModalOpen}
        onClose={() => {
          setCommentsModalOpen(false);
          setSelectedConfessionForModal(null);
        }}
        confession={selectedConfessionForModal}
        onCommentAdded={(confId) => {
          setConfessions((prev) =>
            prev.map((c) => (c.id === confId ? { ...c, comments_count: c.comments_count + 1 } : c))
          );
          if (selectedConfessionForModal && selectedConfessionForModal.id === confId) {
            setSelectedConfessionForModal((prev) =>
              prev ? { ...prev, comments_count: prev.comments_count + 1 } : null
            );
          }
        }}
      />

      {/* Modal de Confirmación para Eliminar Confesión */}
      {confessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-md bg-[#0d0d0d] border border-red-500/40 rounded-3xl p-6 space-y-5 shadow-[0_25px_70px_rgba(0,0,0,0.95)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">¿Eliminar confesión?</h2>
                <p className="text-xs text-zinc-400 font-medium">Confirmación requerida</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-[#141414] border border-zinc-800 p-3.5 rounded-2xl">
              ¿Estás seguro de querer eliminar esta confesión? Esta acción borrará la publicación del muro permanentemente, así como todas sus reacciones y respuestas asociadas en la base de datos.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfessionToDelete(null)}
                disabled={isDeletingConfession}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs rounded-xl border border-zinc-800 transition-all cursor-pointer"
              >
                No, Cancelar
              </button>

              <button
                type="button"
                onClick={confirmDeleteConfession}
                disabled={isDeletingConfession}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingConfession ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Sí, Eliminar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3.5 bg-emerald-500 text-black font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.5)] flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
