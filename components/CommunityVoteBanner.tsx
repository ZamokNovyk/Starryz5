import React, { useState, useEffect } from 'react';
import { ShieldAlert, Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { ProfileReport, ReportVoteType, submitReportVote, getUserVoteOnReport } from '@/src/lib/profileReports';

interface CommunityVoteBannerProps {
  report: ProfileReport;
  targetName: string;
  targetId: string;
  targetType: 'student' | 'professor';
  currentUserId: string | null;
  onRequireAuth?: () => void;
  onVoteUpdated: (updatedReport: ProfileReport) => void;
  onProfileExpelled: () => void;
}

export default function CommunityVoteBanner({
  report,
  targetName,
  targetId,
  targetType,
  currentUserId,
  onRequireAuth,
  onVoteUpdated,
  onProfileExpelled,
}: CommunityVoteBannerProps) {
  const [userVote, setUserVote] = useState<ReportVoteType | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteOutcomeMessage, setVoteOutcomeMessage] = useState<string | null>(null);

  // Cargar voto previo del usuario desde Supabase backend
  useEffect(() => {
    let isMounted = true;
    async function loadVote() {
      if (!currentUserId || !report?.id) return;
      const v = await getUserVoteOnReport(report.id, currentUserId, targetId, targetType);
      if (isMounted) setUserVote(v);
    }
    loadVote();
    return () => {
      isMounted = false;
    };
  }, [report.id, currentUserId, targetId, targetType]);

  const handleVote = async (type: ReportVoteType) => {
    if (!currentUserId) {
      if (onRequireAuth) onRequireAuth();
      return;
    }

    try {
      setVoting(true);
      const result = await submitReportVote({
        reportId: report.id,
        userId: currentUserId,
        voteType: type,
        targetId,
        targetType,
      });

      setUserVote(type);
      onVoteUpdated(result.report);

      if (result.outcome === 'expelled') {
        setVoteOutcomeMessage('⚠️ La comunidad ha decidido expulsar este perfil. El perfil ha sido eliminado del campus.');
        setTimeout(() => {
          onProfileExpelled();
        }, 2200);
      } else if (result.outcome === 'dismissed') {
        setVoteOutcomeMessage('✅ La comunidad confirmó que esta persona sí pertenece al instituto. Votación superada con éxito.');
      }
    } catch (err) {
      console.error('Error al emitir voto en moderación comunitaria:', err);
    } finally {
      setVoting(false);
    }
  };

  const threshold = report.threshold || 5;
  const expelProgress = Math.min(100, Math.round((report.votes_expel / threshold) * 100));

  if (voteOutcomeMessage) {
    return (
      <div className="w-full max-w-2xl mx-auto mb-4 p-4 rounded-2xl bg-zinc-950 border border-amber-500/40 shadow-[0_0_30px_rgba(234,179,8,0.15)] text-center animate-in fade-in zoom-in-95 duration-300">
        <p className="text-sm font-black text-amber-300 tracking-tight flex items-center justify-center gap-2">
          {voteOutcomeMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto mb-6 p-4 sm:p-5 rounded-2xl bg-[#110d0d] border-2 border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.15)] relative overflow-hidden animate-in fade-in slide-in-from-top-3 duration-300">
      {/* Fondo con brillo sutil */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cabecera de moderación comunitaria */}
      <div className="flex items-center justify-between gap-3 border-b border-red-500/20 pb-3 mb-3">
        <div className="flex items-center gap-2 text-red-400">
          <ShieldAlert className="w-5 h-5 animate-pulse shrink-0" />
          <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-red-300">
            VOTACIÓN DE EXPULSIÓN COMUNITARIA
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 shrink-0">
          Moderación Activa
        </span>
      </div>

      {/* Motivo del reporte */}
      <div className="mb-3 px-3 py-2 rounded-lg bg-red-950/30 border border-red-500/20 text-xs text-zinc-300 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <span className="text-zinc-300 leading-relaxed">
          <strong className="text-white">Motivo del reporte:</strong> {report.reason}
        </span>
      </div>

      {/* La Pregunta Central Solicitada */}
      <div className="text-center py-2">
        <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
          ¿Pertenece realmente a este instituto?
        </h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          Tu voto ayuda a moderar la comunidad y decidir si este perfil se conserva o se expulsa de la plataforma.
        </p>
      </div>

      {/* Botones de Votación: Sí, pertenece vs No, expulsar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        {/* SÍ, PERTENECE (CONSERVAR) */}
        <button
          onClick={() => handleVote('keep')}
          disabled={voting}
          className={`relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center group ${
            userVote === 'keep'
              ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
              : 'bg-[#151d18] border-emerald-500/30 hover:border-emerald-500/70 hover:bg-emerald-500/10 text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs sm:text-sm font-black tracking-tight text-emerald-400 group-hover:text-emerald-300 uppercase">
              SÍ, PERTENECE
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 group-hover:text-zinc-300">
            Conservar perfil ({report.votes_keep} {report.votes_keep === 1 ? 'voto' : 'votos'})
          </span>

          {userVote === 'keep' && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full">
              <Check className="w-3 h-3" /> Tu voto actual
            </span>
          )}
        </button>

        {/* NO, EXPULSAR (ELIMINAR) */}
        <button
          onClick={() => handleVote('expel')}
          disabled={voting}
          className={`relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center group ${
            userVote === 'expel'
              ? 'bg-red-500/20 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
              : 'bg-[#201314] border-red-500/30 hover:border-red-500/70 hover:bg-red-500/10 text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <X className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs sm:text-sm font-black tracking-tight text-red-400 group-hover:text-red-300 uppercase">
              NO, EXPULSAR
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 group-hover:text-zinc-300">
            Eliminar perfil ({report.votes_expel} / {threshold} votos)
          </span>

          {userVote === 'expel' && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/20 px-2.5 py-0.5 rounded-full">
              <X className="w-3 h-3" /> Tu voto actual
            </span>
          )}
        </button>
      </div>

      {/* Barra de progreso hacia la expulsión comunitaria */}
      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-400">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-28 bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-red-500 h-full transition-all duration-300"
              style={{ width: `${expelProgress}%` }}
            />
          </div>
          <span className="text-[11px] font-bold text-red-400">
            {report.votes_expel} de {threshold} votos para expulsar
          </span>
        </div>
        {voting && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando tu voto en la nube...
          </span>
        )}
      </div>
    </div>
  );
}
