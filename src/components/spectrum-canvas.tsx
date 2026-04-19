'use client';

/**
 * Spectrum Canvas — Renders the FFT magnitude spectrum via Canvas2D with mask overlay.
 * Handles brush/star brush painting interactions.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  useImageStore,
  useToolStore,
  useMaskStore,
  useDetectionStore,
} from '@/lib/stores';
import {
  applyCircularBrush,
  applyStarBrush,
  applyNotchFilter,
  applyDirectionalFilter,
  applyBandStopFilter,
} from '@/lib/mask-engine';
import { runInverseFFT } from '@/lib/pipeline';

// Grayscale colormap
const COLORMAP = generateGrayscaleColormap();

function generateGrayscaleColormap(): [number, number, number][] {
  const colors: [number, number, number][] = [];
  for (let i = 0; i < 256; i++) {
    colors.push([i, i, i]);
  }
  return colors;
}

export function SpectrumCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPainting, setIsPainting] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const spectrum = useImageStore((s) => s.spectrum);
  const mask = useMaskStore((s) => s.mask);
  const activeTool = useToolStore((s) => s.activeTool);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Render spectrum
  const renderSpectrum = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spectrum) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { magnitude, fftWidth, fftHeight } = spectrum;
    const currentMask = useMaskStore.getState().mask;

    // Create ImageData matching canvas size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    const imageData = ctx.createImageData(canvasSize.width, canvasSize.height);
    const scaleX = fftWidth / canvasSize.width;
    const scaleY = fftHeight / canvasSize.height;

    for (let y = 0; y < canvasSize.height; y++) {
      for (let x = 0; x < canvasSize.width; x++) {
        // Map screen pixel to spectrum pixel (nearest neighbor)
        const sx = Math.floor(x * scaleX);
        const sy = Math.floor(y * scaleY);
        const specIdx = sy * fftWidth + sx;
        const val = magnitude[specIdx];
        const maskVal = currentMask ? currentMask[specIdx] : 0;

        // Colormap lookup
        const ci = Math.floor(val * 255);
        const [r, g, b] = COLORMAP[Math.min(255, Math.max(0, ci))];

        const pixIdx = (y * canvasSize.width + x) * 4;

        // Blend mask overlay (red tint)
        if (maskVal > 0.01) {
          const alpha = maskVal * 0.6;
          imageData.data[pixIdx] = Math.round(r * (1 - alpha) + 255 * alpha);
          imageData.data[pixIdx + 1] = Math.round(g * (1 - alpha));
          imageData.data[pixIdx + 2] = Math.round(b * (1 - alpha));
        } else {
          imageData.data[pixIdx] = r;
          imageData.data[pixIdx + 1] = g;
          imageData.data[pixIdx + 2] = b;
        }
        imageData.data[pixIdx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [spectrum, canvasSize]);

  // Re-render when spectrum or mask changes
  useEffect(() => {
    renderSpectrum();
  }, [renderSpectrum, mask]);

  // Render spike markers on overlay
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !spectrum) return;
    overlay.width = canvasSize.width;
    overlay.height = canvasSize.height;
    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    const { fftWidth, fftHeight } = spectrum;
    const scaleX = canvasSize.width / fftWidth;
    const scaleY = canvasSize.height / fftHeight;

    // Draw detected spike markers
    const spikes = useDetectionStore.getState().spikes;
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
    ctx.lineWidth = 1.5;

    for (const spike of spikes) {
      const sx = spike.x * scaleX;
      const sy = spike.y * scaleY;
      // Crosshair marker
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - 10, sy);
      ctx.lineTo(sx + 10, sy);
      ctx.moveTo(sx, sy - 10);
      ctx.lineTo(sx, sy + 10);
      ctx.stroke();
    }
  }, [spectrum, canvasSize]);

  // --- Painting Logic ---
  const getSpectrumCoords = useCallback(
    (e: React.PointerEvent) => {
      if (!spectrum || !canvasRef.current) return null;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const scaleX = spectrum.fftWidth / canvasSize.width;
      const scaleY = spectrum.fftHeight / canvasSize.height;
      return {
        x: Math.floor(x * scaleX),
        y: Math.floor(y * scaleY),
      };
    },
    [spectrum, canvasSize]
  );

  const paint = useCallback(
    (specX: number, specY: number) => {
      const currentMask = useMaskStore.getState().mask;
      const spec = useImageStore.getState().spectrum;
      if (!currentMask || !spec) return;

      const tool = useToolStore.getState();
      const { fftWidth, fftHeight } = spec;
      const newMask = new Float32Array(currentMask);

      switch (tool.activeTool) {
        case 'brush':
          applyCircularBrush(newMask, fftWidth, fftHeight, specX, specY, tool.brushRadius, tool.brushSoftness, false);
          break;
        case 'eraser':
          applyCircularBrush(newMask, fftWidth, fftHeight, specX, specY, tool.brushRadius, tool.brushSoftness, true);
          break;
        case 'star':
          applyStarBrush(newMask, fftWidth, fftHeight, specX, specY, {
            arms: tool.starArms,
            radius: tool.starRadius,
            armWidth: tool.starArmWidth,
            softness: tool.starSoftness,
          });
          break;
        case 'notch':
          applyNotchFilter(newMask, fftWidth, fftHeight, specX, specY, tool.notchRadius, 0.5);
          break;
        default:
          return;
      }

      useMaskStore.getState().setMask(newMask);
    },
    []
  );

  const applyFilterTool = useCallback(() => {
    const currentMask = useMaskStore.getState().mask;
    const spec = useImageStore.getState().spectrum;
    if (!currentMask || !spec) return;

    const tool = useToolStore.getState();
    const { fftWidth, fftHeight } = spec;
    const newMask = new Float32Array(currentMask);

    switch (tool.activeTool) {
      case 'directional':
        applyDirectionalFilter(newMask, fftWidth, fftHeight, tool.directionalAngle, tool.directionalWidth, 0.5);
        break;
      case 'bandstop':
        applyBandStopFilter(newMask, fftWidth, fftHeight, tool.bandInner, tool.bandOuter, 0.5);
        break;
      default:
        return;
    }

    useMaskStore.getState().pushHistory();
    useMaskStore.getState().setMask(newMask);
    runInverseFFT().catch(console.error);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool === 'pan') return;

      // Directional and bandstop apply immediately on click
      if (activeTool === 'directional' || activeTool === 'bandstop') {
        applyFilterTool();
        return;
      }

      const coords = getSpectrumCoords(e);
      if (!coords) return;

      useMaskStore.getState().pushHistory();
      setIsPainting(true);
      paint(coords.x, coords.y);

      // For single-click tools (star, notch), also run IFFT immediately
      if (activeTool === 'star' || activeTool === 'notch') {
        setIsPainting(false);
        runInverseFFT().catch(console.error);
      }
    },
    [activeTool, getSpectrumCoords, paint, applyFilterTool]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPainting) return;
      const coords = getSpectrumCoords(e);
      if (!coords) return;
      paint(coords.x, coords.y);
    },
    [isPainting, getSpectrumCoords, paint]
  );

  const handlePointerUp = useCallback(() => {
    if (isPainting) {
      setIsPainting(false);
      runInverseFFT().catch(console.error);
    }
  }, [isPainting]);

  // Cursor style based on tool
  const getCursor = () => {
    switch (activeTool) {
      case 'pan':
        return 'grab';
      case 'brush':
      case 'star':
      case 'eraser':
      case 'notch':
        return 'crosshair';
      default:
        return 'default';
    }
  };

  if (!spectrum) return null;

  return (
    <div ref={containerRef} className="relative flex-1 bg-neutral-950 overflow-hidden">
      <div className="absolute top-2 left-2 z-10">
        <span className="text-[10px] font-mono text-neutral-500 bg-neutral-900/80 px-1.5 py-0.5 rounded">
          Frequency Domain
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: getCursor(), imageRendering: 'pixelated' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <canvas
        ref={overlayRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
}
