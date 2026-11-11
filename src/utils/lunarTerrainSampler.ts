/**
 * lunarTerrainSampler.ts - Mare Tranquillitatis DEM Topography & Geological Sampler
 *
 * Implements:
 * 1. CPU-based 256x256 elevation grid with bilinear interpolation for Tranquility Base (Apollo 11).
 * 2. Real topographic features:
 *    - Flat basaltic mare touchdown pad at Bradbury/Tranquility Center (0, 0)
 *    - West Crater: steep blocky impact crater 60m east (radius ~18m, depth ~5.2m, raised rim +1.2m)
 *    - Little West Crater: 35m northeast (x: 28, z: -22, radius ~9m, depth ~2.5m)
 *    - 2.5x vertical exaggeration on the outer lunar horizon (radius > 90m)
 * 3. Exact world coordinates for interactive Apollo 11 science and fault sites.
 */

import * as THREE from 'three';

export interface LunarLandmark {
  id: 'SITE_1_REGOLITH' | 'SITE_2_EJECTA' | 'SITE_3_LRRR_LOCK' | 'BONUS_PLAQUE' | 'PSEP_STATION' | 'SBAND_ANTENNA';
  name: string;
  coords: [number, number]; // [x, z] in meters
  azimuthDeg: number;       // Camera pan angle from LM center
  elevationDeg: number;     // Camera tilt angle from LM center
  radialDistM: number;      // Distance in meters
  geologicalType: 'BEARING_SOIL' | 'VESICULAR_BASALT' | 'RETROREFLECTOR' | 'HISTORIC_RELIC' | 'SEISMOMETER' | 'TELEMETRY_DISH';
  badgeColor: string;
  description: string;
  scienceXp: number;
}

export const LUNAR_LANDMARKS: Record<string, LunarLandmark> = {
  SITE_1_REGOLITH: {
    id: 'SITE_1_REGOLITH',
    name: 'Footpad Bearing & Bootprint Trench',
    coords: [-3.44, 4.91], // Azimuth -35°, dist 6m
    azimuthDeg: -35.0,
    elevationDeg: -18.0,
    radialDistM: 6.0,
    geologicalType: 'BEARING_SOIL',
    badgeColor: '#00F0FF',
    description: 'Fine cohesive lunar dust compressed into a 3cm trench, confirming 0.7 N/cm² bearing capacity without astronaut sinkage.',
    scienceXp: 150,
  },
  SITE_2_EJECTA: {
    id: 'SITE_2_EJECTA',
    name: 'West Crater Basalt Outcrop',
    coords: [34.44, 16.06], // Azimuth +65°, dist 38m
    azimuthDeg: 65.0,
    elevationDeg: 2.0,
    radialDistM: 38.0,
    geologicalType: 'VESICULAR_BASALT',
    badgeColor: '#10B981',
    description: 'High-titanium vesicular mare basalt boulder thrown from West Crater, dating back 3.8 billion years to ancient lava flooding.',
    scienceXp: 200,
  },
  SITE_3_LRRR_LOCK: {
    id: 'SITE_3_LRRR_LOCK',
    name: 'Laser Ranging Retroreflector (LRRR)',
    coords: [4.33, 13.31], // Azimuth +18°, dist 14m
    azimuthDeg: 18.0,
    elevationDeg: -8.0,
    radialDistM: 14.0,
    geologicalType: 'RETROREFLECTOR',
    badgeColor: '#FFB800',
    description: 'Array of 100 fused-silica corner-cube prisms bouncing 532nm laser pulses back to McDonald Observatory for 384,400km Earth-Moon distance measurement.',
    scienceXp: 300,
  },
  BONUS_PLAQUE: {
    id: 'BONUS_PLAQUE',
    name: 'Descent Stage Ladder Plaque',
    coords: [0.0, 2.1], // Front ladder leg
    azimuthDeg: 0.0,
    elevationDeg: -25.0,
    radialDistM: 2.1,
    geologicalType: 'HISTORIC_RELIC',
    badgeColor: '#F59E0B',
    description: '"Here men from the planet Earth first set foot upon the Moon, July 1969, A.D. We came in peace for all mankind."',
    scienceXp: 250,
  },
  PSEP_STATION: {
    id: 'PSEP_STATION',
    name: 'Passive Seismic Experiment (PSEP)',
    coords: [-8.5, 9.0],
    azimuthDeg: -43.0,
    elevationDeg: -6.0,
    radialDistM: 12.4,
    geologicalType: 'SEISMOMETER',
    badgeColor: '#EC4899',
    description: 'Beryllium-copper seismometer listening for meteorite impacts and lunar thermal crustal tremors.',
    scienceXp: 120,
  },
  SBAND_ANTENNA: {
    id: 'SBAND_ANTENNA',
    name: 'S-Band Erectable Antenna Dish',
    coords: [5.5, -4.5],
    azimuthDeg: 129.0,
    elevationDeg: 14.0,
    radialDistM: 7.1,
    geologicalType: 'TELEMETRY_DISH',
    badgeColor: '#8B5CF6',
    description: '2.1m umbrella-style steerable parabolic dish beaming TV signals and biomedical data directly to Goldstone and Parkes.',
    scienceXp: 180,
  },
};

