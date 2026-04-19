/**
 * Zustand Stores for SpectraForge
 * Surgical subscriptions — only affected components re-render.
 */

import { create } from 'zustand';
import type { DetectedSpike } from './spike-detector';

// --- Tool Types ---
export type ToolType = 'pan' | 'brush' | 'star' | 'eraser' | 'notch' | 'directional' | 'bandstop' | 'lasso';

// --- Image Store ---
export interface ImageState {
  original: ImageData | null;
  grayscale: Float32Array | null;
  width: number;
  height: number;
  fileName: string | null;

  // FFT data (lives in store after worker returns)
  spectrum: {
    real: Float32Array;
    imag: Float32Array;
    magnitude: Float32Array;
    fftWidth: number;
    fftHeight: number;
  } | null;

  // Result after IFFT
  result: Float32Array | null;

  // Processing state
  isProcessing: boolean;
  processingLabel: string;
  lastProcessingTime: number;

  setOriginal: (img: ImageData, name: string) => void;
  setGrayscale: (data: Float32Array, w: number, h: number) => void;
  setSpectrum: (real: Float32Array, imag: Float32Array, magnitude: Float32Array, fftW: number, fftH: number) => void;
  setResult: (data: Float32Array) => void;
  setProcessing: (processing: boolean, label?: string) => void;
  setProcessingTime: (ms: number) => void;
  updateMagnitude: (magnitude: Float32Array) => void;
  reset: () => void;
}

export const useImageStore = create<ImageState>((set) => ({
  original: null,
  grayscale: null,
  width: 0,
  height: 0,
  fileName: null,
  spectrum: null,
  result: null,
  isProcessing: false,
  processingLabel: '',
  lastProcessingTime: 0,

  setOriginal: (img, name) => set({ original: img, width: img.width, height: img.height, fileName: name }),
  setGrayscale: (data, w, h) => set({ grayscale: data, width: w, height: h }),
  setSpectrum: (real, imag, magnitude, fftW, fftH) =>
    set({ spectrum: { real, imag, magnitude, fftWidth: fftW, fftHeight: fftH } }),
  setResult: (data) => set({ result: data }),
  setProcessing: (processing, label = '') => set({ isProcessing: processing, processingLabel: label }),
  setProcessingTime: (ms) => set({ lastProcessingTime: ms }),
  updateMagnitude: (magnitude) =>
    set((state) => {
      if (!state.spectrum) return {};
      return { spectrum: { ...state.spectrum, magnitude } };
    }),
  reset: () =>
    set({
      original: null,
      grayscale: null,
      width: 0,
      height: 0,
      fileName: null,
      spectrum: null,
      result: null,
      isProcessing: false,
      processingLabel: '',
      lastProcessingTime: 0,
    }),
}));

// --- Tool Store ---
export interface ToolState {
  activeTool: ToolType;
  brushRadius: number;
  brushSoftness: number;
  starArms: number;
  starArmWidth: number;
  starRadius: number;
  starSoftness: number;
  notchRadius: number;
  bandInner: number;
  bandOuter: number;
  directionalAngle: number;
  directionalWidth: number;
  intensity: number; // blend 0-1

  setTool: (tool: ToolType) => void;
  setBrushRadius: (r: number) => void;
  setBrushSoftness: (s: number) => void;
  setStarArms: (n: number) => void;
  setStarArmWidth: (w: number) => void;
  setStarRadius: (r: number) => void;
  setStarSoftness: (s: number) => void;
  setNotchRadius: (r: number) => void;
  setBandInner: (r: number) => void;
  setBandOuter: (r: number) => void;
  setDirectionalAngle: (a: number) => void;
  setDirectionalWidth: (w: number) => void;
  setIntensity: (i: number) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'brush',
  brushRadius: 12,
  brushSoftness: 0.5,
  starArms: 6,
  starArmWidth: 0.15,
  starRadius: 40,
  starSoftness: 0.4,
  notchRadius: 8,
  bandInner: 40,
  bandOuter: 60,
  directionalAngle: 0,
  directionalWidth: 0.15,
  intensity: 1.0,

  setTool: (tool) => set({ activeTool: tool }),
  setBrushRadius: (r) => set({ brushRadius: r }),
  setBrushSoftness: (s) => set({ brushSoftness: s }),
  setStarArms: (n) => set({ starArms: n }),
  setStarArmWidth: (w) => set({ starArmWidth: w }),
  setStarRadius: (r) => set({ starRadius: r }),
  setStarSoftness: (s) => set({ starSoftness: s }),
  setNotchRadius: (r) => set({ notchRadius: r }),
  setBandInner: (r) => set({ bandInner: r }),
  setBandOuter: (r) => set({ bandOuter: r }),
  setDirectionalAngle: (a) => set({ directionalAngle: a }),
  setDirectionalWidth: (w) => set({ directionalWidth: w }),
  setIntensity: (i) => set({ intensity: i }),
}));

