'use client';

/**
 * Top Bar — Header with logo, actions, and export controls
 */

import React, { useCallback } from 'react';
import {
  Download,
  Upload,
  SplitSquareHorizontal,
  Loader2,
  Settings,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useImageStore, useUIStore } from '@/lib/stores';
import { loadImageFile, exportImage } from '@/lib/pipeline';

export function TopBar() {
  const isProcessing = useImageStore((s) => s.isProcessing);
  const processingLabel = useImageStore((s) => s.processingLabel);
  const fileName = useImageStore((s) => s.fileName);
  const hasImage = useImageStore((s) => !!s.grayscale);
  const showBeforeAfter = useUIStore((s) => s.showBeforeAfter);
  const setShowBeforeAfter = useUIStore((s) => s.setShowBeforeAfter);

  const handleFileUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          await loadImageFile(file);
        } catch (err) {
          console.error('Failed to load image:', err);
        }
      }
    };
    input.click();
  }, []);

  return (
    <div className="flex items-center justify-between h-10 px-3 bg-neutral-900 border-b border-neutral-800 shrink-0">
      {/* Left: Logo */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-neutral-300" />
          <span className="text-sm font-semibold tracking-tight text-neutral-200">
            SpectraForge
          </span>
        </div>
        {fileName && (
          <span className="text-[11px] text-neutral-500 ml-2 max-w-48 truncate">
            {fileName}
          </span>
        )}
        {isProcessing && (
          <div className="flex items-center gap-1.5 ml-3 text-xs text-neutral-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{processingLabel}</span>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-neutral-400 hover:text-white"
              onClick={handleFileUpload}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              <span className="text-xs">Open</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open an image file</TooltipContent>
        </Tooltip>

        {hasImage && (
          <>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 text-xs ${
                    showBeforeAfter
                      ? 'text-white bg-neutral-700'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  onClick={() => setShowBeforeAfter(!showBeforeAfter)}
                >
                  <SplitSquareHorizontal className="h-3.5 w-3.5 mr-1.5" />
                  Compare
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle before/after split view</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-neutral-400 hover:text-white"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  <span className="text-xs">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-neutral-900 border-neutral-700">
                <DropdownMenuItem onClick={() => exportImage('png')} className="text-xs">
                  Export as PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportImage('jpeg', 0.95)} className="text-xs">
                  Export as JPEG (95%)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportImage('webp', 0.9)} className="text-xs">
                  Export as WebP (90%)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