// DEM Grid dimensions: 256x256 covering 300m x 300m
const GRID_SIZE = 256;
const ARENA_EXTENT_M = 300.0;
const HALF_EXTENT = ARENA_EXTENT_M / 2.0;
const STEP_M = ARENA_EXTENT_M / (GRID_SIZE - 1);

// Elevation buffer (float32 meters)
let lunarElevationGrid: Float32Array | null = null;

/**
 * Smoothstep interpolation function.
 */
function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

/**
 * Procedural elevation generator for Tranquility Base.
 * Models flat landing pad, West Crater, Little West Crater, rolling micro-craters,
 * and 2.5x vertical relief on the outer horizon.
 */
function computeProceduralLunarHeight(x: number, z: number): number {
  const distFromCenter = Math.sqrt(x * x + z * z);

  // 1. Base rolling regolith micro-undulations (multi-frequency noise)
  let baseNoise =
    Math.sin(x * 0.045 + 1.2) * Math.cos(z * 0.045 + 0.8) * 0.85 +
    Math.sin(x * 0.11 - z * 0.09) * 0.42 +
    Math.cos(x * 0.22 + z * 0.18) * 0.18;

  // 2. West Crater (x = 60m, z = 0m, radius ~18m, depth ~5.2m, raised rim +1.2m)
  const dxWest = x - 60.0;
  const dzWest = z - 0.0;
  const distWest = Math.sqrt(dxWest * dxWest + dzWest * dzWest);
  let westCraterElevation = 0.0;

  if (distWest < 32.0) {
    if (distWest < 18.0) {
      // Crater interior bowl (bowl depth down to -5.2m)
      const bowlProgress = distWest / 18.0;
      westCraterElevation = -5.2 * (1.0 - Math.pow(bowlProgress, 2.2));
    } else {
      // Raised outer ejecta rim (+1.2m peak fading out to 32m)
      const rimProgress = (distWest - 18.0) / 14.0;
      westCraterElevation = 1.2 * Math.sin(rimProgress * Math.PI) * (1.0 - rimProgress);
    }
  }

  // 3. Little West Crater (x = 28m, z = -22m, radius ~9m, depth ~2.5m)
  const dxLittle = x - 28.0;
  const dzLittle = z - -22.0;
  const distLittle = Math.sqrt(dxLittle * dxLittle + dzLittle * dzLittle);
  let littleCraterElevation = 0.0;

  if (distLittle < 16.0) {
    if (distLittle < 9.0) {
      const bowlProgress = distLittle / 9.0;
      littleCraterElevation = -2.5 * (1.0 - Math.pow(bowlProgress, 2.0));
    } else {
      const rimProgress = (distLittle - 9.0) / 7.0;
      littleCraterElevation = 0.65 * (1.0 - rimProgress);
    }
  }

  // 4. Secondary micro-craters across the mare
  const microCrater1 = Math.exp(-Math.pow(Math.hypot(x + 22, z + 18) / 6.0, 2)) * -1.6;
  const microCrater2 = Math.exp(-Math.pow(Math.hypot(x - 14, z + 36) / 4.5, 2)) * -1.2;
  const microCrater3 = Math.exp(-Math.pow(Math.hypot(x + 45, z - 42) / 8.0, 2)) * -2.1;

  // 5. Landing Pad Flattening (radius <= 18m around touchdown site is flat, max slope < 2°)
  const padFlattenFactor = smoothstep(6.0, 20.0, distFromCenter);

  let rawHeight = (baseNoise + microCrater1 + microCrater2 + microCrater3) * padFlattenFactor +
    westCraterElevation + littleCraterElevation;

  // 6. Outer Horizon Exaggeration (2.5x multiplier for radius > 90m)
  if (distFromCenter > 90.0) {
    const exagProgress = smoothstep(90.0, 150.0, distFromCenter);
    const outerRidges =
      Math.sin(x * 0.025 + 0.5) * Math.cos(z * 0.025 + 1.1) * 8.0 +
      Math.sin(x * 0.05 - z * 0.04) * 4.0;
    rawHeight += outerRidges * exagProgress * 2.5;
  }

  return rawHeight;
}

