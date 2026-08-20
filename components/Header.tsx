'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  UserPlus, 
  Star, 
  Menu, 
  X, 
  LogOut, 
  GraduationCap, 
  UserCheck, 
  Building2, 
  BookOpen,
  Settings,
  Sun,
  Moon,
  Palette,
  Bell,
  Smartphone,
  Download,
  Heart,
  MessageSquare,
  Eye,
  MoreVertical,
  ExternalLink,
  Share2
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import AutocompleteSearchBar from './AutocompleteSearchBar';
import { SearchSuggestion } from '@/src/lib/search';
import { supabase } from '@/src/lib/supabase';

interface NotificationItem {
  id: string;
  user_uid: string;
  title: string;
  body: string;
  link_url?: string;
  is_read: boolean;
  created_at: string;
}

interface HeaderProps {
  searchQuery?: string;
  onSearch?: (query: string) => void;
  onNavigate?: (url: string) => void;
  onOpenInstallModal: () => void;
  onOpenJoinModal: () => void;
  onGoToProfile?: () => void;
  onGoToHome?: () => void;
  onOpenCreateCenterModal?: () => void;
}

export default function Header({ 
  searchQuery = '',
  onSearch,
  onNavigate,
  onOpenInstallModal, 
  onOpenJoinModal, 
  onGoToProfile,
  onGoToHome,
  onOpenCreateCenterModal
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { theme, toggleTheme, setTheme } = useTheme();

  // Lógica de PWA (deferredPrompt y comprobación de instalabilidad)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPwaInstallable, setIsPwaInstallable] = useState(false);

  // Lógica de Notificaciones In-App
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNotificationsOpen, setMobileNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const mobileNotificationsRef = useRef<HTMLDivElement>(null);

  // States for Notification Detail Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalConfession, setModalConfession] = useState<any>(null);
  const [modalCenterInfo, setModalCenterInfo] = useState<{ id?: string; name?: string; type?: string } | null>(null);
  const [modalComments, setModalComments] = useState<any[]>([]);
  const [targetCommentId, setTargetCommentId] = useState<string | null>(null);
  const [modalReactionsCount, setModalReactionsCount] = useState<number>(0);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_uid', user.uid)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error al obtener notificaciones:', err);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    fetchNotifications();

    const channel = supabase
      .channel('realtime_notifications')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_uid=eq.${user.uid}` 
        }, 
        (payload) => {
          const newNotif = payload.new as NotificationItem;
          
          // Reproducir sonido de notificación en vivo
          try {
            const audio = new Audio('/sonidos/noti.mp3');
            audio.play().catch(e => console.log('Audio playback blocked or failed:', e));
          } catch (audioErr) {
            console.error('Error al reproducir el sonido de notificación:', audioErr);
          }

          setNotifications((prev) => {
            if (prev.some(n => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.uid]);

  // Cerrar notificaciones al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (mobileNotificationsRef.current && !mobileNotificationsRef.current.contains(event.target as Node)) {
        setMobileNotificationsOpen(false);
      }
    }
    if (notificationsOpen || mobileNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationsOpen, mobileNotificationsOpen]);

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_uid', user.uid)
        .eq('is_read', false);
      if (!error) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error('Error al marcar notificaciones como leídas:', err);
    }
  };

  const formatFullDateWithRelative = (dateStr?: string) => {
    if (!dateStr) return { fullDate: '', relative: '' };
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const fullDate = `${day}/${month}/${year}, ${hours}:${minutes}`;

      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHrs / 24);

      let relative = 'Ahora';
      if (diffMins < 1) relative = 'Ahora';
      else if (diffMins < 60) relative = `Hace ${diffMins} min`;
      else if (diffHrs < 24) relative = `Hace ${diffHrs} ${diffHrs === 1 ? 'hora' : 'horas'}`;
      else relative = `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;

      return { fullDate, relative };
    } catch {
      return { fullDate: '', relative: '' };
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'crush':
        return { label: 'CRUSH', icon: '💛', colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      case 'professors':
        return { label: 'PROFESORES', icon: '👨‍🏫', colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
      case 'exams':
        return { label: 'EXÁMENES', icon: '📝', colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'anecdotes':
        return { label: 'ANÉCDOTAS', icon: '🔥', colorClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30' };
      default:
        return { label: 'MURO', icon: '✨', colorClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' };
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    setNotificationsOpen(false);
    setMobileNotificationsOpen(false);
    
    if (!notif.is_read) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notif.id);
        if (!error) {
          setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        }
      } catch (err) {
        console.error('Error al marcar notificación como leída:', err);
      }
    }

    let confessionId: string | null = null;
    let commentId: string | null = null;
    if (notif.link_url) {
      if (notif.link_url.includes('show_confession=')) {
        confessionId = notif.link_url.split('show_confession=')[1]?.split('&')[0] || null;
      }
      if (notif.link_url.includes('comment_id=')) {
        commentId = notif.link_url.split('comment_id=')[1]?.split('&')[0] || null;
      }
    }

    if (confessionId) {
      setShowDetailModal(true);
      setModalLoading(true);
      setModalConfession(null);
      setModalCenterInfo(null);
      setModalComments([]);
      setTargetCommentId(commentId);
      setModalReactionsCount(0);
      
      try {
        // 1. Obtener la confesión
        const { data: confession } = await supabase
          .from('center_confessions')
          .select('*')
          .eq('id', confessionId)
          .single();

        if (confession) {
          setModalConfession(confession);

          // 2. Obtener datos del centro educativo
          if (confession.center_id) {
            const { data: center } = await supabase
              .from('educational_centers')
              .select('id, name, type')
              .eq('id', confession.center_id)
              .maybeSingle();
            if (center) {
              setModalCenterInfo(center);
            }
          }

          // 3. Obtener todas las respuestas / comentarios ordenadas por fecha más reciente
          const { data: comments } = await supabase
            .from('confession_comments')
            .select('*')
            .eq('confession_id', confessionId)
            .order('created_at', { ascending: false });

          if (comments) {
            setModalComments(comments);
          }

          // 4. Obtener conteo de reacciones de la confesión
          const { count: reactionCount } = await supabase
            .from('confession_reactions')
            .select('*', { count: 'exact', head: true })
            .eq('confession_id', confessionId);

          setModalReactionsCount(reactionCount || 25);
        }
      } catch (err) {
        console.error('Error al cargar detalles de la confesión para la notificación:', err);
      } finally {
        setModalLoading(false);
      }
    } else {
      if (notif.link_url && onNavigate) {
        onNavigate(notif.link_url);
      }
    }
  };

  const renderNotificationBody = (body: string) => {
    if (body.startsWith('[') && body.includes(']')) {
      const closingIndex = body.indexOf(']');
      const username = body.substring(1, closingIndex);
      const rest = body.substring(closingIndex + 1);
      return (
        <span className="leading-snug">
          <span className="text-amber-400 font-bold">{username}</span>
          <span className="text-zinc-300">{rest}</span>
        </span>
      );
    }
    return <span className="text-zinc-300">{body}</span>;
  };

  const formatNotifDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);
      if (diffMins < 1) return 'Ahora';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHrs < 24) return `Hace ${diffHrs} h`;
      return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
      setIsPwaInstallable(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e;
      setIsPwaInstallable(true);
    };

    const handlePwaCustomEvent = () => {
      if (typeof window !== 'undefined' && (window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt);
        setIsPwaInstallable(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-installable', handlePwaCustomEvent);

    const handleAppInstalled = () => {
      setIsPwaInstallable(false);
      setDeferredPrompt(null);
      if (typeof window !== 'undefined') {
        (window as any).deferredPrompt = null;
      }
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-installable', handlePwaCustomEvent);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handlePwaInstallClick = async () => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? (window as any).deferredPrompt : null);
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          if (typeof window !== 'undefined') {
            (window as any).deferredPrompt = null;
          }
          setIsPwaInstallable(false);
        }
      } catch (err) {
        console.error('Error al iniciar instalación PWA nativa:', err);
      }
    } else {
      // Si no hay evento de instalación nativa (como en iOS o previews en iframe), abrimos el modal detallado
      onOpenInstallModal();
    }
  };

  // Cerrar menú de configuración al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [settingsOpen]);

  const handleSearchSubmit = (queryText: string) => {
    if (onSearch) {
      onSearch(queryText);
    }
    setMobileSearchOpen(false);
  };

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    setMobileSearchOpen(false);
    if (onNavigate && suggestion.url) {
      onNavigate(suggestion.url);
    } else if (onSearch) {
      onSearch(suggestion.title);
    }
  };

  const handleQuickCategorySearch = (cat: string) => {
    if (onSearch) {
      onSearch(cat);
    }
    setMobileSearchOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#0d0d0d] border-b border-[#ffffff10] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6">
          
          {/* 1. LOGO (IZQUIERDA) */}
          <div 
            onClick={onGoToHome}
            className="flex items-center gap-2 cursor-pointer group select-none flex-shrink-0"
          >
            <div className="flex items-center justify-center transition-transform group-hover:scale-110">
              <img 
                src="/Logo/logo.jpg" 
                alt="Logo Starryz 5" 
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-[#eab308]/30 shadow-md"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-lg sm:text-xl font-black tracking-tighter text-white font-sans">
                  STARRYZ
                </span>
                <span className="text-lg sm:text-xl font-black text-[#eab308]">
                  5
                </span>
              </div>
            </div>
          </div>

          {/* 2. BUSCADOR CON AUTOCOMPLETADO Y TOLERANCIA A ERRORES (DESKTOP & TABLETS - CENTRO) */}
          <div className="hidden sm:flex flex-1 max-w-lg mx-2 lg:mx-6">
            <AutocompleteSearchBar
              value={searchQuery}
              placeholder="Buscar profesores, centros o alumnos..."
              onSearch={handleSearchSubmit}
              onSelectSuggestion={handleSuggestionSelect}
            />
          </div>

          {/* 3. ACCIONES DE LA DERECHA */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            
            {/* LUPA EN MÓVILES (ABRE LA VENTANA MODAL DE BÚSQUEDA) */}
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="sm:hidden p-2 rounded-xl bg-[#141414] border border-[#ffffff15] text-[#eab308] hover:bg-[#1a1a1a] transition-all active:scale-95 cursor-pointer"
              title="Buscar"
              aria-label="Abrir buscador"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* BOTÓN DE DESCARGA PWA EN MÓVILES */}
            <button
              onClick={handlePwaInstallClick}
              className="sm:hidden p-2 rounded-xl bg-[#141414] border border-[#ffffff15] text-[#eab308] hover:text-white hover:border-[#eab308]/40 hover:bg-[#1a1a1a] transition-all active:scale-95 cursor-pointer"
              title="Descargar Aplicación (PWA)"
            >
              <Download className="w-5 h-5" />
            </button>

            {/* NOTIFICACIONES EN MÓVILES CON DROPDOWN REAL */}
            <div className="relative sm:hidden" ref={mobileNotificationsRef}>
              <button
                onClick={() => setMobileNotificationsOpen(!mobileNotificationsOpen)}
                className="p-2 rounded-xl bg-[#141414] border border-[#ffffff15] text-[#eab308] hover:bg-[#1a1a1a] transition-all active:scale-95 cursor-pointer relative"
                title="Notificaciones"
              >
                <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'fill-amber-500/20' : ''}`} />
                {unreadCount > 0 && (
                  <>
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full" />
                  </>
                )}
              </button>

              {mobileNotificationsOpen && (
                <div 
                  id="mobile-notifs-dropdown"
                  className="absolute right-0 mt-2 z-50 w-80 bg-[#101114]/95 border border-[#eab308]/40 backdrop-blur-md rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.85)] overflow-hidden animate-fade-in"
                >
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800/80 bg-[#14151a]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                      <span className="text-xs font-black text-white uppercase tracking-wider">Notificaciones</span>
                    </div>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-[11px] text-[#eab308] hover:text-[#ca9a07] font-bold transition-colors cursor-pointer"
                      >
                        Marcar todas como leídas
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/60">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-zinc-500 text-xs">
                        No tienes notificaciones nuevas
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-3.5 text-left transition-all hover:bg-zinc-800/40 cursor-pointer ${
                            !notif.is_read ? 'bg-amber-500/10 border-l-2 border-l-amber-500' : 'border-l-2 border-l-transparent'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs text-amber-400 font-bold">
                              {notif.title || 'Wikibot'}
                            </span>
                            <span className="text-[10px] text-zinc-500 shrink-0">
                              {formatNotifDate(notif.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 mt-1 leading-snug">
                            {renderNotificationBody(notif.body)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* BOTONES DE USUARIO Y CONFIGURACIÓN (DESKTOP) */}
            <div className="hidden md:flex items-center gap-3">
              {/* BOTÓN DE DESCARGA PWA EN ESCRITORIO */}
              <button
                onClick={handlePwaInstallClick}
                className="p-2.5 rounded-xl bg-[#141414] border border-[#ffffff10] text-[#eab308] hover:text-white hover:border-[#eab308]/40 hover:bg-[#1a1a1a] transition-all cursor-pointer"
                title="Descargar Aplicación (PWA)"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* NOTIFICACIONES EN ESCRITORIO CON DROPDOWN REAL */}
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2.5 rounded-xl bg-[#141414] border border-[#ffffff10] text-[#eab308] hover:text-white hover:border-[#eab308]/40 hover:bg-[#1a1a1a] transition-all cursor-pointer relative"
                  title="Notificaciones"
                >
                  <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'fill-amber-500/20' : ''}`} />
                  {unreadCount > 0 && (
                    <>
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
                    </>
                  )}
                </button>

                {notificationsOpen && (
                  <div 
                    id="desktop-notifs-dropdown"
                    className="absolute right-0 mt-2 z-50 w-88 bg-[#101114]/95 border border-[#eab308]/40 backdrop-blur-md rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.85)] overflow-hidden animate-fade-in"
                  >
                    <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800/80 bg-[#14151a]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                        <span className="text-xs font-black text-white uppercase tracking-wider">Notificaciones</span>
                      </div>
                      {unreadCount > 0 && (
                        <button 
                          onClick={markAllAsRead}
                          className="text-[11px] text-[#eab308] hover:text-[#ca9a07] font-bold transition-colors cursor-pointer"
                        >
                          Marcar todas como leídas
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/60">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500 text-xs">
                          No tienes notificaciones nuevas
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-3.5 text-left transition-all hover:bg-zinc-800/40 cursor-pointer ${
                              !notif.is_read ? 'bg-amber-500/10 border-l-2 border-l-amber-500' : 'border-l-2 border-l-transparent'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-xs text-amber-400 font-bold">
                                {notif.title || 'Wikibot'}
                              </span>
                              <span className="text-[10px] text-zinc-500 shrink-0">
                                {formatNotifDate(notif.created_at)}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 mt-1 leading-snug">
                              {renderNotificationBody(notif.body)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {user ? (
                <div className="flex items-center gap-2.5 relative" ref={settingsRef}>
                  <button
                    onClick={onGoToProfile}
                    className="flex items-center gap-2 bg-[#141414] border border-[#ffffff10] hover:border-[#eab308]/50 pl-2 pr-3 py-1.5 rounded-full hover:bg-[#1a1a1a] transition-all cursor-pointer text-left"
                    title="Ver mi perfil"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'Usuario'}
                        className="w-6 h-6 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#eab308] text-black flex items-center justify-center text-[10px] font-black">
                        {user.displayName ? user.displayName.substring(0, 2).toUpperCase() : 'UA'}
                      </div>
                    )}
                    <span className="text-xs font-bold text-white max-w-[110px] truncate">
                      {user.displayName}
                    </span>
                  </button>
                  
                  {/* BOTÓN TIPO CONFIGURACIÓN CON MENÚ DESPLEGABLE */}
                  <div className="relative">
                    <button
                      onClick={() => setSettingsOpen(!settingsOpen)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        settingsOpen
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                          : 'bg-[#141414] border-[#ffffff15] text-zinc-400 hover:text-white hover:border-[#eab308]/40'
                      }`}
                      title="Configuración de la cuenta"
                      aria-label="Abrir menú de configuración"
                    >
                      <Settings className={`w-4 h-4 transition-transform duration-300 ${settingsOpen ? 'rotate-90 text-amber-400' : ''}`} />
                    </button>

                    {/* POPUP / DROPDOWN DE CONFIGURACIÓN */}
                    {settingsOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-[#111111] border border-zinc-800 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-white/5 space-y-1">
                        
                        {/* Cabecera del Menú */}
                        <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
                          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Ajustes
                          </div>
                          <div className="text-xs font-bold text-white truncate">
                            {user.displayName || 'Mi Cuenta'}
                          </div>
                        </div>

                         {/* SELECCIÓN DE TEMA (3 OPCIONES) */}
                         <div className="px-3 py-2 border-b border-zinc-800/80 mb-1 space-y-2">
                           <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                             <Palette className="w-3.5 h-3.5 text-zinc-400" />
                             <span>Tema</span>
                           </div>
                           <div className="grid grid-cols-3 gap-1">
                             <button
                               onClick={() => setTheme('day')}
                               className={`px-1 py-1.5 rounded-lg text-[9px] font-extrabold transition-all cursor-pointer text-center border ${
                                 theme === 'day'
                                   ? 'bg-amber-500/20 border-amber-500/40 text-amber-500'
                                   : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                               }`}
                             >
                               ☀️ Día
                             </button>
                             <button
                               onClick={() => setTheme('night')}
                               className={`px-1 py-1.5 rounded-lg text-[9px] font-extrabold transition-all cursor-pointer text-center border ${
                                 theme === 'night'
                                   ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                                   : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                               }`}
                             >
                               🌙 Noche
                             </button>
                             <button
                               onClick={() => setTheme('iesppu')}
                               className={`px-1 py-1.5 rounded-lg text-[9px] font-extrabold transition-all cursor-pointer text-center border ${
                                 theme === 'iesppu'
                                   ? 'bg-sky-500/20 border-sky-500/40 text-sky-400'
                                   : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                               }`}
                             >
                               💙 IESPPU
                             </button>
                           </div>
                         </div>

                        {/* OPCIÓN 2: CERRAR SESIÓN */}
                        {!user.isAnonymous && (
                          <button
                            onClick={() => {
                              setSettingsOpen(false);
                              logout();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-all cursor-pointer group text-left border-t border-zinc-800/60 mt-1"
                          >
                            <LogOut className="w-4 h-4 text-red-400 group-hover:-translate-x-0.5 transition-transform" />
                            <span>Cerrar Sesión</span>
                          </button>
                        )}

                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={onOpenJoinModal}
                  className="px-5 py-2 bg-[#eab308] text-black rounded-xl font-black text-xs tracking-widest hover:bg-[#d9a307] transition-all active:scale-95 cursor-pointer shadow-sm uppercase"
                >
                  UNIRSE
                </button>
              )}
            </div>

            {/* MENÚ MÓVIL TOGGLE */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl bg-[#141414] border border-[#ffffff15] text-zinc-300 hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                aria-label="Abrir Menú"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>

        {/* 4. MENÚ DESPLEGABLE MÓVIL */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0d0d0d] border-b border-[#ffffff10] px-6 py-5 space-y-4 animate-in slide-in-from-top-4 duration-200">
            {user && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onGoToProfile) onGoToProfile();
                }}
                className="w-full text-left flex items-center gap-3 bg-[#141414] border border-[#ffffff10] hover:border-[#eab308]/50 p-3 rounded-xl hover:bg-[#1a1a1a] transition-all cursor-pointer"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Usuario'}
                    className="w-10 h-10 rounded-full object-cover animate-in fade-in"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#eab308] text-black flex items-center justify-center text-xs font-black">
                    {user.displayName ? user.displayName.substring(0, 2).toUpperCase() : 'UA'}
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-white">{user.displayName}</div>
                  <div className="text-[10px] text-zinc-500 font-medium truncate max-w-[200px]">
                    {user.email || 'Acceso Anónimo'}
                  </div>
                </div>
              </button>
            )}

            {/* SELECCIÓN DE TEMA EN MÓVIL (LOS 3 TEMAS) */}
            <div className="p-3.5 rounded-2xl border border-zinc-800/80 bg-[#141414] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#eab308]" />
                  <span>Cambiar Tema</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-medium">3 Opciones</span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setTheme('day')}
                  className={`py-2 px-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border ${
                    theme === 'day'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-sm'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="text-sm">☀️</span>
                  <span className="text-[10px]">Modo Día</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('night')}
                  className={`py-2 px-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border ${
                    theme === 'night'
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400 shadow-sm'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="text-sm">🌙</span>
                  <span className="text-[10px]">Modo Noche</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('iesppu')}
                  className={`py-2 px-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 border ${
                    theme === 'iesppu'
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-400 shadow-sm'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="text-sm">💙</span>
                  <span className="text-[10px]">IESPPU</span>
                </button>
              </div>
            </div>

            {user ? (
              !user.isAnonymous && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-red-500/30 text-red-400 font-semibold text-xs tracking-widest uppercase bg-red-950/20 hover:bg-red-950/40 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>CERRAR SESIÓN</span>
                </button>
              )
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenJoinModal();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#eab308] text-black font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-2 shadow-sm"
              >
                <UserPlus className="w-4 h-4 text-black" />
                <span>UNIRSE</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* 5. VENTANA MODAL FLOTANTE DE BÚSQUEDA EN CELULARES (CON AUTOCOMPLETADO Y TOLERANCIA) */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col p-4 sm:hidden animate-in fade-in duration-200">
          
          <div className="bg-[#0d0d0d] border border-zinc-800 rounded-3xl p-5 shadow-[0_15px_50px_rgba(0,0,0,0.9)] space-y-4 max-w-md w-full mx-auto my-auto animate-in zoom-in-95 duration-200">
            
            {/* Header del modal */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
              <div className="flex items-center gap-2 text-white font-black text-sm uppercase tracking-wider">
                <Search className="w-4 h-4 text-[#eab308]" />
                <span>Buscar en Starryz 5</span>
              </div>
              <button
                onClick={() => setMobileSearchOpen(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-[#141414] border border-zinc-800 cursor-pointer"
                aria-label="Cerrar buscador"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Buscador Autocompletado Móvil */}
            <div className="w-full">
              <AutocompleteSearchBar
                value={searchQuery}
                placeholder="Escribe profesores, centros..."
                autoFocus={true}
                onSearch={handleSearchSubmit}
                onSelectSuggestion={handleSuggestionSelect}
                onClose={() => setMobileSearchOpen(false)}
                inputClassName="py-3 text-base border-2 border-[#eab308]/70"
              />
            </div>

            {/* Accesos rápidos sugeridos */}
            <div className="pt-2">
              <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2.5">
                Búsquedas sugeridas:
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickCategorySearch('Universidad')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
                >
                  <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                  <span>Universidades</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickCategorySearch('Profesor')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#eab308]" />
                  <span>Profesores</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickCategorySearch('Instituto')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Institutos</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickCategorySearch('Colegio')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Colegios</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* MODAL DE DETALLE DE NOTIFICACIÓN PROFESIONAL */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl bg-[#0d0e12] border border-zinc-800/90 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header del Modal */}
            <div className="px-5 py-4 border-b border-zinc-800/80 bg-[#111217] shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse" />
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                    Detalle de Confesión
                  </h3>
                  {modalConfession?.id && (
                    <span className="bg-zinc-800 text-zinc-400 border border-zinc-700/60 text-[10px] px-2 py-0.5 rounded font-mono font-bold tracking-wider">
                      #CONF-{modalConfession.id.substring(0, 4).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setShowDetailModal(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Subtítulo: Centro Educativo */}
              <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  {modalCenterInfo?.name || 'Centro Educativo'}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400 font-normal">
                  {modalCenterInfo?.type 
                    ? (modalCenterInfo.type.charAt(0).toUpperCase() + modalCenterInfo.type.slice(1)) 
                    : 'Campus Principal'}
                </span>
              </div>
            </div>

            {/* Contenido del Modal (Scrollable) */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {modalLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-9 h-9 border-3 border-[#eab308] border-t-transparent rounded-full animate-spin" />
                  <span className="text-zinc-400 text-xs tracking-wider font-medium">Cargando confesión y respuestas...</span>
                </div>
              ) : modalConfession ? (
                <div className="space-y-6">
                  
                  {/* Confesión Original Card */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-[#14151a] border border-zinc-800/90 shadow-lg space-y-4 relative">
                    
                    {/* Header de la confesión */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-2xl bg-[#eab308] text-black flex items-center justify-center font-black text-sm shadow-md">
                            {(modalConfession.author_name || 'Anónimo').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#14151a]" />
                        </div>

                        {/* Autor y Fecha */}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">
                              {modalConfession.author_name || 'Anónimo'}
                            </h4>
                            <span className="bg-zinc-800 text-zinc-400 border border-zinc-700/60 text-[10px] px-2 py-0.5 rounded font-medium">
                              Autor
                            </span>
                          </div>
                          <span className="text-xs text-zinc-400">
                            {formatFullDateWithRelative(modalConfession.created_at).fullDate}
                            {formatFullDateWithRelative(modalConfession.created_at).relative && (
                              <> • {formatFullDateWithRelative(modalConfession.created_at).relative}</>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Badge de Categoría */}
                      {(() => {
                        const badge = getCategoryBadge(modalConfession.category);
                        return (
                          <div className={`text-[11px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-lg border flex items-center gap-1.5 shrink-0 ${badge.colorClass}`}>
                            <span>{badge.icon}</span>
                            <span>{badge.label}</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Contenido del texto de la confesión */}
                    <p className="text-zinc-100 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-normal py-1">
                      {modalConfession.content}
                    </p>

                    {/* Stats Footer */}
                    <div className="flex items-center gap-5 pt-3 border-t border-zinc-800/80 text-xs text-zinc-400">
                      <div className="flex items-center gap-1.5 text-rose-400 font-semibold">
                        <Heart className="w-3.5 h-3.5 fill-rose-500/30 text-rose-500" />
                        <span>{modalReactionsCount || 1}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                        <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{modalComments.length} {modalComments.length === 1 ? 'respuesta' : 'respuestas'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-500 ml-auto font-normal">
                        <Eye className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{Math.max(modalComments.length * 14 + 32, 45)} vistas</span>
                      </div>
                    </div>

                  </div>

                  {/* Respuestas Recibidas */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-[#eab308] uppercase tracking-wider flex items-center gap-2">
                        <span>Respuestas / Comentarios</span>
                        <span className="text-xs bg-[#eab308]/20 text-[#eab308] border border-[#eab308]/30 px-2 py-0.5 rounded-full font-bold">
                          {modalComments.length}
                        </span>
                      </h4>
                      <span className="text-[11px] text-zinc-500 font-medium">
                        Ordenado por más reciente
                      </span>
                    </div>

                    {modalComments.length === 0 ? (
                      <div className="p-8 rounded-xl bg-[#121317] border border-zinc-800/60 text-center">
                        <p className="text-zinc-500 text-xs italic">No hay comentarios en esta confesión aún.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {modalComments.map((comment: any) => {
                          const isTarget = targetCommentId === comment.id;
                          const dateInfo = formatFullDateWithRelative(comment.created_at);
                          return (
                            <div 
                              key={comment.id}
                              className={`p-4 rounded-xl border transition-all ${
                                isTarget 
                                  ? 'border-l-4 border-l-amber-500 bg-[#16171e] border-zinc-800/90 shadow-md ring-1 ring-amber-500/20' 
                                  : 'border-l-4 border-l-transparent bg-[#111216] border-zinc-800/60 hover:border-zinc-700/80'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Avatar */}
                                <div className="w-9 h-9 rounded-xl bg-zinc-800/90 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm mt-0.5">
                                  {(comment.author_name || 'Anónimo').substring(0, 2).toUpperCase()}
                                </div>

                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs sm:text-sm font-bold text-white">
                                        {comment.author_name || 'Anónimo'}
                                      </span>
                                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold px-2 py-0.5 rounded">
                                        {modalCenterInfo?.name || 'Estudiante'}
                                      </span>
                                      <span className="text-[11px] text-zinc-400">
                                        {dateInfo.fullDate}
                                        {dateInfo.relative && <> • {dateInfo.relative}</>}
                                      </span>
                                    </div>

                                    {/* Botón de Reacción del comentario */}
                                    <button 
                                      type="button"
                                      className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-rose-400 bg-zinc-800/60 hover:bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700/60 transition-colors"
                                    >
                                      <Heart className="w-3 h-3" />
                                      <span>{comment.likes_count || 1}</span>
                                    </button>
                                  </div>

                                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed pt-0.5 whitespace-pre-wrap">
                                    {comment.content}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  No se pudo cargar la confesión original o ha sido eliminada por su creador.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 bg-[#111217] border-t border-zinc-800/80 shrink-0">
              {modalConfession?.center_id ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false);
                    if (onNavigate) {
                      onNavigate(`/educational_centers/${modalConfession.center_id}?show_confession=${modalConfession.id}`);
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-750 text-zinc-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ver en el campus</span>
                </button>
              ) : (
                <div />
              )}

              <button 
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2.5 bg-[#eab308] hover:bg-[#d9a307] text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Entendido
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
