import React, { useState, useEffect } from 'react';
import { ShieldAlert, Check, X, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { ProfileReport, ReportVoteType, submitReportVote, getUserVoteOnReport } from '@/src/lib/profileReports';

interface CommunityVoteBannerProps {
  report: ProfileReport;
  targetName: string;
  currentUserId: string | null;
  onRequireAuth?: () => void;
  onVoteUpdated: (updatedReport: ProfileReport) => void;
  onProfileExpelled: () => void;
}

export default function CommunityVoteBanner({
  report,
  targetName,
  currentUserId,
  onRequireAuth,
  onVoteUpdated,
  onProfileExpelled,
}: CommunityVoteBannerProps) {
  const [userVote, setUserVote] = useState<ReportVoteType | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteOutcomeMessage, setVoteOutcomeMessage] = useState<string | null>(null);

  // Cargar voto previo del usuario
  useEffect(() => {
    let isMounted = true;
    async function loadVote() {
      if (!currentUserId || !report?.id) return;
      const v = await getUserVoteOnReport(report.id, currentUserId);
      if (isMounted) setUserVote(v);
    }
    loadVote();
    return () => {
      isMounted = false;
    };
  }, [report.id, currentUserId]);

  // Listener para atajos de teclado F1 y F2 (estilo Left 4 Dead)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Solo si la votación está activa y no está en proceso de carga
      if (report.status !== 'active' || voting) return;

      if (e.key === 'F1') {
        e.preventDefault();
        handleVote('keep');
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleVote('expel');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [report, voting, currentUserId]);

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
      });

      setUserVote(type);
      onVoteUpdated(result.report);

      if (result.outcome === 'expelled') {
        setVoteOutcomeMessage('⚠️ La comunidad ha votado por expulsar este perfil. El perfil ha sido eliminado.');
        setTimeout(() => {
          onProfileExpelled();
        }, 2200);
      } else if (result.outcome === 'dismissed') {
        setVoteOutcomeMessage('✅ La comunidad confirmó que esta persona pertenece al instituto. Votación superada.');
      }
    } catch (err) {
      console.error('Error al emitir voto en moderación comunitaria:', err);
    } finally {
      setVoting(false);
    }
  };

  const threshold = report.threshold || 5;
  const expelProgress = Math.min(100, Math.round((report.votes_expel / threshold) * 100));
  const keepProgress = Math.min(100, Math.round((report.votes_keep / threshold) * 100));

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

      {/* Cabecera estilo Left 4 Dead */}
      <div className="flex items-center justify-between gap-3 border-b border-red-500/20 pb-3 mb-3">
        <div className="flex items-center gap-2 text-red-400">
          <ShieldAlert className="w-5 h-5 animate-pulse shrink-0" />
          <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-red-300">
            VOTACIÓN DE EXPULSIÓN ACTIVA (F1 / F2)
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 shrink-0">
          Left 4 Dead Mode
        </span>
      </div>

      {/* Motivo */}
      <div className="mb-3 px-3 py-1.5 rounded-lg bg-red-950/30 border border-red-500/20 text-xs text-zinc-300 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <span className="text-zinc-300">
          <strong className="text-white">Motivo reportado:</strong> {report.reason}
        </span>
      </div>

      {/* La Pregunta Central Solicitada por el Usuario */}
      <div className="text-center py-2">
        <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
          ¿Pertenece realmente a este instituto?
        </h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          Tu voto define si este perfil se conserva o se elimina de la plataforma escolar.
        </p>
      </div>

      {/* Opciones de Votación F1 vs F2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        {/* F1: SÍ, PERTENECE (CONSERVAR) */}
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
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 font-mono text-[10px] font-black tracking-widest border border-emerald-500/40">
              F1
            </span>
            <span className="text-xs sm:text-sm font-black tracking-tight text-emerald-400 group-hover:text-emerald-300">
              SÍ, PERTENECE
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 group-hover:text-zinc-300">
            Conservar perfil ({report.votes_keep} votos)
          </span>

          {userVote === 'keep' && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" /> Tu voto
            </span>
          )}
        </button>

        {/* F2: NO, EXPULSAR (ELIMINAR) */}
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
            <span className="px-1.5 py-0.5 rounded bg-red-500/30 text-red-300 font-mono text-[10px] font-black tracking-widest border border-red-500/40">
              F2
            </span>
            <span className="text-xs sm:text-sm font-black tracking-tight text-red-400 group-hover:text-red-300">
              NO, EXPULSAR
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 group-hover:text-zinc-300">
            Eliminar perfil ({report.votes_expel} / {threshold} votos)
          </span>

          {userVote === 'expel' && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full">
              <X className="w-3 h-3" /> Tu voto
            </span>
          )}
        </button>
      </div>

      {/* Barra de progreso hacia la expulsión */}
      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-400">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-24 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-red-500 h-full transition-all duration-300"
              style={{ width: `${expelProgress}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-red-400">
            {report.votes_expel} de {threshold} para eliminar
          </span>
        </div>
        <span className="text-[10px] text-zinc-500">
          Puedes presionar las teclas <strong className="text-zinc-300">F1</strong> o <strong className="text-zinc-300">F2</strong> en tu teclado
        </span>
      </div>
    </div>
  );
}
