'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Share2, 
  BookOpen, 
  Award, 
  Heart, 
  Users, 
  Sparkles, 
  MessageSquare, 
  BarChart3, 
  Star, 
  ThumbsUp, 
  Plus, 
  CheckCircle2,
  Calendar,
  Loader2,
  GraduationCap
} from 'lucide-react';
import { 
  getStudentById, 
  Student, 
  getUserStudentInteraction, 
  getStudentInteractionCounts, 
  toggleStudentInteraction,
  getTodayStudentVotes,
  getStudentRatingBreakdown,
  submitStudentVote,
  updateStudentWiki,
  getStudentCrushStatus,
  toggleStudentCrush
} from '@/src/lib/students';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import BookmarkButton from '@/components/BookmarkButton';
import { promptNotificationOnAction } from '@/src/lib/notificationHelper';

interface StudentProfileProps {
  slug: string;
  onBack: () => void;
  onRequireAuth?: () => void;
}

type TabType = 'Wiki' | 'Reseñas' | 'Crushes' | 'Ship' | 'Estadística';

export default function StudentProfile({
  slug,
  onBack,
  onRequireAuth,
}: StudentProfileProps) {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('Reseñas');
  const [copied, setCopied] = useState(false);

  // Interaction counts state
  const [knowCount, setKnowCount] = useState(0);
  const [fanCount, setFanCount] = useState(0);
  const [hasVotedKnow, setHasVotedKnow] = useState(false);
  const [hasVotedFan, setHasVotedFan] = useState(false);
  const [loadingInteraction, setLoadingInteraction] = useState(false);

  // Star Rating States
  const [studentScore, setStudentScore] = useState(0);
  const [studentTotalRatings, setStudentTotalRatings] = useState(0);
  const [todayVotes, setTodayVotes] = useState<number[]>([]);
  const [ratingBreakdown, setRatingBreakdown] = useState<{ [key: number]: number }>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [votingInProgress, setVotingInProgress] = useState(false);

  // Crush States
  const [crushCount, setCrushCount] = useState(0);
  const [hasCrushed, setHasCrushed] = useState(false);
  const [loadingCrush, setLoadingCrush] = useState(false);

  // Wiki Editing States
  const [isEditingWiki, setIsEditingWiki] = useState(false);
  const [wikiAvatarUrl, setWikiAvatarUrl] = useState('');
  const [wikiHeightCm, setWikiHeightCm] = useState<string>('');
  const [wikiMaritalStatus, setWikiMaritalStatus] = useState('No especificado');
  const [wikiGender, setWikiGender] = useState('No especificado');
  const [wikiBirthYear, setWikiBirthYear] = useState('');
  const [wikiBirthMonth, setWikiBirthMonth] = useState('');
  const [wikiBirthDay, setWikiBirthDay] = useState('');
  const [wikiInstagram, setWikiInstagram] = useState('');
  const [wikiYoutube, setWikiYoutube] = useState('');
  const [wikiFacebook, setWikiFacebook] = useState('');
  const [wikiTwitter, setWikiTwitter] = useState('');
  const [wikiBiography, setWikiBiography] = useState('');
  const [savingWiki, setSavingWiki] = useState(false);
  const [socialErrors, setSocialErrors] = useState<{
    instagram?: string;
    youtube?: string;
    facebook?: string;
    twitter?: string;
  }>({});

  useEffect(() => {
    async function loadStudentAndInteractions() {
      try {
        setLoading(true);
        const data = await getStudentById(slug);
        if (data) {
          setStudent(data);
          setStudentScore(data.score || 0.0);
          setStudentTotalRatings(data.total_ratings || 0);
          
          const counts = await getStudentInteractionCounts(data.id || slug);
          setKnowCount(counts.knows);
          setFanCount(counts.fan);

          const breakdown = await getStudentRatingBreakdown(data.id || slug);
          setRatingBreakdown(breakdown);

          const crushStatus = await getStudentCrushStatus(data.id || slug, user?.uid || '');
          setCrushCount(crushStatus.count);
          setHasCrushed(crushStatus.hasCrushed);

          if (user) {
            const todayV = await getTodayStudentVotes(data.id || slug, user.uid);
            setTodayVotes(todayV);

            const userInteraction = await getUserStudentInteraction(data.id || slug, user.uid);
            if (userInteraction) {
              setHasVotedKnow(userInteraction.interaction_type === 'knows');
              setHasVotedFan(userInteraction.interaction_type === 'fan');
            } else {
              setHasVotedKnow(false);
              setHasVotedFan(false);
            }
          } else {
            setTodayVotes([]);
            setHasVotedKnow(false);
            setHasVotedFan(false);
          }
        } else {
          setStudent(null);
        }
      } catch (err) {
        console.error('Error al cargar datos del estudiante:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStudentAndInteractions();
  }, [slug, user]);

  const handleToggleCrush = async () => {
    if (!user) {
      if (onRequireAuth) onRequireAuth();
      return;
    }

    if (!student) return;

    const studentId = student.id || slug;
    const previousHasCrushed = hasCrushed;
    const previousCount = crushCount;

    const nextHasCrushed = !previousHasCrushed;
    const nextCount = nextHasCrushed ? previousCount + 1 : Math.max(0, previousCount - 1);

    setHasCrushed(nextHasCrushed);
    setCrushCount(nextCount);
    setLoadingCrush(true);

    try {
      const result = await toggleStudentCrush(studentId, user.uid);
      setHasCrushed(result.hasCrushed);
      setCrushCount(result.count);
    } catch (err) {
      console.error('Error al alternar voto de crush:', err);
      setHasCrushed(previousHasCrushed);
      setCrushCount(previousCount);
    } finally {
      setLoadingCrush(false);
    }
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="w-10 h-10 border-2 border-[#eab308] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Cargando perfil de estudiante...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <h3 className="text-xl font-black text-white uppercase">Estudiante no encontrado</h3>
        <p className="text-xs text-zinc-400">El estudiante solicitado no se encuentra registrado en nuestra base de datos.</p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl bg-[#eab308] text-black font-extrabold text-xs uppercase"
        >
          Volver
        </button>
      </div>
    );
  }

  const handleInteractionToggle = async (type: 'knows' | 'fan') => {
    if (!user) {
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }

    if (!student) return;
    const studentId = student.id || slug;

    const prevVotedKnow = hasVotedKnow;
    const prevVotedFan = hasVotedFan;
    const prevKnowCount = knowCount;
    const prevFanCount = fanCount;

    try {
      setLoadingInteraction(true);

      if (type === 'knows') {
        if (hasVotedKnow) {
          setHasVotedKnow(false);
          setKnowCount(prev => Math.max(0, prev - 1));
        } else {
          setHasVotedKnow(true);
          setKnowCount(prev => prev + 1);
          if (hasVotedFan) {
            setHasVotedFan(false);
            setFanCount(prev => Math.max(0, prev - 1));
          }
        }
      } else if (type === 'fan') {
        if (hasVotedFan) {
          setHasVotedFan(false);
          setFanCount(prev => Math.max(0, prev - 1));
        } else {
          setHasVotedFan(true);
          setFanCount(prev => prev + 1);
          if (hasVotedKnow) {
            setHasVotedKnow(false);
            setKnowCount(prev => Math.max(0, prev - 1));
          }
        }
      }

      const result = await toggleStudentInteraction(studentId, user.uid, type);
      if (result && result.success) {
        const counts = await getStudentInteractionCounts(studentId);
        setKnowCount(counts.knows);
        setFanCount(counts.fan);
      }
    } catch (err) {
      console.error('Error al guardar la interacción:', err);
      setHasVotedKnow(prevVotedKnow);
      setHasVotedFan(prevVotedFan);
      setKnowCount(prevKnowCount);
      setFanCount(prevFanCount);
    } finally {
      setLoadingInteraction(false);
    }
  };

  const opportunitiesLeft = Math.max(0, 6 - todayVotes.length);

  const handleStarVote = async (stars: number) => {
    try {
      const audioUrl = `/sonidos/star${stars}.mp3`;
      const audio = new Audio(audioUrl);
      audio.volume = 0.55;
      audio.play().catch(e => console.warn('Audio play prevented:', e));
    } catch (e) {
      console.warn('Audio playback error:', e);
    }

    if (!user) {
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }

    if (!student) return;
    if (opportunitiesLeft <= 0) return;
    if (votingInProgress) return;

    try {
      setVotingInProgress(true);
      const studentId = student.id || slug;

      const result = await submitStudentVote(studentId, user.uid, stars);
      if (result && result.success) {
        setStudentScore(result.new_score);
        setStudentTotalRatings(result.total_ratings);
        setTodayVotes(prev => [...prev, stars]);
        setRatingBreakdown(prev => ({
          ...prev,
          [stars]: (prev[stars] || 0) + 1
        }));
        promptNotificationOnAction('rating');
      }
    } catch (err) {
      console.error('Error al registrar calificación:', err);
    } finally {
      setVotingInProgress(false);
    }
  };

  const studentName = student.nombre_completo || `${student.nombre} ${student.apellidos}`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Botón Volver */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border border-zinc-800/80"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver</span>
        </button>

        <div className="flex items-center gap-2">
          <BookmarkButton 
            item={{
              id: student.id,
              type: 'student',
              title: studentName,
              category: 'Estudiante',
              url: `/estudiantes/${student.id}`,
              avatar: student.avatar_url,
              score: studentScore
            }} 
          />
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border border-zinc-800/80"
          >
            <Share2 className="w-4 h-4" />
            <span>{copied ? '¡Copiado!' : 'Compartir'}</span>
          </button>
        </div>
      </div>

      {/* Tarjeta Principal de Cabecera del Estudiante */}
      <div className="bg-[#0f0f0f] border border-zinc-800/60 rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          
          {/* Avatar */}
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-zinc-800 border-2 border-[#eab308]/30 overflow-hidden flex-shrink-0 flex items-center justify-center relative shadow-lg">
            {student.avatar_url ? (
              <img
                src={student.avatar_url}
                alt={studentName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-4xl font-black text-zinc-600">
                {student.nombre ? student.nombre.charAt(0).toUpperCase() : 'E'}
              </div>
            )}
            <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur-md rounded-md text-[10px] font-black text-[#eab308] border border-[#eab308]/20 uppercase">
              Estudiante
            </span>
          </div>

          {/* Información Principal */}
          <div className="flex-1 text-center sm:text-left space-y-3">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="px-3 py-1 bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/20 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" />
                Estudiante
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {studentName}
            </h1>

            {/* Métricas destacadas */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2">
              {/* Score */}
              <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-800 px-3.5 py-2 rounded-xl">
                <Star className="w-4 h-4 text-[#eab308] fill-[#eab308]" />
                <span className="text-base font-black text-white">{studentScore.toFixed(1)}</span>
                <span className="text-xs text-zinc-500 font-bold">({studentTotalRatings} votos)</span>
              </div>

              {/* Conozco */}
              <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-800 px-3.5 py-2 rounded-xl">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-black text-white">{knowCount}</span>
                <span className="text-xs text-zinc-500 font-bold">lo conocen</span>
              </div>

              {/* Fans */}
              <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-800 px-3.5 py-2 rounded-xl">
                <Award className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-black text-white">{fanCount}</span>
                <span className="text-xs text-zinc-500 font-bold">fans</span>
              </div>

              {/* Crushes */}
              <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-800 px-3.5 py-2 rounded-xl">
                <Heart className="w-4 h-4 text-pink-500 fill-pink-500/20" />
                <span className="text-sm font-black text-white">{crushCount}</span>
                <span className="text-xs text-zinc-500 font-bold">crushes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Botones de Interacción Rápida: Yo te conozco / Fan / Crush */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-zinc-800/60">
          
          <button
            onClick={() => handleInteractionToggle('knows')}
            disabled={loadingInteraction}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${
              hasVotedKnow
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-sm'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{hasVotedKnow ? '✓ Yo te conozco' : 'Yo te conozco'}</span>
          </button>

          <button
            onClick={() => handleInteractionToggle('fan')}
            disabled={loadingInteraction}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${
              hasVotedFan
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>{hasVotedFan ? '✓ Soy su fan' : 'Soy su fan'}</span>
          </button>

          <button
            onClick={handleToggleCrush}
            disabled={loadingCrush}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${
              hasCrushed
                ? 'bg-pink-500/20 text-pink-400 border-pink-500/40 shadow-sm'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800'
            }`}
          >
            <Heart className={`w-4 h-4 ${hasCrushed ? 'fill-pink-400' : ''}`} />
            <span>{hasCrushed ? '✓ Es mi Crush' : 'Es mi Crush'}</span>
          </button>
        </div>
      </div>

      {/* Navegación por Pestañas */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto">
        {(['Reseñas', 'Wiki', 'Crushes', 'Ship', 'Estadística'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab
                ? 'bg-[#eab308] text-black shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Contenido según la pestaña */}
      {activeTab === 'Reseñas' && (
        <div className="space-y-6">
          {/* Módulo de Calificación por Estrellas */}
          <div className="bg-[#0f0f0f] border border-zinc-800/60 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-wide">Califica a este Estudiante</h3>
                <p className="text-xs text-zinc-400">
                  {opportunitiesLeft > 0 
                    ? `Tienes ${opportunitiesLeft} ${opportunitiesLeft === 1 ? 'oportunidad' : 'oportunidades'} restantes para votar hoy.`
                    : 'Has alcanzado el límite diario de votos (6 de 6) para este perfil.'}
                </p>
              </div>

              {/* Botones de Estrellas 1 a 5 */}
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleStarVote(star)}
                    disabled={opportunitiesLeft <= 0 || votingInProgress}
                    className="p-3 bg-zinc-900 hover:bg-[#eab308]/20 border border-zinc-800 hover:border-[#eab308]/50 rounded-2xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group"
                    title={`Votar con ${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
                  >
                    <Star className="w-6 h-6 text-zinc-600 group-hover:text-[#eab308] group-hover:fill-[#eab308] transition-colors" />
                  </button>
                ))}
              </div>
            </div>

            {/* Desglose de estrellas */}
            <div className="space-y-2 pt-4 border-t border-zinc-800/60">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratingBreakdown[star] || 0;
                const total = studentTotalRatings || 1;
                const percentage = Math.round((count / total) * 100);

                return (
                  <div key={star} className="flex items-center gap-3 text-xs">
                    <span className="w-14 text-zinc-400 font-bold">{star} estrellas</span>
                    <div className="flex-1 h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                      <div 
                        className="h-full bg-[#eab308] rounded-full transition-all duration-500"
                        style={{ width: `${studentTotalRatings ? percentage : 0}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-zinc-500 font-bold">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Wiki' && (
        <div className="bg-[#0f0f0f] border border-zinc-800/60 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-white uppercase tracking-wide">Información de la Wiki</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl space-y-1">
              <span className="text-zinc-500 font-bold uppercase tracking-wider">Nombre Completo</span>
              <p className="text-white font-black text-sm">{studentName}</p>
            </div>

            <div className="p-4 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl space-y-1">
              <span className="text-zinc-500 font-bold uppercase tracking-wider">Rol Institucional</span>
              <p className="text-[#eab308] font-black text-sm">Estudiante</p>
            </div>

            <div className="p-4 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl space-y-1 sm:col-span-2">
              <span className="text-zinc-500 font-bold uppercase tracking-wider">Biografía / Acerca de</span>
              <p className="text-zinc-300 text-sm leading-relaxed">
                {student.biography || 'Aún no se ha añadido una biografía para este estudiante.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Crushes' && (
        <div className="bg-[#0f0f0f] border border-zinc-800/60 rounded-3xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-pink-500/10 border border-pink-500/30 rounded-full flex items-center justify-center text-pink-400 mx-auto">
            <Heart className="w-8 h-8 fill-pink-400/30" />
          </div>
          <h3 className="text-lg font-black text-white uppercase">Club de Crushes</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Este estudiante tiene un total de <span className="text-pink-400 font-black">{crushCount}</span> personas que lo consideran su crush secreto.
          </p>
          <button
            onClick={handleToggleCrush}
            className="px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-lg shadow-pink-500/20"
          >
            {hasCrushed ? 'Ya diste tu Crush' : 'Declarar Crush'}
          </button>
        </div>
      )}

      {activeTab === 'Ship' && (
        <div className="bg-[#0f0f0f] border border-zinc-800/60 rounded-3xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/30 rounded-full flex items-center justify-center text-purple-400 mx-auto">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-white uppercase">Simulador de Compatibilidad</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Calcula la compatibilidad entre este estudiante y otros miembros del centro educativo.
          </p>
        </div>
      )}

      {activeTab === 'Estadística' && (
        <div className="bg-[#0f0f0f] border border-zinc-800/60 rounded-3xl p-8 space-y-6">
          <h3 className="text-lg font-black text-white uppercase">Métricas y Rendimiento</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl text-center space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Calificación</span>
              <p className="text-2xl font-black text-[#eab308]">{studentScore.toFixed(1)}</p>
            </div>
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl text-center space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Total Votos</span>
              <p className="text-2xl font-black text-white">{studentTotalRatings}</p>
            </div>
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl text-center space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Lo Conocen</span>
              <p className="text-2xl font-black text-blue-400">{knowCount}</p>
            </div>
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl text-center space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Fans</span>
              <p className="text-2xl font-black text-emerald-400">{fanCount}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
