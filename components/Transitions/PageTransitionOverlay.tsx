import React from 'react';
import { usePageTransition } from '../../src/context/PageTransitionContext';
import { PaperAirplaneTransition } from './PaperAirplaneTransition';

export const PageTransitionOverlay: React.FC = () => {
  const { isTransitioning, currentEffect, snapshotCanvas } = usePageTransition();

  if (!isTransitioning || currentEffect !== 'paper_airplane') {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      <PaperAirplaneTransition 
        durationMs={850} 
        textureCanvas={snapshotCanvas} 
      />
    </div>
  );
};
