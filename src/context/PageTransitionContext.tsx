import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { captureScreenCanvas } from '@/components/Transitions/captureScreen';

export type TransitionType = 
  | 'paper_airplane' // ✈️ Avión de Papel Origami 3D con cuerpo de la página web
  | 'none';          // ⚡ Sin animación

export type TransitionSpeed = 'fast' | 'normal' | 'slow';

export interface TransitionDefinition {
  id: TransitionType;
  name: string;
  emoji: string;
  badge: string;
  description: string;
  durationMs: number;
  apexRatio: number;
}

export const TRANSITIONS_LIST: TransitionDefinition[] = [
  {
    id: 'paper_airplane',
    name: 'Avión de Papel 3D',
    emoji: '✈️',
    badge: 'Origami Real',
    description: 'La página actual se pliega tridimensionalmente formando el cuerpo y las alas del avión de papel, y despega volando para revelar la siguiente pestaña.',
    durationMs: 850,
    apexRatio: 0.38,
  },
  {
    id: 'none',
    name: 'Sin Animación',
    emoji: '⚡',
    badge: 'Instantáneo',
    description: 'Navegación normal directa sin animación de transición.',
    durationMs: 0,
    apexRatio: 0,
  },
];

interface PageTransitionContextType {
  activeTransition: TransitionType;
  setActiveTransition: (t: TransitionType) => void;
  speed: TransitionSpeed;
  setSpeed: (s: TransitionSpeed) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  isTransitioning: boolean;
  transitionPhase: 'idle' | 'in' | 'apex' | 'out';
  currentEffect: TransitionType;
  snapshotCanvas: HTMLCanvasElement | null;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;
  startTransition: (onApexCallback?: () => void, customType?: TransitionType) => void;
  previewTransition: () => void;
}

const PageTransitionContext = createContext<PageTransitionContextType | undefined>(undefined);

// Web Audio API Synthesizer for Paper Crease & Wind Flight Swoosh
function playSynthesizedSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // 1. Fold paper crease crumple sound
    const foldDuration = 0.34;
    const bufferSize = ctx.sampleRate * foldDuration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1300, now);
    filter.frequency.exponentialRampToValueAtTime(3400, now + foldDuration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + foldDuration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // 2. Wind flight swoosh as airplane takes off into the sky
    const flightDuration = 0.6;
    const flightBufSize = ctx.sampleRate * flightDuration;
    const flightBuf = ctx.createBuffer(1, flightBufSize, ctx.sampleRate);
    const flightData = flightBuf.getChannelData(0);
    for (let i = 0; i < flightBufSize; i++) {
      flightData[i] = (Math.random() * 2 - 1);
    }
    const flightNoise = ctx.createBufferSource();
    flightNoise.buffer = flightBuf;

    const flightFilter = ctx.createBiquadFilter();
    flightFilter.type = 'lowpass';
    flightFilter.frequency.setValueAtTime(220, now + 0.3);
    flightFilter.frequency.exponentialRampToValueAtTime(1850, now + 0.3 + flightDuration * 0.35);
    flightFilter.frequency.exponentialRampToValueAtTime(140, now + 0.3 + flightDuration);

    const flightGain = ctx.createGain();
    flightGain.gain.setValueAtTime(0.01, now + 0.3);
    flightGain.gain.linearRampToValueAtTime(0.4, now + 0.3 + flightDuration * 0.3);
    flightGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3 + flightDuration);

    flightNoise.connect(flightFilter);
    flightFilter.connect(flightGain);
    flightGain.connect(ctx.destination);
    flightNoise.start(now + 0.3);
  } catch {
    // Autoplay restrictions safety
  }
}

export const PageTransitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTransition, setActiveTransitionState] = useState<TransitionType>(() => {
    try {
      const saved = localStorage.getItem('starryz_page_transition');
      if (saved === 'none') return 'none';
    } catch {}
    return 'paper_airplane'; // Default active 3D Paper Airplane
  });

  const [speed, setSpeedState] = useState<TransitionSpeed>(() => {
    try {
      const saved = localStorage.getItem('starryz_transition_speed');
      if (saved === 'fast' || saved === 'normal' || saved === 'slow') return saved;
    } catch {}
    return 'normal';
  });

  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('starryz_transition_sound');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'in' | 'apex' | 'out'>('idle');
  const [currentEffect, setCurrentEffect] = useState<TransitionType>('none');
  const [snapshotCanvas, setSnapshotCanvas] = useState<HTMLCanvasElement | null>(null);

  const animationTimerRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimers = () => {
    animationTimerRef.current.forEach(t => clearTimeout(t));
    animationTimerRef.current = [];
  };

  const setActiveTransition = (t: TransitionType) => {
    setActiveTransitionState(t);
    try {
      localStorage.setItem('starryz_page_transition', t);
    } catch {}
  };

  const setSpeed = (s: TransitionSpeed) => {
    setSpeedState(s);
    try {
      localStorage.setItem('starryz_transition_speed', s);
    } catch {}
  };

  const setSoundEnabled = (v: boolean) => {
    setSoundEnabledState(v);
    try {
      localStorage.setItem('starryz_transition_sound', String(v));
    } catch {}
  };

  const startTransition = useCallback(async (onApexCallback?: () => void, customType?: TransitionType) => {
    const effectType = customType || activeTransition;

    if (effectType === 'none') {
      if (onApexCallback) onApexCallback();
      return;
    }

    clearTimers();

    // 1. Snapshot the current page view with its exact colors, texts, buttons
    const canvas = await captureScreenCanvas();
    setSnapshotCanvas(canvas);

    const config = TRANSITIONS_LIST[0]; // paper_airplane
    const speedMultiplier = speed === 'fast' ? 0.75 : speed === 'slow' ? 1.35 : 1;
    const totalDuration = config.durationMs * speedMultiplier;
    const apexTime = totalDuration * config.apexRatio;

    setCurrentEffect('paper_airplane');
    setIsTransitioning(true);
    setTransitionPhase('in');

    if (soundEnabled) {
      playSynthesizedSound();
    }

    // 2. Apex: the plane is completely folded and takes off; switch underlying page
    const apexTimer = setTimeout(() => {
      setTransitionPhase('apex');
      if (onApexCallback) {
        try {
          onApexCallback();
        } catch (err) {
          console.error('Error navigating during transition apex:', err);
        }
      }

      const outTimer = setTimeout(() => {
        setTransitionPhase('out');
      }, 50);
      animationTimerRef.current.push(outTimer);
    }, apexTime);

    // 3. Complete: airplane has flown out into the sky
    const finishTimer = setTimeout(() => {
      setIsTransitioning(false);
      setTransitionPhase('idle');
      setCurrentEffect('none');
      setSnapshotCanvas(null);
    }, totalDuration);

    animationTimerRef.current.push(apexTimer, finishTimer);
  }, [activeTransition, speed, soundEnabled]);

  const previewTransition = useCallback(() => {
    startTransition(undefined, 'paper_airplane');
  }, [startTransition]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  return (
    <PageTransitionContext.Provider
      value={{
        activeTransition,
        setActiveTransition,
        speed,
        setSpeed,
        soundEnabled,
        setSoundEnabled,
        isTransitioning,
        transitionPhase,
        currentEffect,
        snapshotCanvas,
        isSettingsModalOpen,
        setIsSettingsModalOpen,
        startTransition,
        previewTransition,
      }}
    >
      {children}
    </PageTransitionContext.Provider>
  );
};

export function usePageTransition() {
  const context = useContext(PageTransitionContext);
  if (!context) {
    throw new Error('usePageTransition must be used within a PageTransitionProvider');
  }
  return context;
}
