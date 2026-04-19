/**
 * Spike Detection Engine
 * Detects periodic noise peaks in the FFT magnitude spectrum.
 * Uses local-maxima finding with median-based thresholding.
 */

export interface DetectedSpike {
  x: number;
  y: number;
  intensity: number;
  mirrorX: number;
  mirrorY: number;
  label: string;
}

/**
 * Detect prominent frequency spikes in the magnitude spectrum.
 * Excludes the DC region (center) and finds symmetric pairs.
 */
export function detectSpikes(
  magnitude: Float32Array,
  width: number,
  height: number,
  options: {
    dcRadius?: number;      // Radius around DC to exclude
    windowSize?: number;    // Local neighborhood for peak detection
    threshold?: number;     // Min intensity (0-1) to qualify as spike
    maxSpikes?: number;     // Max number of spikes to return
  } = {}
): DetectedSpike[] {
  const {
    dcRadius = Math.min(width, height) * 0.05,
    windowSize = 7,
    threshold = 0.35,
    maxSpikes = 20,
  } = options;

  const cx = width / 2;
  const cy = height / 2;
  const half = Math.floor(windowSize / 2);

  const candidates: DetectedSpike[] = [];

  // Scan for local maxima
  for (let y = half; y < height - half; y++) {
    for (let x = half; x < width - half; x++) {
      // Skip DC region
      const dx = x - cx;
      const dy = y - cy;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      if (distFromCenter < dcRadius) continue;

      const val = magnitude[y * width + x];
      if (val < threshold) continue;

      // Check if local maximum
      let isMax = true;
      for (let ky = -half; ky <= half && isMax; ky++) {
        for (let kx = -half; kx <= half && isMax; kx++) {
          if (kx === 0 && ky === 0) continue;
          if (magnitude[(y + ky) * width + (x + kx)] >= val) {
            isMax = false;
          }
        }
      }

      if (isMax) {
        // Only add one from each symmetric pair (top-half or left-half)
        const mirrorX = width - 1 - x;
        const mirrorY = height - 1 - y;

        // Keep only the one in the "upper" half to avoid duplicates
        if (y < cy || (y === Math.floor(cy) && x < cx)) {
          candidates.push({
            x,
            y,
            intensity: val,
            mirrorX,
            mirrorY,
            label: `Peak at (${x - Math.floor(cx)}, ${y - Math.floor(cy)})`,
          });
        }
      }
    }
  }

  // Sort by intensity (strongest first)
  candidates.sort((a, b) => b.intensity - a.intensity);

  return candidates.slice(0, maxSpikes);
}

/**
 * Analyze detected spikes and classify the noise type
 */
export function classifyNoise(
  spikes: DetectedSpike[],
  width: number,
  height: number
): { type: string; description: string; confidence: number } | null {
  if (spikes.length === 0) return null;

  const cx = width / 2;
  const cy = height / 2;

  // Check if spikes are primarily horizontal (along x-axis)
  const horizontalSpikes = spikes.filter(s => {
    const dy = Math.abs(s.y - cy);
    return dy < height * 0.05;
  });

  // Check if spikes are primarily vertical (along y-axis)  
  const verticalSpikes = spikes.filter(s => {
    const dx = Math.abs(s.x - cx);
    return dx < width * 0.05;
  });

  // Check for grid-like pattern (spikes at grid intersections)
  const hasGrid = spikes.length >= 4 &&
    horizontalSpikes.length >= 1 &&
    verticalSpikes.length >= 1;

  if (hasGrid) {
    return {
      type: 'moire',
      description: 'Grid-like interference pattern detected. Likely moire or halftone noise.',
      confidence: Math.min(0.95, spikes[0].intensity),
    };
  }

  if (horizontalSpikes.length > spikes.length * 0.6) {
    return {
      type: 'horizontal_lines',
      description: 'Horizontal banding or scan line artifacts detected.',
      confidence: Math.min(0.9, spikes[0].intensity),
    };
  }

  if (verticalSpikes.length > spikes.length * 0.6) {
    return {
      type: 'vertical_lines',
      description: 'Vertical striping or interference lines detected.',
      confidence: Math.min(0.9, spikes[0].intensity),
    };
  }

  if (spikes.length >= 2) {
    return {
      type: 'periodic',
      description: 'Periodic noise pattern detected in the frequency spectrum.',
      confidence: Math.min(0.85, spikes[0].intensity),
    };
  }

  return null;
}