/**
 * Initializes the elevation grid in memory.
 */
export function buildProceduralLunarDem(): void {
  if (lunarElevationGrid) return;

  lunarElevationGrid = new Float32Array(GRID_SIZE * GRID_SIZE);

  for (let gy = 0; gy < GRID_SIZE; gy++) {
    const z = -HALF_EXTENT + gy * STEP_M;
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const x = -HALF_EXTENT + gx * STEP_M;
      lunarElevationGrid[gy * GRID_SIZE + gx] = computeProceduralLunarHeight(x, z);
    }
  }
}

// Auto-initialize procedural DEM on module load
buildProceduralLunarDem();

/**
 * Loads an external DEM PNG image if present, otherwise keeps the procedural elevation grid.
 */
export async function initLunarDemFromUrl(demUrl = '/terrains/mare_tranquillitatis_dem.png'): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = GRID_SIZE;
        canvas.height = GRID_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(false);
          return;
        }

        ctx.drawImage(img, 0, 0, GRID_SIZE, GRID_SIZE);
        const imgData = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
        const data = imgData.data;

        if (!lunarElevationGrid) {
          lunarElevationGrid = new Float32Array(GRID_SIZE * GRID_SIZE);
        }

        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const normalized = (r * 256 + g) / 65535.0; // 16-bit or 8-bit height
          // Scale to [-8m, +25m] relative elevation
          lunarElevationGrid[i] = -8.0 + normalized * 33.0;
        }

        resolve(true);
      } catch {
        resolve(false);
      }
    };

    img.onerror = () => {
      // Fallback procedural grid already active
      resolve(false);
    };

    img.src = demUrl;
  });
}

/**
 * Returns terrain elevation (Y in meters) for any world coordinate (x, z).
 * Uses bilinear interpolation across the 256x256 elevation grid.
 */
export function getLunarTerrainHeight(x: number, z: number): number {
  if (!lunarElevationGrid) {
    buildProceduralLunarDem();
  }

  // Check bounds
  if (x < -HALF_EXTENT || x > HALF_EXTENT || z < -HALF_EXTENT || z > HALF_EXTENT) {
    return computeProceduralLunarHeight(x, z);
  }

  const gx = (x + HALF_EXTENT) / STEP_M;
  const gz = (z + HALF_EXTENT) / STEP_M;

  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const x1 = Math.min(x0 + 1, GRID_SIZE - 1);
  const z1 = Math.min(z0 + 1, GRID_SIZE - 1);

  const fx = gx - x0;
  const fz = gz - z0;

  const grid = lunarElevationGrid!;
  const h00 = grid[z0 * GRID_SIZE + x0];
  const h10 = grid[z0 * GRID_SIZE + x1];
  const h01 = grid[z1 * GRID_SIZE + x0];
  const h11 = grid[z1 * GRID_SIZE + x1];

  const h0 = h00 * (1.0 - fx) + h10 * fx;
  const h1 = h01 * (1.0 - fx) + h11 * fx;

  return h0 * (1.0 - fz) + h1 * fz;
}

/**
 * Computes the surface normal vector at any world coordinate (x, z)
 * using central finite differences.
 */
export function getLunarTerrainNormal(x: number, z: number, delta = 0.5): THREE.Vector3 {
  const hL = getLunarTerrainHeight(x - delta, z);
  const hR = getLunarTerrainHeight(x + delta, z);
  const hD = getLunarTerrainHeight(x, z - delta);
  const hU = getLunarTerrainHeight(x, z + delta);

  const normal = new THREE.Vector3(-(hR - hL) / (2.0 * delta), 1.0, -(hU - hD) / (2.0 * delta));
  return normal.normalize();
}

/**
 * Returns surface slope angle in degrees at (x, z).
 */
export function getLunarSlopeAngleDeg(x: number, z: number): number {
  const normal = getLunarTerrainNormal(x, z);
  const dotUp = THREE.MathUtils.clamp(normal.y, 0.0, 1.0);
  return Math.acos(dotUp) * (180.0 / Math.PI);
}

/**
 * Returns elevation color band for vertex-coloring the lunar DEM plane.
 */
export function getLunarElevationBand(height: number): { name: string; color: string } {
  if (height < -3.0) return { name: 'Deep Crater Floor', color: '#606977' };
  if (height < -0.8) return { name: 'Low Basalt Mare', color: '#747E8D' };
  if (height < 1.2) return { name: 'Tranquility Plains', color: '#8F99A7' };
  if (height < 3.5) return { name: 'Ejecta Blanket', color: '#B0B9C6' };
  return { name: 'Crater Rim / Distant Highland', color: '#D2D9E4' };
}

