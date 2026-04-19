'use client';

/**
 * SpectraForge — Main Editor Page
 */

import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useImageStore } from '@/lib/stores';
import { TopBar } from '@/components/top-bar';
import { Toolbar } from '@/components/toolbar';
import { SpatialCanvas } from '@/components/spatial-canvas';
import { SpectrumCanvas } from '@/components/spectrum-canvas';
import { PropertiesPanel } from '@/components/properties-panel';
import { StatusBar } from '@/components/status-bar';
import { DetectionBanner } from '@/components/detection-banner';
import { UploadZone } from '@/components/upload-zone';

export default function EditorPage() {
  const hasImage = useImageStore((s) => !!s.spectrum);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-screen w-screen flex flex-col bg-neutral-950 text-neutral-200 overflow-hidden select-none">
        <TopBar />

        {hasImage ? (
          <>
            <DetectionBanner />
            <div className="flex flex-1 min-h-0">
              <Toolbar />
              <div className="flex-1 flex min-w-0">
                {/* Dual-pane viewport */}
                <SpatialCanvas />
                <div className="w-px bg-neutral-800 shrink-0" />
                <SpectrumCanvas />
              </div>
              <PropertiesPanel />
            </div>
            <StatusBar />
          </>
        ) : (
          <UploadZone />
        )}
      </div>
    </TooltipProvider>
  );
}
