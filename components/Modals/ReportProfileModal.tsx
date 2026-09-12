import React, { useState } from 'react';
import { Flag, AlertTriangle, ShieldAlert, X, Loader2, Check } from 'lucide-react';
import { createProfileReport, ProfileReport } from '@/src/lib/profileReports';

interface ReportProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: 'student' | 'professor';
  targetName: string;
  instituteId: string;
  currentUserId: string;
  currentUserName: string;
  onReportCreated: (report: ProfileReport) => void;
}

const REPORT_REASONS = [
  {
    id: 'not_exist',
    title: 'No existe en este instituto / Perfil falso',
    desc: 'Esta persona fue inventada o no pertenece a este centro escolar.',
  },
  {
    id: 'troll',
    title: 'Perfil troll, broma o inapropiado',
    desc: 'Contenido vulgar, difamatorio o creado únicamente para molestar.',
  },
  {
    id: 'impersonation',
    title: 'Suplantación de identidad',
    desc: 'Usa la foto o datos de otra persona sin su consentimiento.',
  },
  {
    id: 'other',
    title: 'Otro motivo no especificado',
    desc: 'Información errónea grave o duplicado.',
  },
];

export default function ReportProfileModal({
  isOpen,
  onClose,
  targetId,
  targetType,
  targetName,
  instituteId,
  currentUserId,
  currentUserName,
  onReportCreated,
}: ReportProfileModalProps) {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0].title);
  const [customDetail, setCustomDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      setError('Debes iniciar sesión para iniciar una votación de moderación.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const finalReason = customDetail.trim()
        ? `${selectedReason}: ${customDetail.trim()}`
        : selectedReason;

      const report = await createProfileReport({
        targetId,
        targetType,
        targetName,
        instituteId,
        reportedBy: currentUserId,
        reporterName: currentUserName || 'Miembro del campus',
        reason: finalReason,
        threshold: 5, // 5 votos requeridos para expulsar
      });

      onReportCreated(report);
      onClose();
    } catch (err: any) {
      console.error('Error al iniciar reporte:', err);
      setError(err?.message || 'Ocurrió un error al registrar el reporte.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-[#0e0e11] border border-red-500/30 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior con gradiente de alerta */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />

        {/* Cabecera */}
        <div className="p-6 pb-4 flex items-start justify-between gap-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Reportar Perfil
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                  Moderación
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Votación comunitaria para <span className="text-white font-bold">{targetName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Explicación de la moderación comunitaria */}
          <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/20 flex gap-3 text-xs text-zinc-300">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-red-300">Moderación comunitaria activa</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Al reportar, se abrirá una votación comunitaria en la cabecera de este perfil visible para todos los miembros del instituto.
                Si la comunidad confirma el reporte (5 votos para expulsar), el perfil será eliminado automáticamente del campus.
              </p>
            </div>
          </div>

          {/* Selector de motivos */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
              Selecciona el motivo del reporte:
            </label>
            <div className="space-y-2">
              {REPORT_REASONS.map((reason) => {
                const isSelected = selectedReason === reason.title;
                return (
                  <div
                    key={reason.id}
                    onClick={() => setSelectedReason(reason.title)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'bg-red-500/10 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                        : 'bg-[#151518] border-zinc-800 hover:border-zinc-700 hover:bg-[#1a1a1f]'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-red-500 bg-red-500' : 'border-zinc-600'
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <div className="text-left">
                      <p className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                        {reason.title}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {reason.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detalle adicional opcional */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
              Detalle adicional (opcional):
            </label>
            <input
              type="text"
              value={customDetail}
              onChange={(e) => setCustomDetail(e.target.value)}
              placeholder="Ej: Es un meme de internet, nunca estudió en este turno..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#151518] border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/60 transition-all"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-400 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-xs font-bold text-zinc-300 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Iniciando votación...</span>
                </>
              ) : (
                <>
                  <Flag className="w-4 h-4" />
                  <span>Abrir Votación de Expulsión</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
