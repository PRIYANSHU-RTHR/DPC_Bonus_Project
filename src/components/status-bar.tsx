'use client';

/**
 * Status Bar — Bottom bar with image info and processing stats
 */

import React from 'react';
import { useImageStore, useMaskStore } from '@/lib/stores';

export function StatusBar() {
  const width = useImageStore((s) => s.width);
  const height = useImageStore((s) => s.height);
  const spectrum = useImageStore((s) => s.spectrum);
  const lastProcessingTime = useImageStore((s) => s.lastProcessingTime);
  const coverage = useMaskStore((s) => s.coverage);
  const hasImage = useImageStore((s) => !!s.grayscale);

  if (!hasImage) return null;

  return (
    <div className="flex items-center justify-between h-6 px-3 bg-neutral-900 border-t border-neutral-800 text-[10px] font-mono text-neutral-500 shrink-0">
      <div className="flex items-center gap-4">
        <span>
          {width} x {height}
        </span>
        {spectrum && (
          <span>
            FFT: {spectrum.fftWidth} x {spectrum.fftHeight}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span>Mask: {(coverage * 100).toFixed(1)}%</span>
        {lastProcessingTime > 0 && <span>{lastProcessingTime}ms</span>}
      </div>
    </div>
  );
}
