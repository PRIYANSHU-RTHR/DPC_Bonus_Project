/**
 * Mask Engine
 * Handles brush painting, star brush generation, and mask operations.
 */

// --- Smoothstep utility ---
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// --- Circular Brush ---
export function applyCircularBrush(
  mask: Float32Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  softness: number,
  erase: boolean
): void {
  const r = Math.ceil(radius);
  const feather = radius * softness;

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const px = Math.round(cx) + dx;
      const py = Math.round(cy) + dy;
      if (px < 0 || px >= width || py < 0 || py >= height) continue;

      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;

      const featherStart = radius - feather;
      const value = 1 - smoothstep(featherStart, radius, dist);

      const idx = py * width + px;
      if (erase) {
        mask[idx] = Math.max(0, mask[idx] - value);
      } else {
        mask[idx] = Math.min(1, Math.max(mask[idx], value));
      }

      // Apply conjugate symmetry
      const mirrorX = width - 1 - px;
      const mirrorY = height - 1 - py;
      if (mirrorX >= 0 && mirrorX < width && mirrorY >= 0 && mirrorY < height) {
        const mirrorIdx = mirrorY * width + mirrorX;
        if (erase) {
          mask[mirrorIdx] = Math.max(0, mask[mirrorIdx] - value);
        } else {
          mask[mirrorIdx] = Math.min(1, Math.max(mask[mirrorIdx], value));
        }
      }
    }
  }
}

// --- Star Brush ---
export function applyStarBrush(
  mask: Float32Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  params: {
    arms: number;
    radius: number;
    armWidth: number;  // radians
    softness: number;
    rotation?: number; // radians, offset rotation
  }
): void {
  const { arms, radius, armWidth, softness, rotation = 0 } = params;
  const r = Math.ceil(radius * 1.2);

  // Precompute arm angles
  const armAngles = Array.from({ length: arms }, (_, k) => (k * Math.PI * 2) / arms + rotation);

  const applyAt = (centerX: number, centerY: number) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = Math.round(centerX) + dx;
        const py = Math.round(centerY) + dy;
        if (px < 0 || px >= width || py < 0 || py >= height) continue;

        const ddx = px - centerX;
        const ddy = py - centerY;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist > radius * 1.2) continue;
        if (dist < 2) {
          // Always mask the center point
          mask[py * width + px] = 1;
          continue;
        }

        const theta = Math.atan2(ddy, ddx);

        // Find best arm match (angular proximity)
        let maxArmWeight = 0;
        for (const armAngle of armAngles) {
          let delta = Math.abs(theta - armAngle);
          delta = Math.min(delta, 2 * Math.PI - delta);
          const weight = Math.exp(-(delta * delta) / (2 * armWidth * armWidth));
          maxArmWeight = Math.max(maxArmWeight, weight);
        }

        // Radial falloff
        const featherStart = radius * (1 - softness);
        const radialWeight = 1 - smoothstep(featherStart, radius, dist);

        const value = maxArmWeight * radialWeight;
        if (value > 0.01) {
          const idx = py * width + px;
          mask[idx] = Math.min(1, Math.max(mask[idx], value));
        }
      }
    }
  };

  // Apply at click position
  applyAt(cx, cy);

  // Apply at conjugate-symmetric position
  const mirrorX = width - 1 - cx;
  const mirrorY = height - 1 - cy;
  applyAt(mirrorX, mirrorY);
}

// --- Generate star brush preview shape (for cursor) ---
export function generateStarPreview(
  arms: number,
  radius: number,
  armWidth: number,
  softness: number,
  size: number
): ImageData {
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(size, size)
    : null;
  
  if (!canvas) {
    return new ImageData(size, size);
  }

  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(size, size);
  const cx = size / 2;
  const cy = size / 2;
  const scale = (size / 2) / radius;

  const armAngles = Array.from({ length: arms }, (_, k) => (k * Math.PI * 2) / arms);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) / scale;
      const dy = (y - cy) / scale;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;

      const theta = Math.atan2(dy, dx);
      let maxWeight = 0;
      for (const angle of armAngles) {
        let delta = Math.abs(theta - angle);
        delta = Math.min(delta, 2 * Math.PI - delta);
        maxWeight = Math.max(maxWeight, Math.exp(-(delta * delta) / (2 * armWidth * armWidth)));
      }

      const featherStart = radius * (1 - softness);
      const radial = 1 - smoothstep(featherStart, radius, dist);
      const value = maxWeight * radial;

      const idx = (y * size + x) * 4;
      imageData.data[idx] = 255;
      imageData.data[idx + 1] = 255;
      imageData.data[idx + 2] = 255;
      imageData.data[idx + 3] = Math.floor(value * 180);
    }
  }

  return imageData;
}

// --- Notch Filter ---
export function applyNotchFilter(
  mask: Float32Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  softness: number
): void {
  applyCircularBrush(mask, width, height, cx, cy, radius, softness, false);
}

// --- Band-stop (ring) filter ---
export function applyBandStopFilter(
  mask: Float32Array,
  width: number,
  height: number,
  innerRadius: number,
  outerRadius: number,
  softness: number
): void {
  const centerX = width / 2;
  const centerY = height / 2;
  const feather = (outerRadius - innerRadius) * softness * 0.5;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let value = 0;
      if (dist >= innerRadius && dist <= outerRadius) {
        const innerFade = smoothstep(innerRadius - feather, innerRadius + feather, dist);
        const outerFade = 1 - smoothstep(outerRadius - feather, outerRadius + feather, dist);
        value = innerFade * outerFade;
      }

      if (value > 0.01) {
        const idx = y * width + x;
        mask[idx] = Math.min(1, Math.max(mask[idx], value));
      }
    }
  }
}

// --- Directional filter (angular wedge) ---
export function applyDirectionalFilter(
  mask: Float32Array,
  width: number,
  height: number,
  angle: number,      // radians, 0 = horizontal
  angularWidth: number, // radians
  softness: number,
  dcExcludeRadius: number = 10
): void {
  const centerX = width / 2;
  const centerY = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < dcExcludeRadius) continue;

      const theta = Math.atan2(dy, dx);

      // Check both directions (the filter should be symmetric)
      let delta1 = Math.abs(theta - angle);
      delta1 = Math.min(delta1, 2 * Math.PI - delta1);

      let delta2 = Math.abs(theta - (angle + Math.PI));
      delta2 = Math.min(delta2, 2 * Math.PI - delta2);

      const delta = Math.min(delta1, delta2);
      const featherAngle = angularWidth * softness;

      let value = 0;
      if (delta < angularWidth) {
        value = 1 - smoothstep(angularWidth - featherAngle, angularWidth, delta);
      }

      if (value > 0.01) {
        const idx = y * width + x;
        mask[idx] = Math.min(1, Math.max(mask[idx], value));
      }
    }
  }
}

// --- Clear mask ---
export function clearMask(mask: Float32Array): void {
  mask.fill(0);
}

// --- Compute mask coverage ---
export function getMaskCoverage(mask: Float32Array): number {
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 0.01) count++;
  }
  return count / mask.length;
}
