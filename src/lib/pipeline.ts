/**
 * FFT Processing Pipeline Controller
 * Manages the full workflow: image → FFT → edit → IFFT → output
 * Handles Web Worker lifecycle and message passing.
 */

import { useImageStore, useMaskStore, useDetectionStore } from './stores';
import { detectSpikes, classifyNoise } from './spike-detector';
import { getMaskCoverage } from './mask-engine';
import type { WorkerResponse } from './fft-worker';

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./fft-worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

/**
 * Convert ImageData to grayscale Float32Array (luminance)
 */
export function imageToGrayscale(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // ITU-R BT.601 luminance
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

/**
 * Convert grayscale Float32Array back to ImageData
 */
export function grayscaleToImageData(
  gray: Float32Array,
  width: number,
  height: number
): ImageData {
  const imageData = new ImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    const v = Math.max(0, Math.min(255, Math.round(gray[i])));
    imageData.data[i * 4] = v;
    imageData.data[i * 4 + 1] = v;
    imageData.data[i * 4 + 2] = v;
    imageData.data[i * 4 + 3] = 255;
  }
  return imageData;
}

/**
 * Run forward FFT on the loaded image
 */
export function runForwardFFT(): Promise<void> {
  return new Promise((resolve, reject) => {
    const store = useImageStore.getState();
    if (!store.grayscale) {
      reject(new Error('No image loaded'));
      return;
    }

    store.setProcessing(true, 'Computing FFT...');
    const startTime = performance.now();

    const w = getWorker();
    const data = new Float32Array(store.grayscale);

    const handler = (e: MessageEvent<WorkerResponse>) => {
      w.removeEventListener('message', handler);
      if (e.data.type === 'fft') {
        const elapsed = performance.now() - startTime;
        store.setSpectrum(e.data.real, e.data.imag, e.data.magnitude, e.data.width, e.data.height);
        store.setProcessingTime(Math.round(elapsed));
        store.setProcessing(false);

        // Initialize mask
        useMaskStore.getState().initMask(e.data.width, e.data.height);

        // Run spike detection
        runSpikeDetection(e.data.magnitude, e.data.width, e.data.height);

        resolve();
      } else if (e.data.type === 'error') {
        store.setProcessing(false);
        reject(new Error(e.data.message));
      }
    };

    w.addEventListener('message', handler);
    w.postMessage(
      { type: 'fft', data, width: store.width, height: store.height },
      [data.buffer]
    );
  });
}

/**
 * Run inverse FFT with current mask
 */
export function runInverseFFT(): Promise<void> {
  return new Promise((resolve, reject) => {
    const imgStore = useImageStore.getState();
    const maskStore = useMaskStore.getState();

    if (!imgStore.spectrum || !maskStore.mask) {
      reject(new Error('No spectrum or mask'));
      return;
    }

    imgStore.setProcessing(true, 'Reconstructing...');
    const startTime = performance.now();

    const w = getWorker();
    const { real, imag, fftWidth, fftHeight } = imgStore.spectrum;
    const mask = maskStore.mask;

    // Copy arrays (they get transferred)
    const realCopy = new Float32Array(real);
    const imagCopy = new Float32Array(imag);
    const maskCopy = new Float32Array(mask);

    const handler = (e: MessageEvent<WorkerResponse>) => {
      w.removeEventListener('message', handler);
      if (e.data.type === 'ifft') {
        const elapsed = performance.now() - startTime;
        imgStore.setResult(e.data.result);
        imgStore.setProcessingTime(Math.round(elapsed));
        imgStore.setProcessing(false);

        // Update mask coverage
        maskStore.setCoverage(getMaskCoverage(maskStore.mask!));

        resolve();
      } else if (e.data.type === 'error') {
        imgStore.setProcessing(false);
        reject(new Error(e.data.message));
      }
    };

    w.addEventListener('message', handler);
    w.postMessage(
      {
        type: 'ifft',
        real: realCopy,
        imag: imagCopy,
        mask: maskCopy,
        width: fftWidth,
        height: fftHeight,
        originalWidth: imgStore.width,
        originalHeight: imgStore.height,
      },
      [realCopy.buffer, imagCopy.buffer, maskCopy.buffer]
    );
  });
}

/**
 * Run spike detection on magnitude spectrum
 */
function runSpikeDetection(magnitude: Float32Array, width: number, height: number): void {
  const detStore = useDetectionStore.getState();
  detStore.setIsDetecting(true);

  // Run detection (synchronous, fast enough)
  const spikes = detectSpikes(magnitude, width, height);
  const noiseType = classifyNoise(spikes, width, height);

  detStore.setSpikes(spikes);
  detStore.setNoiseType(noiseType);
  detStore.setIsDetecting(false);
}

/**
 * Load and process an image file
 */
export async function loadImageFile(file: File): Promise<void> {
  const store = useImageStore.getState();
  store.setProcessing(true, 'Loading image...');

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(url);

      // Limit dimensions for performance
      let w = img.width;
      let h = img.height;
      const maxDim = 2048;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);

      store.setOriginal(imageData, file.name);
      const grayscale = imageToGrayscale(imageData);
      store.setGrayscale(grayscale, w, h);

      try {
        await runForwardFFT();
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      store.setProcessing(false);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Export the processed image
 */
export function exportImage(format: 'png' | 'jpeg' | 'webp', quality: number = 0.92): void {
  const store = useImageStore.getState();
  const data = store.result || store.grayscale;
  if (!data) return;

  const imageData = grayscaleToImageData(data, store.width, store.height);
  const canvas = document.createElement('canvas');
  canvas.width = store.width;
  canvas.height = store.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);

  const mimeType = `image/${format}`;
  const link = document.createElement('a');
  link.download = `spectraforge-output.${format}`;
  link.href = canvas.toDataURL(mimeType, quality);
  link.click();
}

/**
 * Cleanup worker on app unmount
 */
export function cleanupWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
