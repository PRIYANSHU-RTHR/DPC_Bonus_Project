/**
 * Pure-JS 2D FFT Engine
 * Implements Cooley-Tukey radix-2 FFT for real-time image processing.
 * Operates on Float32Arrays for performance.
 */

// --- 1D FFT (Cooley-Tukey, in-place, radix-2) ---

function fft1d(real: Float32Array, imag: Float32Array, invert: boolean): void {
  const n = real.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  // Butterfly stages
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (2 * Math.PI) / len * (invert ? -1 : 1);
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let curReal = 1;
      let curImag = 0;
      for (let j = 0; j < len / 2; j++) {
        const uR = real[i + j];
        const uI = imag[i + j];
        const vR = real[i + j + len / 2] * curReal - imag[i + j + len / 2] * curImag;
        const vI = real[i + j + len / 2] * curImag + imag[i + j + len / 2] * curReal;

        real[i + j] = uR + vR;
        imag[i + j] = uI + vI;
        real[i + j + len / 2] = uR - vR;
        imag[i + j + len / 2] = uI - vI;

        const tmpReal = curReal * wReal - curImag * wImag;
        curImag = curReal * wImag + curImag * wReal;
        curReal = tmpReal;
      }
    }
  }

  if (invert) {
    for (let i = 0; i < n; i++) {
      real[i] /= n;
      imag[i] /= n;
    }
  }
}

// --- Utility: next power of 2 ---
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// --- 2D FFT (row-column decomposition) ---

export interface FFTResult {
  real: Float32Array;
  imag: Float32Array;
  magnitude: Float32Array;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

/**
 * Applies a Hann window to reduce edge discontinuity artifacts
 */
function applyHannWindow2D(
  data: Float32Array,
  width: number,
  height: number
): Float32Array {
  const result = new Float32Array(data.length);
  for (let y = 0; y < height; y++) {
    const wy = 0.5 * (1 - Math.cos((2 * Math.PI * y) / (height - 1)));
    for (let x = 0; x < width; x++) {
      const wx = 0.5 * (1 - Math.cos((2 * Math.PI * x) / (width - 1)));
      result[y * width + x] = data[y * width + x] * wx * wy;
    }
  }
  return result;
}

/**
 * Compute forward 2D FFT with fftshift (DC in center)
 */
export function fft2d(
  input: Float32Array,
  inputWidth: number,
  inputHeight: number
): FFTResult {
  const width = nextPow2(inputWidth);
  const height = nextPow2(inputHeight);
  const size = width * height;

  // Pad and apply Hann window
  const padded = new Float32Array(size);
  for (let y = 0; y < inputHeight; y++) {
    for (let x = 0; x < inputWidth; x++) {
      padded[y * width + x] = input[y * inputWidth + x];
    }
  }

  const windowed = padded; // Removed applyHannWindow2D to prevent boundary corruption on IFFT
  const real = new Float32Array(windowed);
  const imag = new Float32Array(size);

  // Row-wise FFT
  const rowR = new Float32Array(width);
  const rowI = new Float32Array(width);
  for (let y = 0; y < height; y++) {
    const offset = y * width;
    rowR.set(real.subarray(offset, offset + width));
    rowI.fill(0);
    fft1d(rowR, rowI, false);
    real.set(rowR, offset);
    imag.set(rowI, offset);
  }

  // Column-wise FFT
  const colR = new Float32Array(height);
  const colI = new Float32Array(height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      colR[y] = real[y * width + x];
      colI[y] = imag[y * width + x];
    }
    fft1d(colR, colI, false);
    for (let y = 0; y < height; y++) {
      real[y * width + x] = colR[y];
      imag[y * width + x] = colI[y];
    }
  }

  // FFT Shift (move DC to center)
  fftShift(real, width, height);
  fftShift(imag, width, height);

  // Compute log-magnitude for display
  const magnitude = computeLogMagnitude(real, imag, width, height);

