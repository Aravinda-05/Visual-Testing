/**
 * terrainSampler.ts - Gale Crater DEM & Procedural Elevation Sampler
 *
 * Implements Step 0B terrain elevation sampling:
 * - Can sample directly from the baked Mars Trek DEM heightmap (public/terrains/gale_crater_dem.png)
 * - Seamlessly falls back to procedural Gale Crater mathematical elevation if the DEM is missing
 * - Enforces zero floating: guarantees elevation = 0.00 at origin landing pad [0, 0] for Curiosity's wheels.
 */

import { getTerrainHeight, JOHN_KLEIN_POS, ROCK_HAZARDS } from './terrainMath';

export interface DemElevationSampler {
  isLoaded: boolean;
  sample: (x: number, z: number) => number;
  width: number;
  height: number;
}

// In-memory cached DEM heightmap raster
let cachedDemData: Uint8ClampedArray | null = null;
let cachedWidth = 0;
let cachedHeight = 0;
let isDemLoading = false;

/**
 * Asynchronously loads and parses the baked Mars Trek DEM heightmap (/terrains/gale_crater_dem.png)
 */
export async function initDemHeightmap(
  url = '/terrains/gale_crater_dem.png'
): Promise<boolean> {
  if (cachedDemData) return true;
  if (isDemLoading) return false;
  isDemLoading = true;

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (err) => reject(err);
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, img.width, img.height);
    cachedDemData = imgData.data;
    cachedWidth = img.width;
    cachedHeight = img.height;
    console.info(
      `[TerrainSampler] Loaded Mars Trek DEM heightmap: ${cachedWidth}x${cachedHeight}px`
    );
    return true;
  } catch {
    console.info(
      '[TerrainSampler] Mars Trek DEM heightmap not found. Relying on procedural Gale Crater elevation.'
    );
    return false;
  } finally {
    isDemLoading = false;
  }
}

/**
 * Samples elevation from the loaded DEM raster with bilinear interpolation,
 * scaled to match the 200m Gale Crater terrain bounds.
 */
export function sampleDemHeight(
  x: number,
  z: number,
  boundsSize = 200.0,
  maxElevationMeters = 16.0
): number {
  if (!cachedDemData || cachedWidth === 0 || cachedHeight === 0) {
    // Procedural fallback
    return getTerrainHeight(x, z);
  }

  // Normalize [-boundsSize/2, boundsSize/2] -> [0, 1]
  const u = (x + boundsSize / 2) / boundsSize;
  const v = (z + boundsSize / 2) / boundsSize;

  if (u < 0 || u > 1 || v < 0 || v > 1) {
    return getTerrainHeight(x, z);
  }

  // Bilinear sampling coordinates
  const fx = u * (cachedWidth - 1);
  const fy = v * (cachedHeight - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, cachedWidth - 1);
  const y1 = Math.min(y0 + 1, cachedHeight - 1);
  const dx = fx - x0;
  const dy = fy - y0;

  // Sample red channel (grayscale)
  const getVal = (px: number, py: number) => {
    const idx = (py * cachedWidth + px) * 4;
    return (cachedDemData![idx] / 255.0) * maxElevationMeters;
  };

  const v00 = getVal(x0, y0);
  const v10 = getVal(x1, y0);
  const v01 = getVal(x0, y1);
  const v11 = getVal(x1, y1);

  const top = v00 * (1 - dx) + v10 * dx;
  const bottom = v01 * (1 - dx) + v11 * dx;
  const rawElev = top * (1 - dy) + bottom * dy;

  // Level landing pad at origin [0, 0] so wheels touch down at Y = 0.00
  const dist = Math.hypot(x, z);
  const padRadius = 5.0;
  const blendRadius = 10.0;
  let padWeight = 1.0;

  if (dist <= padRadius) {
    padWeight = 0.0;
  } else if (dist < blendRadius) {
    const t = (dist - padRadius) / (blendRadius - padRadius);
    padWeight = t * t * (3 - 2 * t);
  }

  return rawElev * padWeight;
}

/**
 * Universal Gale Crater elevation sampler.
 * Calls the baked DEM heightmap if loaded, or the procedural mathematical function.
 */
export function sampleGaleElevation(x: number, z: number): number {
  if (cachedDemData) {
    return sampleDemHeight(x, z);
  }
  return getTerrainHeight(x, z);
}

// Re-export key location constants for convenient imports
export { JOHN_KLEIN_POS, ROCK_HAZARDS, getTerrainHeight };

