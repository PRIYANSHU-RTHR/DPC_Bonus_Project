'use client';

/**
 * Upload Zone — Landing state with drag-and-drop
 */

import React, { useCallback, useState } from 'react';
import { Upload, ImageIcon } from 'lucide-react';
import { loadImageFile } from '@/lib/pipeline';

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    try {
      await loadImageFile(file);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  }, [handleFile]);

  // Handle paste
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          return;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFile]);

  return (
    <div className="flex-1 flex items-center justify-center bg-neutral-950 p-8">
      <div
        className={`
          relative flex flex-col items-center justify-center
          w-full max-w-lg aspect-[4/3]
          border-2 border-dashed rounded-xl
          transition-all duration-200 cursor-pointer
          ${isDragging
            ? 'border-neutral-400 bg-neutral-800/30'
            : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-900/50'
          }
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center">
            {isDragging ? (
              <Upload className="h-5 w-5 text-neutral-300" />
            ) : (
              <ImageIcon className="h-5 w-5 text-neutral-400" />
            )}
          </div>
          <div>
            <p className="text-sm text-neutral-300 font-medium">
              {isDragging ? 'Drop your image here' : 'Drop an image to begin'}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              or click to browse. You can also paste from clipboard.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-neutral-600">
            <span>PNG</span>
            <span className="text-neutral-700">/</span>
            <span>JPEG</span>
            <span className="text-neutral-700">/</span>
            <span>WebP</span>
            <span className="text-neutral-700">/</span>
            <span>BMP</span>
          </div>
        </div>
        {error && (
          <p className="absolute bottom-4 text-xs text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
