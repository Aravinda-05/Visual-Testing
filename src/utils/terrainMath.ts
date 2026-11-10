import { getMarsTrekDemGrid } from './galeCraterDemData';

/**
 * Mathematical elevation and hazard simulation for Gale Crater / Yellowknife Bay, Mars.
 * Incorporates genuine NASA Mars Trek 3D topography extracted from trekSTL.stl layered with
 * local lacustrine mudstone ridges and rocky ventifact fields.
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
 * Samples genuine 3D topographical relief extracted from NASA Mars Trek (trekSTL.stl).
 * Uses bilinear interpolation over the baked 256x256 elevation grid.
 */
export function sampleMarsTrekRelief(x: number, z: number, bounds = 200.0): number {
  const grid = getMarsTrekDemGrid();

  // World [-bounds/2, bounds/2] -> UV [0, 1]
  const u = (x + bounds / 2) / bounds;
  const v = (z + bounds / 2) / bounds;

  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;

  const fx = u * 255;
  const fy = v * 255;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, 255);
  const y1 = Math.min(y0 + 1, 255);
  const dx = fx - x0;
  const dy = fy - y0;

  const v00 = grid[y0 * 256 + x0];
  const v10 = grid[y0 * 256 + x1];
  const v01 = grid[y1 * 256 + x0];
  const v11 = grid[y1 * 256 + x1];

  const top = v00 * (1 - dx) + v10 * dx;
  const bottom = v01 * (1 - dx) + v11 * dx;
  const rawByte = top * (1 - dy) + bottom * dy;

  // Origin (u=0.5, v=0.5) elevation byte in NASA Mars Trek DEM is 171.0
  // Subtract origin height so Curiosity's landing pad is naturally at Y = 0.00
  // Scale to 14 meters of authentic Gale Crater topographical relief
  return ((rawByte - 171.0) / 255.0) * 14.0;
}

/**
 * Pure mathematical height function for Gale Crater terrain.
 * Combines genuine NASA Mars Trek 3D topography with local lacustrine sediment bedding.
 * Both the PlaneGeometry vertex displacement and Curiosity's wheel physics kinematics
 * call this exact function to guarantee 100% synchronized elevation.
 */
export function getTerrainHeight(x: number, z: number): number {
  const distFromOrigin = Math.hypot(x, z);

  // 1. Genuine NASA Mars Trek 3D Topographical Relief (extracted from trekSTL.stl)
  const marsTrekRelief = sampleMarsTrekRelief(x, z);

  // 2. Yellowknife Bay lacustrine depression around John Klein site [22, -26]
  const distToJohnKlein = Math.hypot(x - JOHN_KLEIN_POS[0], z - JOHN_KLEIN_POS[1]);
  const bayDepression = -1.8 * Math.exp(-Math.pow(distToJohnKlein / 16.0, 2));

  // 3. Medium-frequency sediment bedding layers (sinusoidal terracing typical of mudstones)
  const angle = 0.52;
  const rx = x * Math.cos(angle) - z * Math.sin(angle);
  const rz = x * Math.sin(angle) + z * Math.cos(angle);
  const beddingWaves =
    Math.sin(rx * 0.08) * 0.75 +
    Math.cos(rz * 0.065) * 0.65 +
    Math.sin(rx * 0.22 + rz * 0.15) * 0.3;

  // 4. Fine-scale gravel and ventifact ripple noise
  const ripples =
    (Math.sin(x * 0.45) * Math.cos(z * 0.42) +
      Math.sin(x * 0.75 - z * 0.6)) *
    0.16;

  // 5. Landing Pad Plateau at origin: perfectly leveled at Y = 0.00 within padRadius for zero wheel floating
  const padRadius = 4.5;
  const blendRadius = 9.0;
  let padWeight = 1.0;

  if (distFromOrigin <= padRadius) {
    padWeight = 0.0;
  } else if (distFromOrigin < blendRadius) {
    const t = (distFromOrigin - padRadius) / (blendRadius - padRadius);
    padWeight = t * t * (3 - 2 * t);
  }

  const naturalHeight = marsTrekRelief + bayDepression + beddingWaves + ripples;
  return naturalHeight * padWeight;
}

