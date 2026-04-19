/**
 * Preset Engine
 * Pre-configured filter pipelines for common noise types.
 */

import {
  applyCircularBrush,
  applyDirectionalFilter,
  applyBandStopFilter,
} from './mask-engine';
import { detectSpikes } from './spike-detector';

export interface Preset {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  apply: (mask: Float32Array, magnitude: Float32Array, width: number, height: number) => void;
}

export const presets: Preset[] = [
  {
    id: 'moire',
    name: 'Moire Removal',
    description: 'Remove grid-like interference patterns from scanned halftones',
    icon: 'Grid3x3',
    apply: (mask, magnitude, width, height) => {
      // Detect spikes and auto-remove them
      const spikes = detectSpikes(magnitude, width, height, {
        threshold: 0.3,
        windowSize: 5,
        maxSpikes: 30,
      });
      for (const spike of spikes) {
        applyCircularBrush(mask, width, height, spike.x, spike.y, 6, 0.5, false);
      }
    },
  },
  {
    id: 'scanlines',
    name: 'Scan Line Cleanup',
    description: 'Remove horizontal banding from flatbed scans',
    icon: 'ScanLine',
    apply: (mask, _magnitude, width, height) => {
      // Horizontal scan lines appear as vertical spikes in spectrum
      applyDirectionalFilter(mask, width, height, Math.PI / 2, 0.08, 0.5, Math.min(width, height) * 0.04);
    },
  },
  {
    id: 'fabric',
    name: 'Pattern Removal',
    description: 'Remove repeating fabric or textile textures',
    icon: 'Layers',
    apply: (mask, magnitude, width, height) => {
      // Aggressive spike removal for fabric patterns
      const spikes = detectSpikes(magnitude, width, height, {
        threshold: 0.25,
        windowSize: 5,
        maxSpikes: 40,
      });
      for (const spike of spikes) {
        applyCircularBrush(mask, width, height, spike.x, spike.y, 10, 0.6, false);
      }
    },
  },
  {
    id: 'document',
    name: 'Document Cleanup',
    description: 'Clean scanned documents for better OCR readability',
    icon: 'FileText',
    apply: (mask, magnitude, width, height) => {
      // Remove mid-to-high frequency noise while preserving text edges
      const spikes = detectSpikes(magnitude, width, height, {
        threshold: 0.4,
        windowSize: 7,
        maxSpikes: 15,
      });
      for (const spike of spikes) {
        applyCircularBrush(mask, width, height, spike.x, spike.y, 5, 0.7, false);
      }
      // Gentle high-frequency rolloff
      const outerR = Math.min(width, height) * 0.48;
      const innerR = outerR * 0.85;
      applyBandStopFilter(mask, width, height, innerR, outerR, 0.8);
    },
  },
  {
    id: 'vertical_lines',
    name: 'Vertical Line Removal',
    description: 'Remove vertical striping artifacts',
    icon: 'Columns3',
    apply: (mask, _magnitude, width, height) => {
      applyDirectionalFilter(mask, width, height, 0, 0.08, 0.5, Math.min(width, height) * 0.04);
    },
  },
  {
    id: 'auto',
    name: 'Auto Clean',
    description: 'Automatically detect and remove all periodic noise',
    icon: 'Sparkles',
    apply: (mask, magnitude, width, height) => {
      const spikes = detectSpikes(magnitude, width, height, {
        threshold: 0.3,
        windowSize: 5,
        maxSpikes: 30,
      });
      for (const spike of spikes) {
        applyCircularBrush(mask, width, height, spike.x, spike.y, 8, 0.5, false);
      }
    },
  },
];

export function getPresetById(id: string): Preset | undefined {
  return presets.find(p => p.id === id);
}