  return { real, imag, magnitude, width, height, originalWidth: inputWidth, originalHeight: inputHeight };
}

/**
 * Compute inverse 2D FFT with mask applied
 */
export function ifft2d(
  real: Float32Array,
  imag: Float32Array,
  mask: Float32Array,
  width: number,
  height: number,
  originalWidth: number,
  originalHeight: number
): Float32Array {
  const size = width * height;

  // Apply mask (suppress masked frequencies)
  const maskedReal = new Float32Array(size);
  const maskedImag = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const suppress = 1 - mask[i]; // mask=1 means fully suppress
    maskedReal[i] = real[i] * suppress;
    maskedImag[i] = imag[i] * suppress;
  }

  // Inverse FFT Shift
  fftShift(maskedReal, width, height);
  fftShift(maskedImag, width, height);

  // Column-wise IFFT
  const colR = new Float32Array(height);
  const colI = new Float32Array(height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      colR[y] = maskedReal[y * width + x];
      colI[y] = maskedImag[y * width + x];
    }
    fft1d(colR, colI, true);
    for (let y = 0; y < height; y++) {
      maskedReal[y * width + x] = colR[y];
      maskedImag[y * width + x] = colI[y];
    }
  }

  // Row-wise IFFT
  const rowR = new Float32Array(width);
  const rowI = new Float32Array(width);
  for (let y = 0; y < height; y++) {
    const offset = y * width;
    rowR.set(maskedReal.subarray(offset, offset + width));
    rowI.set(maskedImag.subarray(offset, offset + width));
    fft1d(rowR, rowI, true);
    maskedReal.set(rowR, offset);
  }

  // Extract original dimensions
  const result = new Float32Array(originalWidth * originalHeight);
  for (let y = 0; y < originalHeight; y++) {
    for (let x = 0; x < originalWidth; x++) {
      result[y * originalWidth + x] = maskedReal[y * width + x];
    }
  }

  return result;
}

/**
 * Swap quadrants for centered display
 */
function fftShift(data: Float32Array, width: number, height: number): void {
  const halfW = width >> 1;
  const halfH = height >> 1;

  for (let y = 0; y < halfH; y++) {
    for (let x = 0; x < halfW; x++) {
      const i1 = y * width + x;
      const i2 = (y + halfH) * width + (x + halfW);
      [data[i1], data[i2]] = [data[i2], data[i1]];
    }
    for (let x = halfW; x < width; x++) {
      const i1 = y * width + x;
      const i2 = (y + halfH) * width + (x - halfW);
      [data[i1], data[i2]] = [data[i2], data[i1]];
    }
  }
}

/**
 * Compute log-magnitude spectrum, normalized to [0, 1]
 */
function computeLogMagnitude(
  real: Float32Array,
  imag: Float32Array,
  width: number,
  height: number
): Float32Array {
  const size = width * height;
  const mag = new Float32Array(size);
  let max = 0;

  for (let i = 0; i < size; i++) {
    mag[i] = Math.log(1 + Math.sqrt(real[i] * real[i] + imag[i] * imag[i]));
    if (mag[i] > max) max = mag[i];
  }

  if (max > 0) {
    for (let i = 0; i < size; i++) {
      mag[i] /= max;
    }
  }

  return mag;
}

/**
 * Recompute magnitude after mask edit (for display update without full IFFT)
 */
export function recomputeMagnitudeWithMask(
  real: Float32Array,
  imag: Float32Array,
  mask: Float32Array,
  width: number,
  height: number
): Float32Array {
  const size = width * height;
  const mag = new Float32Array(size);
  let max = 0;

  for (let i = 0; i < size; i++) {
    const suppress = 1 - mask[i];
    const r = real[i] * suppress;
    const im = imag[i] * suppress;
    mag[i] = Math.log(1 + Math.sqrt(r * r + im * im));
    if (mag[i] > max) max = mag[i];
  }

  if (max > 0) {
    for (let i = 0; i < size; i++) {
      mag[i] /= max;
    }
  }

  return mag;
}
