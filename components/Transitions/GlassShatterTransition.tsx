import React, { useEffect, useState, useMemo } from 'react';

interface GlassShatterTransitionProps {
  durationMs?: number;
}

export const GlassShatterTransition: React.FC<GlassShatterTransitionProps> = ({ 
  durationMs = 750 
}) => {
  const [clonedHtml, setClonedHtml] = useState<string>('');
  const [scrollY, setScrollY] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    const sourceEl = document.getElementById('page-view-container') || document.getElementById('root');
    if (sourceEl) {
      setClonedHtml(sourceEl.innerHTML);
      setScrollY(window.scrollY || 0);
    }

    const start = performance.now();
    let animId: number;

    const frame = (now: number) => {
      const p = Math.min(1.0, (now - start) / durationMs);
      setProgress(p);
      if (p < 1.0) animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [durationMs]);

  // Voronoi glass shard geometries across grid
  const shards = useMemo(() => {
    const items = [];
    const rows = 4;
    const cols = 5;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x1 = (c / cols) * 100;
        const y1 = (r / rows) * 100;
        const x2 = ((c + 1) / cols) * 100;
        const y2 = ((r + 1) / rows) * 100;

        // Jitter corners for organic glass shards
        const jx = (Math.sin(r * 7 + c * 13) * 2);
        const jy = (Math.cos(r * 11 + c * 5) * 2);

        const angle = Math.atan2((r - rows / 2), (c - cols / 2));
        const dist = Math.hypot((r - rows / 2), (c - cols / 2)) + 1;

        items.push({
          id: `${r}-${c}`,
          clip: `polygon(${x1 + jx}% ${y1 + jy}%, ${x2 + jx}% ${y1}%, ${x2}% ${y2 + jy}%, ${x1}% ${y2}%)`,
          vx: Math.cos(angle) * dist * 35,
          vy: Math.sin(angle) * dist * 35 + 20, // gravity downward
          rotZ: (Math.sin(r * 3 + c * 5) * 60),
          rotX: (Math.cos(r * 4 + c * 2) * 50),
        });
      }
    }
    return items;
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden select-none"
      style={{ perspective: '1200px' }}
      aria-hidden="true"
    >
      {/* Spiderweb fracture flash at start */}
      {progress < 0.25 && (
        <div 
          className="absolute inset-0 bg-white/30 backdrop-blur-xs transition-opacity duration-150 pointer-events-none z-10"
          style={{ opacity: Math.max(0, 1 - progress * 4) }}
        />
      )}

      {/* Shards tumbling in 3D physics */}
      {shards.map((s) => {
        const ease = Math.pow(progress, 1.4);
        const tx = s.vx * ease;
        const ty = s.vy * ease + 0.5 * 9.8 * Math.pow(progress * 15, 2);
        const rz = s.rotZ * ease;
        const rx = s.rotX * ease;
        const opacity = Math.max(0, 1 - progress * 1.2);

        return (
          <div
            key={s.id}
            className="absolute inset-0 w-full h-full overflow-hidden"
            style={{
              clipPath: s.clip,
              transform: `translate3d(${tx}px, ${ty}px, ${-ease * 300}px) rotateZ(${rz}deg) rotateX(${rx}deg)`,
              opacity,
              willChange: 'transform, opacity',
            }}
          >
            {/* Cloned Real Webpage */}
            <div
              className="absolute top-0 left-0 w-screen h-screen pointer-events-none"
              style={{ transform: `translateY(-${scrollY}px)` }}
              dangerouslySetInnerHTML={{ __html: clonedHtml }}
            />

            {/* Glass shard specular highlight & glint border */}
            <div 
              className="absolute inset-0 border border-white/50 bg-gradient-to-br from-white/20 via-transparent to-black/30 pointer-events-none"
            />
          </div>
        );
      })}
    </div>
  );
};