// --- Mask Store ---
export interface MaskState {
  mask: Float32Array | null;
  maskWidth: number;
  maskHeight: number;
  coverage: number;
  historyStack: Float32Array[];
  historyIndex: number;

  initMask: (w: number, h: number) => void;
  setMask: (mask: Float32Array) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  clearMask: () => void;
  setCoverage: (c: number) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useMaskStore = create<MaskState>((set, get) => ({
  mask: null,
  maskWidth: 0,
  maskHeight: 0,
  coverage: 0,
  historyStack: [],
  historyIndex: -1,

  initMask: (w, h) => {
    const mask = new Float32Array(w * h);
    set({ mask, maskWidth: w, maskHeight: h, coverage: 0, historyStack: [new Float32Array(mask)], historyIndex: 0 });
  },
  setMask: (mask) => set({ mask }),
  pushHistory: () => {
    const { mask, historyStack, historyIndex } = get();
    if (!mask) return;
    const newStack = historyStack.slice(0, historyIndex + 1);
    newStack.push(new Float32Array(mask));
    // Keep max 30 history entries
    if (newStack.length > 30) newStack.shift();
    set({ historyStack: newStack, historyIndex: newStack.length - 1 });
  },
  undo: () => {
    const { historyStack, historyIndex, maskWidth, maskHeight } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const restored = new Float32Array(historyStack[newIndex]);
    set({ mask: restored, historyIndex: newIndex, maskWidth, maskHeight });
  },
  redo: () => {
    const { historyStack, historyIndex, maskWidth, maskHeight } = get();
    if (historyIndex >= historyStack.length - 1) return;
    const newIndex = historyIndex + 1;
    const restored = new Float32Array(historyStack[newIndex]);
    set({ mask: restored, historyIndex: newIndex, maskWidth, maskHeight });
  },
  clearMask: () => {
    const { maskWidth, maskHeight } = get();
    if (maskWidth === 0) return;
    get().pushHistory();
    const mask = new Float32Array(maskWidth * maskHeight);
    set({ mask, coverage: 0 });
  },
  setCoverage: (c) => set({ coverage: c }),
  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().historyStack.length - 1,
}));

// --- Detection Store ---
export interface DetectionState {
  spikes: DetectedSpike[];
  noiseType: { type: string; description: string; confidence: number } | null;
  showBanner: boolean;
  isDetecting: boolean;

  setSpikes: (spikes: DetectedSpike[]) => void;
  setNoiseType: (t: { type: string; description: string; confidence: number } | null) => void;
  setShowBanner: (show: boolean) => void;
  setIsDetecting: (d: boolean) => void;
  dismissBanner: () => void;
}

export const useDetectionStore = create<DetectionState>((set) => ({
  spikes: [],
  noiseType: null,
  showBanner: false,
  isDetecting: false,

  setSpikes: (spikes) => set({ spikes }),
  setNoiseType: (t) => set({ noiseType: t, showBanner: t !== null }),
  setShowBanner: (show) => set({ showBanner: show }),
  setIsDetecting: (d) => set({ isDetecting: d }),
  dismissBanner: () => set({ showBanner: false }),
}));

// --- UI Store ---
export interface UIState {
  showBeforeAfter: boolean;
  beforeAfterPosition: number;
  spectrumZoom: number;
  spectrumPanX: number;
  spectrumPanY: number;
  spatialZoom: number;
  spatialPanX: number;
  spatialPanY: number;
  showOnboarding: boolean;
  selectedPreset: string | null;

  setShowBeforeAfter: (show: boolean) => void;
  setBeforeAfterPosition: (pos: number) => void;
  setSpectrumZoom: (z: number) => void;
  setSpectrumPan: (x: number, y: number) => void;
  setSpatialZoom: (z: number) => void;
  setSpatialPan: (x: number, y: number) => void;
  setShowOnboarding: (show: boolean) => void;
  setSelectedPreset: (preset: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  showBeforeAfter: false,
  beforeAfterPosition: 50,
  spectrumZoom: 1,
  spectrumPanX: 0,
  spectrumPanY: 0,
  spatialZoom: 1,
  spatialPanX: 0,
  spatialPanY: 0,
  showOnboarding: false,
  selectedPreset: null,

  setShowBeforeAfter: (show) => set({ showBeforeAfter: show }),
  setBeforeAfterPosition: (pos) => set({ beforeAfterPosition: pos }),
  setSpectrumZoom: (z) => set({ spectrumZoom: z }),
  setSpectrumPan: (x, y) => set({ spectrumPanX: x, spectrumPanY: y }),
  setSpatialZoom: (z) => set({ spatialZoom: z }),
  setSpatialPan: (x, y) => set({ spatialPanX: x, spatialPanY: y }),
  setShowOnboarding: (show) => set({ showOnboarding: show }),
  setSelectedPreset: (preset) => set({ selectedPreset: preset }),
}));
