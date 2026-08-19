'use client';

import React, { useState, useEffect } from 'react';
import { X, Send, MessageCircle, Building2, CornerDownRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { 
  CenterConfession, 
  ConfessionComment, 
  getConfessionComments, 
  createConfessionComment,
  formatTimeAgo 
} from '@/src/lib/confessions';

interface ConfessionCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  confession: CenterConfession | null;
  onCommentAdded: (confessionId: string) => void;
}

export default function ConfessionCommentsModal({
  isOpen,
  onClose,
  confession,
  onCommentAdded,
}: ConfessionCommentsModalProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<ConfessionComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [alias, setAlias] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && confession) {
      loadComments();
    } else {
      setComments([]);
      setContent('');
      setAlias('');
      setError(null);
    }
  }, [isOpen, confession]);

  if (!isOpen || !confession) return null;

  const loadComments = async () => {
    try {
      setLoading(true);
      const list = await getConfessionComments(confession.id);
      setComments(list);
    } catch (err) {
      console.error('Error al cargar comentarios:', err);
    } fontally: {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError('Por favor, escribe tu respuesta.');
      return;
    }

    if (trimmedContent.length > 500) {
      setError('La respuesta no puede exceder los 500 caracteres.');
      return;
    }

    const authorName = alias.trim() || (user ? (user.displayName || user.email?.split('@')[0]) : 'Anónimo') || 'Anónimo';

    try {
      setSubmitting(true);
      const newComment = await createConfessionComment({
        confession_id: confession.id,
        firebase_uid: user?.uid || null,
        author_name: authorName,
        content: trimmedContent,
        is_anonymous: !alias.trim(),
      });

      setComments((prev) => [...prev, newComment]);
      setContent('');
      onCommentAdded(confession.id);
    } catch (err: any) {
      console.error('Error al enviar respuesta:', err);
      setError('Error al guardar respuesta en la base de datos.');
    } finally {
      setSubmitting(false);
    }
  };

  // Category badge styling
  let categoryLabel = 'Anécdotas';
  let categoryBadgeClass = 'bg-[#181818] text-zinc-300 border-zinc-700/60';

  if (confession.category === 'crush') {
    categoryLabel = 'Crush / Amor';
    categoryBadgeClass = 'bg-pink-950/50 text-pink-400 border-pink-500/40';
  } else if (confession.category === 'professors') {
    categoryLabel = 'Profesores';
    categoryBadgeClass = 'bg-emerald-950/50 text-emerald-400 border-emerald-500/40';
  } else if (confession.category === 'exams') {
    categoryLabel = 'Exámenes';
    categoryBadgeClass = 'bg-blue-950/50 text-blue-400 border-blue-500/40';
  } else if (confession.category === 'anecdotes') {
    categoryLabel = 'Anécdotas';
    categoryBadgeClass = 'bg-amber-950/50 text-amber-400 border-amber-500/40';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div
        className="relative w-full max-w-2xl bg-[#0d0d0d] border border-zinc-800 rounded-3xl p-5 sm:p-7 space-y-6 shadow-[0_25px_70px_rgba(0,0,0,0.95)] max-h-[90vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#eab308]/15 border border-[#eab308]/30 flex items-center justify-center text-[#eab308] shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Respuestas a la Confesión</h2>
              <p className="text-xs text-zinc-400">Muro Interactivo de la Comunidad</p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-full text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 transition-colors cursor-pointer border border-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto space-y-6 pr-1 flex-1">
          {/* Confession Preview Card */}
          <div className="bg-[#141414] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-inner">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#1c1c1c] border border-amber-500/30 flex items-center justify-center text-[#eab308] shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-white tracking-wide">
                      {confession.author_name}
                    </span>
                    {!confession.is_anonymous && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#eab308] fill-[#eab308]/20 shrink-0" />
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    {formatTimeAgo(confession.created_at)}
                  </span>
                </div>
              </div>

              <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg border uppercase tracking-wider ${categoryBadgeClass}`}>
                {categoryLabel}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-zinc-200 font-medium leading-relaxed">
              {confession.content}
            </p>

            {/* Reactions preview */}
            <div className="flex items-center gap-2 pt-2 text-xs text-zinc-400 flex-wrap">
              <span className="bg-zinc-900/80 border border-zinc-800 px-2 py-1 rounded-lg text-xs font-semibold">❤️ {confession.reactions.heart}</span>
              <span className="bg-zinc-900/80 border border-zinc-800 px-2 py-1 rounded-lg text-xs font-semibold">😂 {confession.reactions.laugh}</span>
              <span className="bg-zinc-900/80 border border-zinc-800 px-2 py-1 rounded-lg text-xs font-semibold">🔥 {confession.reactions.fire}</span>
              <span className="bg-zinc-900/80 border border-zinc-800 px-2 py-1 rounded-lg text-xs font-semibold">😭 {confession.reactions.cry}</span>
              <span className="bg-zinc-900/80 border border-zinc-800 px-2 py-1 rounded-lg text-xs font-semibold">🤯 {confession.reactions.shock}</span>
            </div>
          </div>

          {/* Form: Responder a esta confesión */}
          <form onSubmit={handleSubmit} className="bg-[#141414] border border-zinc-800/90 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-white flex items-center gap-1.5 uppercase tracking-wider">
                <CornerDownRight className="w-4 h-4 text-[#eab308]" />
                <span>Responder a esta confesión</span>
              </h3>
              <span className={`text-[11px] font-semibold ${content.length >= 480 ? 'text-amber-400' : 'text-zinc-500'}`}>
                {content.length}/500
              </span>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 p-2.5 rounded-xl">
                {error}
              </p>
            )}

            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Tu Apodo / Alias (Opcional)..."
              maxLength={40}
              className="w-full bg-[#0d0d0d] border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#eab308] transition-colors"
            />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 500))}
                maxLength={500}
                rows={2}
                placeholder="Escribe tu respuesta anónima (máx. 500 caracteres)..."
                className="flex-1 bg-[#0d0d0d] border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#eab308] transition-colors resize-none leading-relaxed"
                required
              />

              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-3 bg-[#eab308] hover:bg-[#ca8a04] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_4px_15px_rgba(234,179,8,0.3)] flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 fill-current" />
                    <span>Responder</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Respuestas de la comunidad */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <span>💬 Respuestas de la comunidad</span>
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-white text-[10px]">
                {comments.length}
              </span>
            </h3>

            {loading ? (
              <div className="p-8 text-center text-xs text-zinc-500 space-y-2">
                <div className="w-6 h-6 border-2 border-[#eab308] border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Cargando respuestas...</p>
              </div>
            ) : comments.length === 0 ? (
              <div className="p-8 bg-[#141414] border border-zinc-800/60 rounded-2xl text-center space-y-2 text-xs text-zinc-500">
                <p className="text-white font-bold">Aún no hay respuestas en esta confesión.</p>
                <p>Sé el primero en compartir tu opinión o apoyo.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3.5 bg-[#141414] border border-zinc-800/80 rounded-2xl space-y-1.5 transition-all hover:border-zinc-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-xs text-[#eab308]">
                        {comment.author_name}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        {formatTimeAgo(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-200 leading-relaxed font-medium">
                      {comment.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
