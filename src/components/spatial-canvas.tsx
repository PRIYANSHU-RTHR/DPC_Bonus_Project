'use client';

/**
 * Spatial Canvas — Displays the original or reconstructed image
 * Supports Before/After split comparison.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useImageStore, useUIStore } from '@/lib/stores';
import { grayscaleToImageData } from '@/lib/pipeline';

export function SpatialCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [splitPos, setSplitPos] = useState(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const original = useImageStore((s) => s.original);
  const grayscale = useImageStore((s) => s.grayscale);
  const result = useImageStore((s) => s.result);
  const width = useImageStore((s) => s.width);
  const height = useImageStore((s) => s.height);
  const showBeforeAfter = useUIStore((s) => s.showBeforeAfter);

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

  // Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grayscale) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    // Calculate fit dimensions
    const scaleX = canvasSize.width / width;
    const scaleY = canvasSize.height / height;
    const scale = Math.min(scaleX, scaleY);
    const drawW = width * scale;
    const drawH = height * scale;
    const offsetX = (canvasSize.width - drawW) / 2;
    const offsetY = (canvasSize.height - drawH) / 2;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Create offscreen canvases for before/after
    const beforeCanvas = document.createElement('canvas');
    beforeCanvas.width = width;
    beforeCanvas.height = height;
    const beforeCtx = beforeCanvas.getContext('2d')!;

    if (original) {
      beforeCtx.putImageData(original, 0, 0);
    } else {
      const grayImg = grayscaleToImageData(grayscale, width, height);
      beforeCtx.putImageData(grayImg, 0, 0);
    }

    if (showBeforeAfter && result) {
      // Split view
      const afterCanvas = document.createElement('canvas');
      afterCanvas.width = width;
      afterCanvas.height = height;
      const afterCtx = afterCanvas.getContext('2d')!;
      const resultImg = grayscaleToImageData(result, width, height);
      afterCtx.putImageData(resultImg, 0, 0);

      const splitX = splitPos * canvasSize.width;

      // Draw "before" on left side
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, canvasSize.height);
      ctx.clip();
      ctx.drawImage(beforeCanvas, offsetX, offsetY, drawW, drawH);
      ctx.restore();

      // Draw "after" on right side
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, canvasSize.width - splitX, canvasSize.height);
      ctx.clip();
      ctx.drawImage(afterCanvas, offsetX, offsetY, drawW, drawH);
      ctx.restore();

      // Draw split line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, canvasSize.height);
      ctx.stroke();

      // Labels
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('Before', 8, canvasSize.height - 8);
      ctx.fillText('After', canvasSize.width - 40, canvasSize.height - 8);

      // Split handle
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(splitX, canvasSize.height / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Arrows inside handle
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u2194', splitX, canvasSize.height / 2);
    } else if (result) {
      // Show result only
      const resultImg = grayscaleToImageData(result, width, height);
      const resultCanvas = document.createElement('canvas');
      resultCanvas.width = width;
      resultCanvas.height = height;
      resultCanvas.getContext('2d')!.putImageData(resultImg, 0, 0);
      ctx.drawImage(resultCanvas, offsetX, offsetY, drawW, drawH);
    } else {
      // Show original
      ctx.drawImage(beforeCanvas, offsetX, offsetY, drawW, drawH);
    }
  }, [grayscale, result, original, width, height, canvasSize, showBeforeAfter, splitPos]);

  useEffect(() => {
    render();
  }, [render]);

  // Split handle drag
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!showBeforeAfter) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left) / rect.width;
      if (Math.abs(x - splitPos) < 0.03) {
        setIsDraggingSplit(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
    [showBeforeAfter, splitPos]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingSplit) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
      setSplitPos(x);
    },
    [isDraggingSplit]
  );

  const handlePointerUp = useCallback(() => {
    setIsDraggingSplit(false);
  }, []);

  if (!grayscale) return null;

  return (
    <div ref={containerRef} className="relative flex-1 bg-neutral-950 overflow-hidden">
      <div className="absolute top-2 left-2 z-10">
        <span className="text-[10px] font-mono text-neutral-500 bg-neutral-900/80 px-1.5 py-0.5 rounded">
          Spatial Domain
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: isDraggingSplit ? 'col-resize' : showBeforeAfter ? 'ew-resize' : 'default' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}
