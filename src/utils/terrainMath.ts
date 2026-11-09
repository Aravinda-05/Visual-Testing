/**
 * Mathematical elevation and hazard simulation for Gale Crater / Yellowknife Bay, Mars.
 * Simulates the broad regional slope of Mount Sharp (Aeolis Mons) layered with
 * lacustrine mudstone ridges and rocky ventifact fields.
 */

// Target coordinates for historical discovery site
export const JOHN_KLEIN_POS: [number, number] = [22.0, -26.0];

// 12 Jagged Basaltic Ventifact Rock Hazards (sharp cemented rocks that puncture aluminum wheels)
export const ROCK_HAZARDS: { x: number; z: number; scale: number; name: string }[] = [
  { x: 8.5, z: -10.2, scale: 1.4, name: 'Ventifact Alpha' },
  { x: 14.2, z: -18.5, scale: 1.6, name: 'Basalt Blade 01' },
  { x: -9.8, z: -14.6, scale: 1.3, name: 'Scree Spike 01' },
  { x: 18.0, z: -8.4, scale: 1.5, name: 'Jagged Sill 01' },
  { x: -16.2, z: 12.5, scale: 1.8, name: 'Ventifact Beta' },
  { x: 26.5, z: -14.2, scale: 1.5, name: 'Eolian Ridge Hazard' },
  { x: 4.5, z: -22.0, scale: 1.3, name: 'Mudstone Fragment' },
  { x: 30.0, z: -32.5, scale: 1.9, name: 'Basalt Blade 02' },
  { x: -5.4, z: 24.0, scale: 1.6, name: 'Scree Spike 02' },
  { x: 12.8, z: 16.5, scale: 1.4, name: 'Ventifact Gamma' },
  { x: -22.5, z: -6.0, scale: 1.7, name: 'Jagged Sill 02' },
  { x: 16.5, z: -35.0, scale: 1.5, name: 'Gale Rim Outcrop' },
];

/**
 * Pure mathematical height function for Gale Crater terrain.
 * Both the PlaneGeometry vertex displacement and Curiosity's wheel physics kinematics
 * call this exact function to guarantee 100% synchronized elevation.
 */
export function getTerrainHeight(x: number, z: number): number {
  const distFromOrigin = Math.hypot(x, z);

  // 1. Regional Mount Sharp (Aeolis Mons) base slope: rises toward South (-Z direction in Three.js)
  const mountSharpSlope = -z * 0.045;

  // 2. Yellowknife Bay lacustrine depression around John Klein site [22, -26]
  const distToJohnKlein = Math.hypot(x - JOHN_KLEIN_POS[0], z - JOHN_KLEIN_POS[1]);
  const bayDepression = -1.8 * Math.exp(-Math.pow(distToJohnKlein / 16.0, 2));

  // 3. Medium-frequency sediment bedding layers (sinusoidal terracing typical of mudstones)
  const angle = 0.52; // bedding strike angle (~30 deg)
  const rx = x * Math.cos(angle) - z * Math.sin(angle);
  const rz = x * Math.sin(angle) + z * Math.cos(angle);
  const beddingWaves =
    Math.sin(rx * 0.08) * 0.95 +
    Math.cos(rz * 0.065) * 0.75 +
    Math.sin(rx * 0.22 + rz * 0.15) * 0.35;

  // 4. Fine-scale gravel and ventifact ripple noise
  const ripples =
    (Math.sin(x * 0.45) * Math.cos(z * 0.42) +
      Math.sin(x * 0.75 - z * 0.6)) *
    0.18;

  // 5. Landing Pad Plateau at origin: leveled at Y = 0.00 for clean rover touchdown
  const padRadius = 5.0;
  const blendRadius = 10.0;
  let padWeight = 1.0;

  if (distFromOrigin <= padRadius) {
    padWeight = 0.0;
  } else if (distFromOrigin < blendRadius) {
    const t = (distFromOrigin - padRadius) / (blendRadius - padRadius);
    // Smoothstep interpolation
    padWeight = t * t * (3 - 2 * t);
  }

  const naturalHeight = mountSharpSlope + bayDepression + beddingWaves + ripples;
  return naturalHeight * padWeight;
}

