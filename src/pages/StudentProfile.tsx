'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bell,
  BellRing,
  ArrowLeft, 
  Share2, 
  BookOpen, 
  Award, 
  Heart, 
  Users, 
  Sparkles, 
  BarChart3, 
  Star, 
  Plus, 
  CheckCircle2, 
  Calendar, 
  Loader2,
  MessageCircle,
  Send,
  Lock,
  Trash2,
  Quote,
  AlertCircle,
  Eye
} from 'lucide-react';
import { 
  getStudentById, 
  Student, 
  getUserStudentInteraction, 
  getStudentInteractionCounts, 
  toggleStudentInteraction,
  incrementStudentViews,
  getTodayStudentVotes,
  getStudentRatingBreakdown,
  submitStudentVote,
  updateStudentWiki,
  getStudentCrushStatus,
  toggleStudentCrush,
  getStudentLoveMessages,
  createStudentLoveMessage,
  deleteStudentLoveMessage,
  toggleStudentLoveMessageHeart,
  StudentLoveMessage,
  getStudentNotificationPreferences
} from '@/src/lib/students';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/lib/supabase';
import BookmarkButton from '@/components/BookmarkButton';
import StudentNotificationModal from '@/components/Modals/StudentNotificationModal';
import { promptNotificationOnAction } from '@/src/lib/notificationHelper';
import StudentTrendsEngine from '@/src/components/StudentTrendsEngine';

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

  // Notification Subscription States
  const [isSubscribedToNotifications, setIsSubscribedToNotifications] = useState(false);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);

  // Crush States
  const [crushCount, setCrushCount] = useState(0);
  const [hasCrushed, setHasCrushed] = useState(false);
  const [loadingCrush, setLoadingCrush] = useState(false);

  // Views Count State
  const [viewsCount, setViewsCount] = useState(0);

  // Love Messages States
  const [loveMessages, setLoveMessages] = useState<StudentLoveMessage[]>([]);
  const [loadingLoveMessages, setLoadingLoveMessages] = useState(false);
  const [loveMessageText, setLoveMessageText] = useState('');
  const [submittingLoveMessage, setSubmittingLoveMessage] = useState(false);
  const [loveMessageError, setLoveMessageError] = useState<string | null>(null);
  const [loveMessageSuccess, setLoveMessageSuccess] = useState(false);
  const [currentAuthorName, setCurrentAuthorName] = useState<string>('Anónimo');
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);

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
          setViewsCount(typeof data.views_count === 'number' ? data.views_count : 0);
          
          // Cargar conteos totales de interacción de la BD
          const counts = await getStudentInteractionCounts(data.id || slug);
          setKnowCount(counts.knows);
          setFanCount(counts.fan);

          // Incrementar y sincronizar visualización con la BD
          try {
            const vCount = await incrementStudentViews(data.id || slug);
            if (typeof vCount === 'number' && vCount > 0) {
              setViewsCount(prev => Math.max(prev, vCount));
            }
          } catch (vErr) {
            console.debug('Error registrando visualización:', vErr);
          }

          // Cargar distribución (breakdown) de calificaciones
          const breakdown = await getStudentRatingBreakdown(data.id || slug);
          setRatingBreakdown(breakdown);

          // Cargar estado inicial de crushes
          const crushStatus = await getStudentCrushStatus(data.id || slug, user?.uid || '');
          setCrushCount(crushStatus.count);
          setHasCrushed(crushStatus.hasCrushed);

          // Cargar mensajes de amor
          try {
            const msgs = await getStudentLoveMessages(data.id || slug, user?.uid);
            setLoveMessages(msgs);
          } catch (mErr) {
            console.warn('Error al cargar mensajes de amor:', mErr);
          }

          // Cargar interacciones y votos del usuario si está logueado
          if (user) {
            const todayV = await getTodayStudentVotes(data.id || slug, user.uid);
            setTodayVotes(todayV);

            // Cargar estado de suscripción a notificaciones
            try {
              const prefs = await getStudentNotificationPreferences(data.id || slug, user.uid);
              if (prefs && Object.values(prefs).some(Boolean)) {
                setIsSubscribedToNotifications(true);
              } else {
                setIsSubscribedToNotifications(false);
              }
            } catch (pErr) {
              console.warn('Error loading student notif prefs:', pErr);
            }

            const userInteraction = await getUserStudentInteraction(data.id || slug, user.uid);
            if (userInteraction) {
              setHasVotedKnow(userInteraction.interaction_type === 'knows');
              setHasVotedFan(userInteraction.interaction_type === 'fan');
            } else {
              setHasVotedKnow(false);
              setHasVotedFan(false);
            }

            // Obtener nombre de usuario real de Supabase o auth
            try {
              const { data: dbUser } = await supabase
                .from('users')
                .select('display_name, username, is_anonymous, photo_url')
                .eq('firebase_uid', user.uid)
                .maybeSingle();

              if (dbUser) {
                setUserAvatarUrl(dbUser.photo_url || user.photoURL || null);
                const chosen = (dbUser.username || dbUser.display_name || '').trim();
                if (dbUser.is_anonymous || !chosen || chosen === 'Usuario Anónimo') {
                  setCurrentAuthorName('Anónimo');
                } else {
                  setCurrentAuthorName(chosen);
                }
              } else {
                setUserAvatarUrl(user.photoURL || null);
                if (user.isAnonymous || !user.displayName || user.displayName === 'Usuario Anónimo') {
                  setCurrentAuthorName('Anónimo');
                } else {
                  setCurrentAuthorName(user.displayName);
                }
              }
            } catch (uErr) {
              setCurrentAuthorName(user.displayName || 'Anónimo');
            }
          } else {
            setTodayVotes([]);
            setHasVotedKnow(false);
            setHasVotedFan(false);
            setCurrentAuthorName('Anónimo');
            setUserAvatarUrl(null);
          }
        } else {
          setStudent(null);
        }
      } catch (err) {
        console.error('Error al cargar datos del estudiante e interacciones:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStudentAndInteractions();
  }, [slug, user]);

  // Suscribirse a Supabase Realtime para cambios en los votos, interacciones y crushes del estudiante
  useEffect(() => {
    if (!student) return;

    const studentId = student.id || slug;

    const refreshVotesData = async () => {
      try {
        const updatedStud = await getStudentById(slug);
        if (updatedStud) {
          setStudentScore(updatedStud.score || 0.0);
          setStudentTotalRatings(updatedStud.total_ratings || 0);
        }

        const breakdown = await getStudentRatingBreakdown(studentId);
        setRatingBreakdown(breakdown);

        if (user) {
          const todayV = await getTodayStudentVotes(studentId, user.uid);
          setTodayVotes(todayV);
        }
      } catch (err) {
        console.error('Error al refrescar votos de estudiante en tiempo real:', err);
      }
    };

    const channel = supabase
      .channel(`student-profile-realtime-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_votes'
        },
        (payload) => {
          if (payload.eventType === 'DELETE' || (payload.new && (payload.new as any).student_id === studentId)) {
            refreshVotesData();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_interactions'
        },
        async (payload) => {
          if (payload.eventType === 'DELETE' || (payload.new && (payload.new as any).student_id === studentId)) {
            try {
              const counts = await getStudentInteractionCounts(studentId);
              setKnowCount(counts.knows);
              setFanCount(counts.fan);

              if (user) {
                const userInteraction = await getUserStudentInteraction(studentId, user.uid);
                if (userInteraction) {
                  setHasVotedKnow(userInteraction.interaction_type === 'knows');
                  setHasVotedFan(userInteraction.interaction_type === 'fan');
                } else {
                  setHasVotedKnow(false);
                  setHasVotedFan(false);
                }
              }
            } catch (err) {
              console.error('Error al refrescar interacciones de estudiante en tiempo real:', err);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_crushes'
        },
        async (payload) => {
          if (payload.eventType === 'DELETE' || (payload.new && (payload.new as any).student_id === studentId)) {
            try {
              const crushStatus = await getStudentCrushStatus(studentId, user?.uid || '');
              setCrushCount(crushStatus.count);
              setHasCrushed(crushStatus.hasCrushed);
            } catch (err) {
              console.error('Error al refrescar crushes de estudiante en tiempo real:', err);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_love_messages'
        },
        async (payload) => {
          if (payload.eventType === 'DELETE' || (payload.new && (payload.new as any).student_id === studentId)) {
            try {
              const msgs = await getStudentLoveMessages(studentId, user?.uid);
              setLoveMessages(msgs);
            } catch (err) {
              console.error('Error al refrescar mensajes de amor en tiempo real:', err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [student?.id, slug, user?.uid]);

  const handleToggleLoveMessageHeart = async (messageId: number | string) => {
    if (!user) {
      if (onRequireAuth) onRequireAuth();
      return;
    }

    if (!student) return;
    const studentId = student.id || slug;

    // Actualización optimista inmediata en la UI
    setLoveMessages(prev =>
      prev.map(msg => {
        if (String(msg.id) === String(messageId)) {
          const nextHearted = !msg.has_hearted;
          const prevCount = msg.hearts_count || 0;
          const nextCount = nextHearted ? prevCount + 1 : Math.max(0, prevCount - 1);
          return {
            ...msg,
            has_hearted: nextHearted,
            hearts_count: nextCount
          };
        }
        return msg;
      })
    );

    try {
      const res = await toggleStudentLoveMessageHeart(messageId, user.uid, studentId);
      if (res.success) {
        setLoveMessages(prev =>
          prev.map(msg => {
            if (String(msg.id) === String(messageId)) {
              return {
                ...msg,
                has_hearted: res.hasHearted,
                hearts_count: res.heartsCount
              };
            }
            return msg;
          })
        );
      }
    } catch (err) {
      console.error('Error al reaccionar con corazón:', err);
    }
  };

  const handleToggleCrush = async () => {
    if (!user) {
      if (onRequireAuth) onRequireAuth();
      return;
    }

    if (!student) return;

    const studentId = student.id || slug;
    const previousHasCrushed = hasCrushed;
    const previousCount = crushCount;

    // Actualización optimista en la UI (sumar/restar 1 al instante)
    const nextHasCrushed = !previousHasCrushed;
    const nextCount = nextHasCrushed ? previousCount + 1 : Math.max(0, previousCount - 1);

    setHasCrushed(nextHasCrushed);
    setCrushCount(nextCount);
    setLoadingCrush(true);

    try {
      const studentFullName = student.nombre_completo || `${student.nombre} ${student.apellidos}`;
      const result = await toggleStudentCrush(studentId, user.uid, studentFullName, currentAuthorName);
      setHasCrushed(result.hasCrushed);
      setCrushCount(result.count);
    } catch (err) {
      console.error('Error al alternar voto de crush de estudiante:', err);
      setHasCrushed(previousHasCrushed);
      setCrushCount(previousCount);
    } finally {
      setLoadingCrush(false);
    }
  };

  const handleSendLoveMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      if (onRequireAuth) onRequireAuth();
      return;
    }

    if (!student) return;

    if (!hasCrushed) {
      setLoveMessageError('Debes dar tu flechazo (Crush) primero para poder dejar un mensaje de amor.');
      return;
    }

    const trimmed = loveMessageText.trim();
    if (!trimmed) {
      setLoveMessageError('Por favor, escribe un mensaje de amor antes de publicar.');
      return;
    }

    if (trimmed.length > 500) {
      setLoveMessageError(`El mensaje no puede superar los 500 caracteres (llevas ${trimmed.length}).`);
      return;
    }

    try {
      setSubmittingLoveMessage(true);
      setLoveMessageError(null);

      const studentId = student.id || slug;
      const studentFullName = student.nombre_completo || `${student.nombre} ${student.apellidos}`;
      const res = await createStudentLoveMessage(
        studentId,
        user.uid,
        currentAuthorName,
        userAvatarUrl,
        trimmed,
        studentFullName
      );

      if (res.success) {
        setLoveMessageText('');
        setLoveMessageSuccess(true);
        if (res.data) {
          setLoveMessages(prev => [res.data!, ...prev.filter(m => m.id !== res.data!.id)]);
        }
        setTimeout(() => setLoveMessageSuccess(false), 4000);
      } else {
        setLoveMessageError(res.error || 'No se pudo enviar el mensaje.');
      }
    } catch (err: any) {
      setLoveMessageError(err.message || 'Ocurrió un error al enviar el mensaje.');
    } finally {
      setSubmittingLoveMessage(false);
    }
  };

  const handleDeleteMessage = async (messageId: number | string) => {
    if (!user || !student) return;
    try {
      const studentId = student.id || slug;
      await deleteStudentLoveMessage(messageId, user.uid, studentId);
      setLoveMessages(prev => prev.filter(m => String(m.id) !== String(messageId)));
    } catch (err) {
      console.error('Error al eliminar mensaje:', err);
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
        <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Cargando perfil...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <h3 className="text-xl font-black text-white uppercase">Perfil no encontrado</h3>
        <p className="text-xs text-zinc-400">El miembro solicitado no se encuentra registrado en nuestra base de datos.</p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl bg-[#eab308] text-black font-extrabold text-xs uppercase cursor-pointer"
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

      const studentFullName = student.nombre_completo || `${student.nombre} ${student.apellidos}`;
      const result = await toggleStudentInteraction(studentId, user.uid, type, studentFullName, currentAuthorName);
      if (result && result.success) {
        const counts = await getStudentInteractionCounts(studentId);
        setKnowCount(counts.knows);
        setFanCount(counts.fan);
      }
    } catch (err) {
      console.error('Error al guardar la interacción del estudiante:', err);
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
      console.error('Error al registrar calificación del estudiante:', err);
    } finally {
      setVotingInProgress(false);
    }
  };

  const validateSocialUrl = (url: string, platform: 'Instagram' | 'YouTube' | 'Facebook' | 'Twitter') => {
    if (!url.trim()) return '';
    const lowerUrl = url.toLowerCase();
    if (platform === 'Instagram' && !lowerUrl.includes('instagram.com')) {
      return 'El enlace ingresado no corresponde a Instagram';
    }
    if (platform === 'YouTube' && !lowerUrl.includes('youtube.com') && !lowerUrl.includes('youtu.be')) {
      return 'El enlace ingresado no corresponde a YouTube';
    }
    if (platform === 'Facebook' && !lowerUrl.includes('facebook.com') && !lowerUrl.includes('web.facebook.com')) {
      return 'El enlace ingresado no corresponde a Facebook';
    }
    if (platform === 'Twitter' && !lowerUrl.includes('twitter.com') && !lowerUrl.includes('x.com')) {
      return 'El enlace ingresado no corresponde a Twitter / X';
    }
    return '';
  };

  const enterEditWikiMode = () => {
    if (!user) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    if (!student) return;
    setWikiAvatarUrl(student.avatar_url || '');
    setWikiHeightCm(student.height_cm ? student.height_cm.toString() : '');
    setWikiMaritalStatus(student.marital_status || 'No especificado');
    setWikiGender(student.gender || 'No especificado');
    
    if (student.birth_date) {
      const parts = student.birth_date.split('-');
      setWikiBirthYear(parts[0] || '');
      setWikiBirthMonth(parts[1] || '');
      setWikiBirthDay(parts[2] || '');
    } else {
      setWikiBirthYear('');
      setWikiBirthMonth('');
      setWikiBirthDay('');
    }
    
    setWikiInstagram(student.instagram_url || '');
    setWikiYoutube(student.youtube_url || '');
    setWikiFacebook(student.facebook_url || '');
    setWikiTwitter(student.twitter_url || '');
    setWikiBiography(student.biography || '');
    setSocialErrors({});
    setIsEditingWiki(true);
  };

  const handleSaveWiki = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    const instagramError = validateSocialUrl(wikiInstagram, 'Instagram');
    const youtubeError = validateSocialUrl(wikiYoutube, 'YouTube');
    const facebookError = validateSocialUrl(wikiFacebook, 'Facebook');
    const twitterError = validateSocialUrl(wikiTwitter, 'Twitter');

    if (instagramError || youtubeError || facebookError || twitterError) {
      setSocialErrors({
        instagram: instagramError,
        youtube: youtubeError,
        facebook: facebookError,
        twitter: twitterError
      });
      return;
    }

    try {
      setSavingWiki(true);
      const formattedBirthDate = (wikiBirthYear && wikiBirthMonth && wikiBirthDay)
        ? `${wikiBirthYear}-${wikiBirthMonth}-${wikiBirthDay}`
        : null;

      await updateStudentWiki(student.id, {
        avatar_url: wikiAvatarUrl,
        height_cm: wikiHeightCm ? parseInt(wikiHeightCm) : undefined,
        marital_status: wikiMaritalStatus,
        gender: wikiGender,
        birth_date: formattedBirthDate || undefined,
        instagram_url: wikiInstagram,
        youtube_url: wikiYoutube,
        facebook_url: wikiFacebook,
        twitter_url: wikiTwitter,
        biography: wikiBiography
      });

      setStudent(prev => prev ? {
        ...prev,
        avatar_url: wikiAvatarUrl || undefined,
        height_cm: wikiHeightCm ? parseInt(wikiHeightCm) : undefined,
        marital_status: wikiMaritalStatus,
        gender: wikiGender,
        birth_date: formattedBirthDate || undefined,
        instagram_url: wikiInstagram || undefined,
        youtube_url: wikiYoutube || undefined,
        facebook_url: wikiFacebook || undefined,
        twitter_url: wikiTwitter || undefined,
        biography: wikiBiography || undefined
      } : null);

      setIsEditingWiki(false);
    } catch (err) {
      console.error('Error al guardar la wiki de estudiante:', err);
    } finally {
      setSavingWiki(false);
    }
  };

  const studentFullName = student.nombre_completo || `${student.nombre} ${student.apellidos}`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* Volver y Compartir */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-[#eab308] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Centro</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Botón de Suscripción a Notificaciones */}
          {student && (
            <button
              onClick={() => {
                if (!user) {
                  if (onRequireAuth) onRequireAuth();
                  return;
                }
                setNotificationModalOpen(true);
              }}
              className={`p-3 rounded-full border transition-all cursor-pointer shadow-md flex items-center justify-center ${
                isSubscribedToNotifications
                  ? 'bg-amber-500/15 border-amber-500/50 text-[#eab308] shadow-[0_0_15px_rgba(234,179,8,0.25)] hover:bg-amber-500/25'
                  : 'bg-[#151515] hover:bg-[#202020] border-zinc-800 text-zinc-400 hover:text-[#eab308]'
              }`}
              title={
                isSubscribedToNotifications
                  ? 'Notificaciones activadas (clic para gestionar)'
                  : 'Suscribirse a alertas y notificaciones de este estudiante'
              }
            >
              {isSubscribedToNotifications ? (
                <BellRing className="w-4 h-4 text-[#eab308]" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </button>
          )}

          {student && (
            <BookmarkButton
              itemId={student.id || slug}
              itemType="student"
              itemName={studentFullName}
              itemImage={student.avatar_url || null}
              itemSubtitle="Estudiante"
              onRequireAuth={onRequireAuth}
            />
          )}

          <button
            onClick={handleShare}
            className="p-3 rounded-full bg-[#151515] hover:bg-[#202020] border border-zinc-800 text-zinc-400 hover:text-[#eab308] transition-all cursor-pointer shadow-md"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {copied && (
        <p className="text-right text-xs text-[#eab308] font-bold tracking-wide animate-pulse">
          ✓ ¡Enlace copiado al portapapeles!
        </p>
      )}

      {/* SECCIÓN DEL AVATAR CON EL RATING RING (Diseño idéntico a imagen) */}
      <div className="flex flex-col items-center text-center space-y-4 py-4 relative">
        {/* Badge de Visualizaciones en la esquina superior derecha según solicitud */}
        <div 
          onClick={() => setActiveTab('Estadística')}
          title="Visualizaciones totales del perfil (Clic para ver tendencias)"
          className="absolute top-0 right-0 sm:right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#12131a] border border-zinc-800 hover:border-purple-500/50 hover:bg-purple-500/10 text-zinc-300 hover:text-purple-300 transition-all cursor-pointer shadow-lg group select-none"
        >
          <Eye className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-black tracking-tight text-white group-hover:text-purple-200">
            {viewsCount.toLocaleString()}
          </span>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider hidden sm:inline">
            vistas
          </span>
        </div>

        <div className="relative">
          {/* Avatar circular */}
          <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-zinc-800 bg-[#181818] shadow-2xl flex items-center justify-center">
            {student.avatar_url ? (
              <img
                src={student.avatar_url}
                alt={studentFullName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-black text-4xl uppercase">
                {student.nombre ? student.nombre.charAt(0) : 'E'}
              </div>
            )}
          </div>
          {/* Rating badge en la parte inferior derecha del avatar */}
          <div className="absolute -bottom-1 right-2 bg-[#eab308] text-black font-black text-xs px-2 py-1 rounded-full shadow-lg border border-black flex items-center gap-0.5">
            <span>{studentScore.toFixed(1)}</span>
          </div>
        </div>

        {/* Nombre completo */}
        <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight uppercase tracking-tight">
          {studentFullName}
        </h1>
        <p className="px-3 py-1 rounded-full bg-[#181818] border border-zinc-800 text-zinc-400 text-[10px] uppercase font-bold tracking-widest">
          ESTUDIANTE
        </p>
      </div>

      {/* METRIC CARDS (Yo te conozco / Fan - Diseñados en grilla de 2 columnas) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Yo te conozco */}
        <div 
          onClick={() => handleInteractionToggle('knows')}
          className={`bg-[#0d0d0d] border rounded-2xl p-6 text-center transition-all cursor-pointer select-none active:scale-[0.98] duration-200 ${
            hasVotedKnow 
              ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
              : 'border-zinc-800/80 hover:border-blue-500/40 hover:bg-[#121212]'
          }`}
        >
          <div className="flex justify-center mb-1">
            <Users className={`w-6 h-6 transition-transform text-blue-400 ${hasVotedKnow ? 'scale-110 text-blue-400' : 'text-blue-400/80'}`} />
          </div>
          <span className="block text-2xl font-black text-white tracking-tight">
            {knowCount}
          </span>
          <span className={`block text-[10px] uppercase font-extrabold tracking-widest mt-1 transition-colors ${hasVotedKnow ? 'text-blue-400' : 'text-zinc-400'}`}>
            {hasVotedKnow ? '✓ Yo te conozco' : 'Yo te conozco'}
          </span>
        </div>

        {/* Fan */}
        <div 
          onClick={() => handleInteractionToggle('fan')}
          className={`bg-[#0d0d0d] border rounded-2xl p-6 text-center transition-all cursor-pointer select-none active:scale-[0.98] duration-200 ${
            hasVotedFan 
              ? 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
              : 'border-zinc-800/80 hover:border-red-500/40 hover:bg-[#121212]'
          }`}
        >
          <div className="flex justify-center mb-1">
            <Heart className={`w-6 h-6 transition-transform text-red-500 ${hasVotedFan ? 'fill-red-500 scale-110' : 'fill-red-500/20'}`} />
          </div>
          <span className="block text-2xl font-black text-white tracking-tight">
            {fanCount}
          </span>
          <span className={`block text-[10px] uppercase font-extrabold tracking-widest mt-1 transition-colors ${hasVotedFan ? 'text-red-500' : 'text-zinc-400'}`}>
            {hasVotedFan ? '✓ Fan' : 'Fan'}
          </span>
        </div>
      </div>

      {/* PESTAÑAS (Wiki, Reseñas, Crushes, Ship, Estadística - idéntico a Profesores) */}
      <div className="bg-[#0d0d0d] border border-zinc-800/80 rounded-xl p-1 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 min-w-max">
          {[
            { id: 'Wiki' as TabType, label: 'Wiki', icon: BookOpen, color: '#3b82f6' },
            { id: 'Reseñas' as TabType, label: 'Reseñas', icon: Star, color: '#eab308' },
            { id: 'Crushes' as TabType, label: 'Crushes', icon: Heart, color: '#f43f5e' },
            { id: 'Ship' as TabType, label: 'Ship', icon: Sparkles, color: '#a855f7' },
            { id: 'Estadística' as TabType, label: 'Estadística', icon: BarChart3, color: '#06b6d4' }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isCrushes = tab.id === 'Crushes';

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`relative py-3.5 px-4 sm:px-5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 select-none ${
                  isActive
                    ? 'bg-[#14151d] text-white border border-zinc-800/60 font-black shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-[#151515] border border-transparent'
                }`}
              >
                <Icon 
                  className={`w-4 h-4 flex-shrink-0 transition-transform hover:scale-110`} 
                  style={{ color: tab.color }}
                  fill={isCrushes && hasCrushed ? tab.color : 'none'}
                />
                <span className={isActive ? 'inline' : 'hidden sm:inline'}>{tab.label}</span>

                {/* Línea inferior brillante cuando el elemento está activo */}
                {isActive && (
                  <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#eab308] rounded-full shadow-[0_0_8px_#eab308]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* RENDERIZADO DE CONTENIDOS SEGÚN LA PESTAÑA SELECCIONADA */}

      {/* 1. PESTAÑA RESEÑAS */}
      {activeTab === 'Reseñas' && (() => {
        const totalVotesCount = Object.values(ratingBreakdown).reduce((a, b) => a + b, 0);

        return (
          <div className="space-y-6">
            <div className="bg-[#0d0d0d] border border-zinc-800/40 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white uppercase tracking-wide">
                  Resumen de Estrellas
                </h2>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                  opportunitiesLeft === 0
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20'
                }`}>
                  OPORTUNIDADES: {opportunitiesLeft}/6
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Bloque Izquierdo con el puntaje general promedio */}
                <div className="bg-[#050505] border border-zinc-800/20 rounded-2xl p-6 text-center w-full md:w-48 space-y-3">
                  <span className="block text-5xl font-black text-[#eab308] tracking-tighter">
                    {studentScore.toFixed(1)}
                  </span>
                  
                  {/* Estrellas visuales */}
                  <div className="flex items-center justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={`w-5 h-5 ${
                          star <= Math.round(studentScore)
                            ? 'fill-[#eab308] text-[#eab308]' 
                            : 'text-zinc-700'
                        }`} 
                      />
                    ))}
                  </div>

                  <span className="block text-[10px] uppercase text-zinc-500 font-extrabold tracking-widest">
                    {studentTotalRatings} VOTOS TOTALES
                  </span>
                </div>

                {/* Distribución de Estrellas (Progress Bars) */}
                <div className="flex-1 w-full space-y-2.5">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = ratingBreakdown[stars] || 0;
                    const percent = totalVotesCount > 0 ? `${((count / totalVotesCount) * 100).toFixed(0)}%` : '0%';

                    return (
                      <div key={stars} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-zinc-400 w-3 text-right">
                          {stars}
                        </span>
                        <div className="flex-1 h-2 bg-[#121212] rounded-full overflow-hidden border border-zinc-800/40">
                          <div 
                            className="h-full bg-[#eab308] transition-all duration-500" 
                            style={{ width: percent }}
                          />
                        </div>
                        <span className="text-xs font-bold text-zinc-500 w-4 text-right">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Formulario rápido para dejar reseña */}
              <div className="pt-4 border-t border-zinc-800/40 space-y-3">
                <p className="text-xs font-bold uppercase text-zinc-400 tracking-wider text-center">
                  ¿Conoces a {student.nombre}? ¡Deja tu calificación de estrellas!
                </p>

                {opportunitiesLeft === 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 opacity-30 select-none">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <div
                          key={star}
                          className="p-2 bg-[#121212] border border-zinc-800 rounded-lg text-zinc-700"
                        >
                          <Star className="w-6 h-6" />
                        </div>
                      ))}
                    </div>
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-center">
                      <p className="text-rose-400 text-xs font-black uppercase tracking-wider">
                        ¡VUELVE MAÑANA PARA MÁS VOTOS!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        disabled={votingInProgress}
                        onClick={() => handleStarVote(star)}
                        className="p-2 bg-[#121212] hover:bg-[#eab308]/10 border border-zinc-800 rounded-lg text-zinc-500 hover:text-[#eab308] transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Star className="w-6 h-6 hover:scale-110 active:scale-95 transition-transform" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sección "TUS VOTOS DE HOY" */}
              {todayVotes.length > 0 && (
                <div className="pt-4 border-t border-zinc-800/40 space-y-2">
                  <span className="block text-xs font-bold uppercase text-zinc-500 tracking-wider text-center">
                    Tus votos de hoy para este estudiante:
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {todayVotes.map((v, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center gap-1.5 bg-[#121212] border border-zinc-800/60 rounded-full px-3 py-1.5 text-xs text-zinc-300 font-extrabold shadow-sm animate-in fade-in zoom-in duration-300"
                      >
                        <Star className="w-3.5 h-3.5 fill-[#eab308] text-[#eab308]" />
                        <span>{v} {v === 1 ? 'Estrella' : 'Estrellas'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 2. WIKI TAB */}
      {activeTab === 'Wiki' && (() => {
        const getMaxDays = (yearStr: string, monthStr: string) => {
          const year = parseInt(yearStr) || 2000;
          const month = parseInt(monthStr) || 1;
          return new Date(year, month, 0).getDate();
        };

        return (
          <div className="bg-[#0d0d0d] border border-zinc-800/40 rounded-2xl p-6 space-y-6">
            {!isEditingWiki ? (
              // VIEW WIKI MODE
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-800/40 pb-4">
                  <h2 className="text-xl font-black text-white uppercase tracking-wide flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#eab308]" />
                    <span>Biografía y Trayectoria</span>
                  </h2>
                  <button
                    onClick={enterEditWikiMode}
                    className="px-4.5 py-2 bg-[#eab308] text-black text-xs font-black uppercase tracking-wider rounded-lg hover:bg-[#eab308]/90 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Editar Wiki</span>
                  </button>
                </div>

                {/* Biography content */}
                {student.biography && (
                  <div className="space-y-3">
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {student.biography}
                    </p>
                  </div>
                )}

                {/* Personal Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-800/40">
                  <div className="bg-[#050505] p-4 rounded-xl border border-zinc-800/20 space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Altura</span>
                    <span className="text-sm font-bold text-white block">
                      {student.height_cm ? `${student.height_cm} cm` : 'No especificada'}
                    </span>
                  </div>

                  <div className="bg-[#050505] p-4 rounded-xl border border-zinc-800/20 space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Estado Civil</span>
                    <span className="text-sm font-bold text-white block">
                      {student.marital_status || 'No especificado'}
                    </span>
                  </div>

                  <div className="bg-[#050505] p-4 rounded-xl border border-zinc-800/20 space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Sexo</span>
                    <span className="text-sm font-bold text-white block">
                      {student.gender || 'No especificado'}
                    </span>
                  </div>

                  <div className="bg-[#050505] p-4 rounded-xl border border-zinc-800/20 space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Fecha de Nacimiento</span>
                    <span className="text-sm font-bold text-white block">
                      {student.birth_date ? (() => {
                        const dateObj = new Date(student.birth_date + 'T00:00:00');
                        return dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
                      })() : 'No especificada'}
                    </span>
                  </div>

                  {student.birth_date && (
                    <div className="bg-[#050505] p-4 rounded-xl border border-zinc-800/20 space-y-1">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Edad</span>
                      <span className="text-sm font-bold text-white block">
                        {(() => {
                          const birthDate = new Date(student.birth_date + 'T00:00:00');
                          const today = new Date();
                          let age = today.getFullYear() - birthDate.getFullYear();
                          const m = today.getMonth() - birthDate.getMonth();
                          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                            age--;
                          }
                          return `${age} años`;
                        })()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Social Media Links if present */}
                {(student.instagram_url || student.youtube_url || student.facebook_url || student.twitter_url) && (
                  <div className="pt-4 border-t border-zinc-800/40 space-y-3">
                    <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Redes Sociales Oficiales</h3>
                    <div className="flex flex-wrap gap-3">
                      {student.instagram_url && (
                        <a
                          href={student.instagram_url.startsWith('http') ? student.instagram_url : `https://${student.instagram_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-[#121212] border border-zinc-800 hover:border-pink-500/50 hover:text-pink-500 px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 transition-all cursor-pointer"
                        >
                          <Heart className="w-4 h-4 fill-current text-pink-500" />
                          <span>Instagram</span>
                        </a>
                      )}
                      {student.youtube_url && (
                        <a
                          href={student.youtube_url.startsWith('http') ? student.youtube_url : `https://${student.youtube_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-[#121212] border border-zinc-800 hover:border-red-500/50 hover:text-red-500 px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 transition-all cursor-pointer"
                        >
                          <Award className="w-4 h-4 text-red-500" />
                          <span>YouTube</span>
                        </a>
                      )}
                      {student.facebook_url && (
                        <a
                          href={student.facebook_url.startsWith('http') ? student.facebook_url : `https://${student.facebook_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-[#121212] border border-zinc-800 hover:border-blue-500/50 hover:text-blue-500 px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 transition-all cursor-pointer"
                        >
                          <Users className="w-4 h-4 text-blue-500" />
                          <span>Facebook</span>
                        </a>
                      )}
                      {student.twitter_url && (
                        <a
                          href={student.twitter_url.startsWith('http') ? student.twitter_url : `https://${student.twitter_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-[#121212] border border-zinc-800 hover:border-[#1da1f2]/50 hover:text-[#1da1f2] px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 transition-all cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-[#1da1f2]" />
                          <span>Twitter / X</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Created At footer info */}
                <div className="p-4 bg-[#050505] rounded-xl border border-zinc-800/20 text-xs text-zinc-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#eab308]" />
                  <span>
                    Miembro registrado el{' '}
                    {new Date(student.created_at || '').toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            ) : (
              // EDIT WIKI MODE
              <form onSubmit={handleSaveWiki} className="space-y-6">
                <div className="border-b border-zinc-800/40 pb-4">
                  <h2 className="text-xl font-black text-white uppercase tracking-wide">
                    Editar Perfil Wiki
                  </h2>
                </div>

                {/* Foto de perfil input */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Foto de Perfil (URL Directa)
                  </label>
                  <input
                    type="text"
                    placeholder="https://ejemplo.com/imagen.jpg"
                    value={wikiAvatarUrl}
                    onChange={(e) => setWikiAvatarUrl(e.target.value)}
                    className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white font-medium outline-none transition-all placeholder:text-zinc-600"
                  />
                </div>

                {/* Altura, Estado Civil, Sexo Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Altura */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Altura
                    </label>
                    <select
                      value={wikiHeightCm}
                      onChange={(e) => setWikiHeightCm(e.target.value)}
                      className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all cursor-pointer"
                    >
                      <option value="">Selecciona una altura</option>
                      {Array.from({ length: 61 }, (_, i) => 140 + i).map((h) => (
                        <option key={h} value={h.toString()}>
                          {h} cm
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Estado Civil */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Estado Civil
                    </label>
                    <select
                      value={wikiMaritalStatus}
                      onChange={(e) => setWikiMaritalStatus(e.target.value)}
                      className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all cursor-pointer"
                    >
                      <option value="No especificado">No especificado</option>
                      <option value="Soltero/a">Soltero/a</option>
                      <option value="Con novio/a">Con novio/a</option>
                      <option value="Casado/a">Casado/a</option>
                    </select>
                  </div>

                  {/* Sexo */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Sexo
                    </label>
                    <select
                      value={wikiGender}
                      onChange={(e) => setWikiGender(e.target.value)}
                      className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all cursor-pointer"
                    >
                      <option value="No especificado">No especificado</option>
                      <option value="HOMBRE">HOMBRE</option>
                      <option value="MUJER">MUJER</option>
                    </select>
                  </div>
                </div>

                {/* Fecha de Nacimiento (Año -> Mes -> Día) */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Fecha de Nacimiento
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Año */}
                    <select
                      value={wikiBirthYear}
                      onChange={(e) => {
                        setWikiBirthYear(e.target.value);
                        setWikiBirthDay('');
                      }}
                      className="bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-3 py-3 text-sm text-white outline-none transition-all cursor-pointer"
                    >
                      <option value="">Año</option>
                      {Array.from({ length: 2026 - 1950 + 1 }, (_, i) => 2026 - i).map((y) => (
                        <option key={y} value={y.toString()}>
                          {y}
                        </option>
                      ))}
                    </select>

                    {/* Mes */}
                    <select
                      value={wikiBirthMonth}
                      onChange={(e) => {
                        setWikiBirthMonth(e.target.value);
                        setWikiBirthDay('');
                      }}
                      className="bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-3 py-3 text-sm text-white outline-none transition-all cursor-pointer"
                    >
                      <option value="">Mes</option>
                      {[
                        { value: '01', label: 'Enero' },
                        { value: '02', label: 'Febrero' },
                        { value: '03', label: 'Marzo' },
                        { value: '04', label: 'Abril' },
                        { value: '05', label: 'Mayo' },
                        { value: '06', label: 'Junio' },
                        { value: '07', label: 'Julio' },
                        { value: '08', label: 'Agosto' },
                        { value: '09', label: 'Septiembre' },
                        { value: '10', label: 'Octubre' },
                        { value: '11', label: 'Noviembre' },
                        { value: '12', label: 'Diciembre' }
                      ].map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>

                    {/* Día */}
                    <select
                      value={wikiBirthDay}
                      onChange={(e) => setWikiBirthDay(e.target.value)}
                      className="bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-3 py-3 text-sm text-white outline-none transition-all cursor-pointer"
                    >
                      <option value="">Día</option>
                      {wikiBirthYear && wikiBirthMonth ? (
                        Array.from({ length: getMaxDays(wikiBirthYear, wikiBirthMonth) }, (_, i) => {
                          const dNum = i + 1;
                          const dStr = dNum < 10 ? `0${dNum}` : dNum.toString();
                          return (
                            <option key={dStr} value={dStr}>
                              {dNum}
                            </option>
                          );
                        })
                      ) : (
                        Array.from({ length: 31 }, (_, i) => {
                          const dNum = i + 1;
                          const dStr = dNum < 10 ? `0${dNum}` : dNum.toString();
                          return (
                            <option key={dStr} value={dStr}>
                              {dNum}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>
                </div>

                {/* Redes Sociales Fields */}
                <div className="space-y-4 pt-4 border-t border-zinc-800/40">
                  <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Redes Sociales</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Instagram */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        Instagram
                      </label>
                      <input
                        type="text"
                        placeholder="https://instagram.com/nombre"
                        value={wikiInstagram}
                        onChange={(e) => {
                          setWikiInstagram(e.target.value);
                          setSocialErrors(prev => ({ ...prev, instagram: '' }));
                        }}
                        className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-zinc-600"
                      />
                      {socialErrors.instagram && (
                        <p className="text-rose-500 text-[11px] font-bold tracking-wide mt-1">
                          {socialErrors.instagram}
                        </p>
                      )}
                    </div>

                    {/* YouTube */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        YouTube
                      </label>
                      <input
                        type="text"
                        placeholder="https://youtube.com/nombre"
                        value={wikiYoutube}
                        onChange={(e) => {
                          setWikiYoutube(e.target.value);
                          setSocialErrors(prev => ({ ...prev, youtube: '' }));
                        }}
                        className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-zinc-600"
                      />
                      {socialErrors.youtube && (
                        <p className="text-rose-500 text-[11px] font-bold tracking-wide mt-1">
                          {socialErrors.youtube}
                        </p>
                      )}
                    </div>

                    {/* Facebook */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        Facebook
                      </label>
                      <input
                        type="text"
                        placeholder="https://facebook.com/nombre"
                        value={wikiFacebook}
                        onChange={(e) => {
                          setWikiFacebook(e.target.value);
                          setSocialErrors(prev => ({ ...prev, facebook: '' }));
                        }}
                        className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-zinc-600"
                      />
                      {socialErrors.facebook && (
                        <p className="text-rose-500 text-[11px] font-bold tracking-wide mt-1">
                          {socialErrors.facebook}
                        </p>
                      )}
                    </div>

                    {/* Twitter / X */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        Twitter / X
                      </label>
                      <input
                        type="text"
                        placeholder="https://twitter.com/nombre"
                        value={wikiTwitter}
                        onChange={(e) => {
                          setWikiTwitter(e.target.value);
                          setSocialErrors(prev => ({ ...prev, twitter: '' }));
                        }}
                        className="w-full bg-[#121212] border border-zinc-800 focus:border-[#eab308] rounded-xl px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-zinc-600"
                      />
                      {socialErrors.twitter && (
                        <p className="text-rose-500 text-[11px] font-bold tracking-wide mt-1">
                          {socialErrors.twitter}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Save / Cancel actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-zinc-800/40">
                  <button
                    type="button"
                    disabled={savingWiki}
                    onClick={() => setIsEditingWiki(false)}
                    className="flex-1 py-3 bg-[#121212] hover:bg-[#181818] border border-zinc-800 rounded-xl text-xs font-black uppercase tracking-wider text-zinc-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingWiki}
                    className="flex-1 py-3 bg-[#eab308] hover:bg-[#eab308]/90 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingWiki ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <span>Guardar Cambios</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        );
      })()}

      {/* 3. CRUSHES TAB */}
      {activeTab === 'Crushes' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Tarjeta Principal de Flechazos */}
          <div className="bg-[#0d0d0d] border border-zinc-800/80 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="text-center max-w-md mx-auto space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-[10px] font-black uppercase tracking-widest">
                <Sparkles className="w-3 h-3" />
                <span>Flechazos del Campus</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                ¿Es tu Crush en el Campus?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Los flechazos son 100% confidenciales y anónimos. Nadie sabrá tu identidad, pero sumarás popularidad al perfil.
              </p>
            </div>

            {/* Botón Destacado de Flechazo / Crush */}
            <div className="flex flex-col items-center justify-center py-4 space-y-4">
              <button
                type="button"
                onClick={handleToggleCrush}
                disabled={loadingCrush}
                className={`group relative p-6 sm:p-8 rounded-full border-2 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center shadow-2xl active:scale-95 ${
                  hasCrushed
                    ? 'bg-gradient-to-b from-pink-500/20 to-rose-600/30 border-pink-500 text-pink-400 shadow-[0_0_40px_rgba(236,72,153,0.45)] ring-4 ring-pink-500/20 scale-105'
                    : 'bg-[#141414] hover:bg-[#1c1c1c] border-zinc-800 hover:border-pink-500/50 text-zinc-400 hover:text-pink-400 hover:shadow-[0_0_25px_rgba(236,72,153,0.2)]'
                }`}
                title={hasCrushed ? 'Retirar flechazo' : 'Dar flechazo'}
              >
                {loadingCrush ? (
                  <Loader2 className="w-16 h-16 sm:w-20 sm:h-20 animate-spin text-pink-500" />
                ) : (
                  <Heart
                    className={`w-16 h-16 sm:w-20 sm:h-20 transition-transform duration-300 group-hover:scale-110 ${
                      hasCrushed ? 'fill-pink-500 text-pink-500 animate-pulse' : 'stroke-[1.5]'
                    }`}
                  />
                )}
              </button>

              {/* Contador de Flechazos */}
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <span className={`text-4xl sm:text-5xl font-black tracking-tight ${hasCrushed ? 'text-pink-400' : 'text-white'}`}>
                    {crushCount}
                  </span>
                </div>
                <span className="block text-xs font-black uppercase tracking-widest text-zinc-500">
                  {crushCount === 1 ? 'Flechazo Recibido' : 'Flechazos Recibidos'}
                </span>
              </div>

              {/* Estado o Feedback */}
              <div className="text-center max-w-xs">
                {hasCrushed ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-950/40 border border-pink-800/40 text-pink-300 text-xs font-bold animate-in fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5 text-pink-400" />
                    <span>¡Ya diste tu flechazo anónimo!</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-zinc-500 font-medium">
                    Toca el corazón para enviar tu flechazo anónimo
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* SECCIÓN INFERIOR: MENSAJES DE AMOR (SOLO ACTIVO AL VOTAR EN CRUSH, MÍNIMO 500 CARACTERES) */}
          <div className="bg-[#0d0d0d] border border-zinc-800/80 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-pink-400 fill-pink-500/20" />
                  <h4 className="text-lg font-black text-white uppercase tracking-wide">
                    Mensajes de Amor
                  </h4>
                </div>
                <p className="text-xs text-zinc-400">
                  Escribe una declaración sincera o palabras especiales para este estudiante.
                </p>
              </div>

              {/* Distintivo de Autor / Nombre de Usuario */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#141414] border border-zinc-800 rounded-xl text-xs">
                <Users className="w-3.5 h-3.5 text-pink-400" />
                <span className="text-zinc-400">Publicarás como:</span>
                <span className="font-bold text-pink-300">
                  {currentAuthorName}
                </span>
              </div>
            </div>

            {/* Condición de Activación: Solo si votó en Crush */}
            {hasCrushed ? (
              <form onSubmit={handleSendLoveMessage} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                      <span>Tu Declaración de Amor</span>
                      <span className="text-[10px] text-pink-400 bg-pink-950/50 border border-pink-800/40 px-2 py-0.5 rounded-md font-bold">
                        Máximo 500 caracteres
                      </span>
                    </label>

                    {/* Contador en vivo */}
                    <div className="text-xs font-bold">
                      {loveMessageText.length > 500 ? (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {loveMessageText.length} / 500 (excede por {loveMessageText.length - 500})
                        </span>
                      ) : (
                        <span className="text-zinc-400 flex items-center gap-1">
                          <span className="text-pink-300 font-bold">{loveMessageText.length}</span> / 500
                          <span className="text-zinc-500 text-[10px] font-normal">({500 - loveMessageText.length} disponibles)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Barra de progreso de caracteres */}
                  <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden border border-zinc-800/60">
                    <div
                      className={`h-full transition-all duration-200 ${
                        loveMessageText.length > 500
                          ? 'bg-rose-500'
                          : loveMessageText.length > 450
                          ? 'bg-amber-400'
                          : 'bg-gradient-to-r from-pink-500 to-rose-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (loveMessageText.length / 500) * 100)}%`
                      }}
                    />
                  </div>

                  <textarea
                    rows={5}
                    maxLength={500}
                    value={loveMessageText}
                    onChange={(e) => setLoveMessageText(e.target.value)}
                    placeholder="Escribe aquí tu mensaje de amor, confesión o dedicatoria especial para este estudiante (máximo 500 caracteres)..."
                    className="w-full bg-[#121212] border border-zinc-800 focus:border-pink-500 focus:ring-1 focus:ring-pink-500/30 rounded-xl p-4 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all resize-y leading-relaxed"
                  />
                </div>

                {loveMessageError && (
                  <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{loveMessageError}</span>
                  </div>
                )}

                {loveMessageSuccess && (
                  <div className="p-3.5 rounded-xl bg-pink-950/40 border border-pink-800/50 text-pink-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0" />
                    <span>¡Tu mensaje de amor fue publicado con éxito en el muro!</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <p className="text-[11px] text-zinc-500">
                    {currentAuthorName === 'Anónimo'
                      ? '🔒 Aparecerás como usuario "Anónimo" en el mensaje.'
                      : `👤 Se mostrará tu nombre de usuario: "${currentAuthorName}".`}
                  </p>

                  <button
                    type="submit"
                    disabled={!loveMessageText.trim() || loveMessageText.length > 500 || submittingLoveMessage}
                    className={`py-3 px-6 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                      loveMessageText.trim() && loveMessageText.length <= 500 && !submittingLoveMessage
                        ? 'bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-pink-500/20 active:scale-95'
                        : 'bg-zinc-800/60 text-zinc-500 cursor-not-allowed border border-zinc-800'
                    }`}
                  >
                    {submittingLoveMessage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Publicando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Publicar Mensaje de Amor</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* ESTADO BLOQUEADO: Si no ha votado en Crush */
              <div className="p-6 rounded-xl bg-[#121212]/80 border border-pink-900/20 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mx-auto text-pink-400">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h5 className="text-sm font-black text-white uppercase tracking-wide">
                    Mensaje de Amor Bloqueado
                  </h5>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    La opción de dejar un mensaje de amor solo se activa cuando votas en <strong>Crush</strong>. Toca el corazón de arriba para dar tu flechazo y desbloquear el formulario.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleCrush}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-pink-300 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  <Heart className="w-4 h-4 fill-pink-500 text-pink-500" />
                  <span>Dar Flechazo Ahora</span>
                </button>
              </div>
            )}

            {/* LISTA DE MENSAJES DE AMOR PUBLICADOS */}
            <div className="pt-6 border-t border-zinc-800/60 space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-black text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-pink-400" />
                  <span>Confesiones Publicadas ({loveMessages.length})</span>
                </h5>
              </div>

              {loveMessages.length === 0 ? (
                <div className="py-10 text-center space-y-2 bg-[#121212]/40 rounded-xl border border-zinc-800/40">
                  <Heart className="w-8 h-8 text-zinc-700 mx-auto" />
                  <p className="text-xs text-zinc-500">
                    Aún no hay mensajes de amor para este estudiante. ¡Sé la primera persona en confesar lo que sientes!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {loveMessages.map((msg) => {
                    const isOwnMessage = user && user.uid === msg.user_uid;
                    const dateFormatted = new Date(msg.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div
                        key={msg.id}
                        className="bg-[#121212] border border-zinc-800/80 hover:border-pink-500/30 rounded-xl p-5 space-y-3 transition-all relative overflow-hidden group"
                      >
                        {/* Cabecera del Mensaje */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-600 to-rose-400 flex items-center justify-center text-white font-black text-sm shadow-md">
                              {msg.author_avatar ? (
                                <img
                                  src={msg.author_avatar}
                                  alt={msg.author_name}
                                  className="w-full h-full object-cover rounded-full"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span>{msg.author_name.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">
                                  {msg.author_name}
                                </span>
                                {msg.author_name === 'Anónimo' && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-bold text-zinc-400 uppercase">
                                    Confidencial
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-[#eab308]" />
                                {dateFormatted}
                              </span>
                            </div>
                          </div>

                          {/* Opciones (Eliminar si es el autor) */}
                          {isOwnMessage && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="text-zinc-600 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-950/30 transition-all cursor-pointer"
                              title="Eliminar mi mensaje"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Cuerpo del Mensaje */}
                        <div className="relative pl-3 border-l-2 border-pink-500/40">
                          <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-line font-normal">
                            {msg.message}
                          </p>
                        </div>

                        {/* Pie con botón interactivo de dejar corazón (like) y conteo */}
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40">
                          {/* Botón de Dejar Corazón */}
                          <button
                            type="button"
                            onClick={() => handleToggleLoveMessageHeart(msg.id)}
                            className={`group/heart inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
                              msg.has_hearted
                                ? 'bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/50 shadow-[0_0_14px_rgba(236,72,153,0.3)]'
                                : 'bg-[#181818] hover:bg-[#222222] text-zinc-400 hover:text-pink-400 border border-zinc-800 hover:border-pink-500/30'
                            }`}
                            title={msg.has_hearted ? 'Quitar mi corazón' : 'Dejar corazón a este mensaje'}
                          >
                            <Heart
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                msg.has_hearted
                                  ? 'fill-pink-500 text-pink-500 scale-110'
                                  : 'stroke-[2] group-hover/heart:scale-115 group-hover/heart:text-pink-400'
                              }`}
                            />
                            <span className={msg.has_hearted ? 'text-pink-300 font-extrabold' : 'text-zinc-300 font-semibold'}>
                              {msg.hearts_count || 0}
                            </span>
                            <span className="text-[10px] font-normal text-zinc-500 ml-0.5">
                              {(msg.hearts_count || 0) === 1 ? 'corazón' : 'corazones'}
                            </span>
                          </button>

                          <span className="text-[10px] text-zinc-500">
                            {msg.message.length} / 500 caracteres
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. SHIP TAB */}
      {activeTab === 'Ship' && (
        <div className="bg-[#0d0d0d] border border-zinc-800/40 rounded-2xl p-8 text-center text-zinc-500 space-y-3">
          <Sparkles className="w-10 h-10 text-[#eab308] mx-auto animate-bounce" />
          <h3 className="text-base font-bold text-white uppercase">Emparejamientos del Campus (Ship)</h3>
          <p className="text-xs max-w-sm mx-auto">
            Vota por las parejas más votadas y divertidas del centro educativo creadas por la propia comunidad estudiantil.
          </p>
        </div>
      )}

      {/* 5. ESTADÍSTICA TAB: Starryz Trends Engine v2.0 */}
      {activeTab === 'Estadística' && (
        <StudentTrendsEngine
          studentId={student?.id || slug}
          studentName={studentFullName}
          currentValues={{
            knowsCount: knowCount,
            fansCount: fanCount,
            crushesCount: crushCount,
            score: studentScore,
            viewsCount: viewsCount,
          }}
        />
      )}

      {/* Modal de Suscripción a Notificaciones */}
      {student && user && (
        <StudentNotificationModal
          isOpen={notificationModalOpen}
          onClose={() => setNotificationModalOpen(false)}
          studentId={student.id || slug}
          studentName={studentFullName}
          studentAvatar={student.avatar_url || null}
          userUid={user.uid}
          onSubscriptionChange={(subscribed) => setIsSubscribedToNotifications(subscribed)}
        />
      )}

    </div>
  );
}
