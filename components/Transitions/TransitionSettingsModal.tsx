import React from 'react';
import { 
  X, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Gauge, 
  CheckCircle2, 
  Play,
  Send,
  Power
} from 'lucide-react';
import { 
  usePageTransition, 
  TransitionSpeed 
} from '../../src/context/PageTransitionContext';

export const TransitionSettingsModal: React.FC = () => {
  const { 
    isSettingsModalOpen, 
    setIsSettingsModalOpen, 
    activeTransition, 
    setActiveTransition, 
    speed, 
    setSpeed, 
    soundEnabled, 
    setSoundEnabled,
    previewTransition,
    isTransitioning
  } = usePageTransition();

  if (!isSettingsModalOpen) return null;

  const isEnabled = activeTransition === 'paper_airplane';

  return (
    <div 
      className="fixed inset-0 z-[99990] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => setIsSettingsModalOpen(false)}
    >
      <div 
        className="relative w-full max-w-lg bg-[#111113] border border-zinc-800 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="px-6 py-5 border-b border-zinc-800/80 flex items-center justify-between bg-[#151518]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
              <Send className="w-5 h-5 -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-wide">
                  Transición Avión de Papel 3D
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-400 text-black uppercase tracking-wider">
                  PowerPoint FX
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                La página actual se convierte en el cuerpo del avión al cambiar de pestaña.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(false)}
            className="w-9 h-9 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/80 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-zinc-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="p-6 space-y-5">
          {/* Tarjeta de Estado Principal */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isEnabled 
              ? 'bg-amber-400/5 border-amber-400/40 shadow-[0_0_25px_rgba(234,179,8,0.08)]' 
              : 'bg-zinc-900/60 border-zinc-800'
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="text-3xl p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 shrink-0">
                  ✈️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-white">
                      Efecto Origami 3D
                    </h4>
                    {isEnabled && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Activado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Toma una captura exacta de tu pantalla actual con tus colores personalizados, la pliega en 3D y despega volando con estela de viento.
                  </p>
                </div>
              </div>

              {/* Botón On / Off */}
              <button
                type="button"
                onClick={() => setActiveTransition(isEnabled ? 'none' : 'paper_airplane')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border shrink-0 ${
                  isEnabled
                    ? 'bg-amber-400 text-black border-amber-400 shadow-md'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{isEnabled ? 'Activada' : 'Activar'}</span>
              </button>
            </div>

            {/* Botón Probar */}
            {isEnabled && (
              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">
                  ¿Quieres ver cómo se pliega tu pantalla actual?
                </span>
                <button
                  type="button"
                  disabled={isTransitioning}
                  onClick={() => previewTransition()}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all border border-amber-400/30 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-amber-400" />
                  <span>Probar Vuelo Ahora</span>
                </button>
              </div>
            )}
          </div>

          {/* Opciones de Velocidad y Sonido */}
          <div className="space-y-3">
            {/* Velocidad */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <div className="flex items-center gap-2.5">
                <Gauge className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="text-xs font-bold text-zinc-200">Velocidad del Avión</div>
                  <div className="text-[10px] text-zinc-500">Duración del plegado y vuelo</div>
                </div>
              </div>
              <div className="flex bg-black/60 p-1 rounded-xl border border-zinc-800 gap-1">
                {(['fast', 'normal', 'slow'] as TransitionSpeed[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      speed === s
                        ? 'bg-amber-400 text-black shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {s === 'fast' ? '⚡ Rápido' : s === 'normal' ? '🎯 Normal' : '🎬 Suave'}
                  </button>
                ))}
              </div>
            </div>

            {/* Efectos de Sonido */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <div className="flex items-center gap-2.5">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-zinc-500" />
                )}
                <div>
                  <div className="text-xs font-bold text-zinc-200">Sonido de Papel y Viento</div>
                  <div className="text-[10px] text-zinc-500">Crujido de papel doblado y silbido aerodinámico</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`px-3.5 py-1.5 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                  soundEnabled
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {soundEnabled ? 'Activado' : 'Silenciado'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#151518] border-t border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Se activa automáticamente en cada cambio de página.</span>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(false)}
            className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs tracking-wider transition-all shadow-[0_4px_15px_rgba(234,179,8,0.3)] cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
