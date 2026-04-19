/**
 * FFT Web Worker
 * Offloads heavy FFT/IFFT computation off the main thread.
 */

import { fft2d, ifft2d, recomputeMagnitudeWithMask } from './fft-engine';

export type WorkerRequest =
  | { type: 'fft'; data: Float32Array; width: number; height: number }
  | { type: 'ifft'; real: Float32Array; imag: Float32Array; mask: Float32Array; width: number; height: number; originalWidth: number; originalHeight: number }
  | { type: 'recomputeMagnitude'; real: Float32Array; imag: Float32Array; mask: Float32Array; width: number; height: number };

export type WorkerResponse =
  | { type: 'fft'; real: Float32Array; imag: Float32Array; magnitude: Float32Array; width: number; height: number; originalWidth: number; originalHeight: number }
  | { type: 'ifft'; result: Float32Array }
  | { type: 'recomputeMagnitude'; magnitude: Float32Array }
  | { type: 'error'; message: string };

const ctx = self as unknown as Worker;

ctx.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'fft': {
        const result = fft2d(msg.data, msg.width, msg.height);
        ctx.postMessage(
          {
            type: 'fft',
            real: result.real,
            imag: result.imag,
            magnitude: result.magnitude,
            width: result.width,
            height: result.height,
            originalWidth: result.originalWidth,
            originalHeight: result.originalHeight,
          } as WorkerResponse,
          // Transfer ownership for zero-copy
          [result.real.buffer, result.imag.buffer, result.magnitude.buffer] as unknown as Transferable[]
        );
        break;
      }
      case 'ifft': {
        const result = ifft2d(msg.real, msg.imag, msg.mask, msg.width, msg.height, msg.originalWidth, msg.originalHeight);
        ctx.postMessage(
          { type: 'ifft', result } as WorkerResponse,
          [result.buffer] as unknown as Transferable[]
        );
        break;
      }
      case 'recomputeMagnitude': {
        const magnitude = recomputeMagnitudeWithMask(msg.real, msg.imag, msg.mask, msg.width, msg.height);
        ctx.postMessage(
          { type: 'recomputeMagnitude', magnitude } as WorkerResponse,
          [magnitude.buffer] as unknown as Transferable[]
        );
        break;
      }
    }
  } catch (err) {
    ctx.postMessage({ type: 'error', message: String(err) } as WorkerResponse);
  }
});
