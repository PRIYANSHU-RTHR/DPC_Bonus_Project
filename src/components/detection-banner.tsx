'use client';

/**
 * Detection Banner — Smart suggestion notification
 */

import React from 'react';
import { X, Wand2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDetectionStore, useImageStore, useMaskStore } from '@/lib/stores';
import { presets } from '@/lib/presets';
import { runInverseFFT } from '@/lib/pipeline';

export function DetectionBanner() {
  const showBanner = useDetectionStore((s) => s.showBanner);
  const noiseType = useDetectionStore((s) => s.noiseType);
  const spikes = useDetectionStore((s) => s.spikes);
  const dismissBanner = useDetectionStore((s) => s.dismissBanner);
  const mask = useMaskStore((s) => s.mask);
  const spectrum = useImageStore((s) => s.spectrum);
  const pushHistory = useMaskStore((s) => s.pushHistory);
  const setMask = useMaskStore((s) => s.setMask);

  if (!showBanner || !noiseType) return null;

  const handleAutoRemove = async () => {
    if (!mask || !spectrum) return;
    const autoPreset = presets.find((p) => p.id === 'auto');
    if (!autoPreset) return;

    pushHistory();
    const newMask = new Float32Array(mask);
    autoPreset.apply(newMask, spectrum.magnitude, spectrum.fftWidth, spectrum.fftHeight);
    setMask(newMask);
    dismissBanner();

    try {
      await runInverseFFT();
    } catch (e) {
      console.error('IFFT failed:', e);
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-neutral-800/80 border-b border-neutral-700 text-xs">
      <Info className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
      <span className="text-neutral-300 flex-1">
        {spikes.length} frequency {spikes.length === 1 ? 'peak' : 'peaks'} detected.{' '}
        <span className="text-neutral-400">{noiseType.description}</span>
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2.5 text-xs text-white bg-neutral-700 hover:bg-neutral-600"
        onClick={handleAutoRemove}
      >
        <Wand2 className="h-3 w-3 mr-1" />
        Auto-Remove
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 text-neutral-500 hover:text-white"
        onClick={dismissBanner}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
