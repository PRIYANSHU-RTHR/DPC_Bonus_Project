'use client';

/**
 * Toolbar — Left-side vertical tool palette
 */

import React from 'react';
import {
  Move,
  Circle,
  Sparkles,
  Eraser,
  Target,
  ArrowUpDown,
  CircleDot,
  Undo2,
  Redo2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useToolStore, useMaskStore, type ToolType } from '@/lib/stores';
import { runInverseFFT } from '@/lib/pipeline';
import { cn } from '@/lib/utils';

interface ToolItem {
  id: ToolType;
  icon: React.ElementType;
  label: string;
  shortcut: string;
}

const tools: ToolItem[] = [
  { id: 'pan', icon: Move, label: 'Pan / Zoom', shortcut: 'Space' },
  { id: 'brush', icon: Circle, label: 'Brush', shortcut: 'B' },
  { id: 'star', icon: Sparkles, label: 'Star Brush', shortcut: 'S' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', shortcut: 'E' },
  { id: 'notch', icon: Target, label: 'Notch Filter', shortcut: 'N' },
  { id: 'directional', icon: ArrowUpDown, label: 'Directional Filter', shortcut: 'D' },
  { id: 'bandstop', icon: CircleDot, label: 'Band-Stop Filter', shortcut: 'R' },
];

export function Toolbar() {
  const activeTool = useToolStore((s) => s.activeTool);
  const setTool = useToolStore((s) => s.setTool);
  const undo = useMaskStore((s) => s.undo);
  const redo = useMaskStore((s) => s.redo);
  const clearMask = useMaskStore((s) => s.clearMask);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      const toolMap: Record<string, ToolType> = {
        b: 'brush',
        s: 'star',
        e: 'eraser',
        n: 'notch',
        d: 'directional',
        r: 'bandstop',
      };
      if (toolMap[key]) {
        setTool(toolMap[key]);
        e.preventDefault();
      }
      if (e.ctrlKey && key === 'z' && !e.shiftKey) {
        if (useMaskStore.getState().canUndo()) {
          undo();
          runInverseFFT().catch(console.error);
        }
        e.preventDefault();
      }
      if (e.ctrlKey && (key === 'y' || (key === 'z' && e.shiftKey))) {
        if (useMaskStore.getState().canRedo()) {
          redo();
          runInverseFFT().catch(console.error);
        }
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, undo, redo]);

  return (
    <div className="flex flex-col items-center gap-0.5 py-2 px-1 bg-neutral-900 border-r border-neutral-800 w-11 shrink-0">
      {tools.map((tool) => (
        <Tooltip key={tool.id} delayDuration={200}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-md transition-all',
                activeTool === tool.id
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              )}
              onClick={() => setTool(tool.id)}
            >
              <tool.icon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <span>{tool.label}</span>
            <kbd className="text-[10px] bg-neutral-700 px-1.5 py-0.5 rounded font-mono">
              {tool.shortcut}
            </kbd>
          </TooltipContent>
        </Tooltip>
      ))}

      <Separator className="my-1.5 bg-neutral-700 w-6" />

      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800"
            onClick={() => {
               if (useMaskStore.getState().canUndo()) {
                 undo();
                 runInverseFFT().catch(console.error);
               }
            }}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <span>Undo</span>
          <kbd className="ml-2 text-[10px] bg-neutral-700 px-1.5 py-0.5 rounded font-mono">Ctrl+Z</kbd>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800"
            onClick={() => {
               if (useMaskStore.getState().canRedo()) {
                 redo();
                 runInverseFFT().catch(console.error);
               }
            }}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <span>Redo</span>
          <kbd className="ml-2 text-[10px] bg-neutral-700 px-1.5 py-0.5 rounded font-mono">Ctrl+Y</kbd>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800"
            onClick={() => {
              clearMask();
              runInverseFFT().catch(console.error);
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Reset mask</TooltipContent>
      </Tooltip>
    </div>
  );
}
