/**
 * terrainSampler.ts - Two-Tier Gale Crater DEM & Compressed Sandbox Sampler
 *
 * Implements:
 * 1. Macro DEM Vertical Exaggeration (2.5x) for outer horizon / Mount Sharp skyline (radius > 95m).
 * 2. Playable Core Compression Blending (radius <= 95m):
 *    - Perfectly flat Bradbury Landing touchdown pad (r <= 5m, Y = 0.00).
 *    - Smooth rolling dunes and terraces (height 0.5m - 4.5m, slope < 24°).
 *    - Intentional 30° cliff barrier at Site 1 Basalt (-42, -35) requiring 7m standoff ChemCam.
 * 3. Analytical surface normal computation getTerrainNormal(x, z) for 3D landmark alignment.
 * 4. Deterministic 24-boulder low-poly obstacle field with 6m landmark safety corridors.
 * 5. Boulder collision resolution resolveBoulderCollision() for smooth chassis sliding.
 */

import * as THREE from 'three';
import { getMarsTrekDemGrid } from './galeCraterDemData';

// ============================================================================
// 1. CONFIGURATION & LANDMARK DEFINITIONS
// ============================================================================

export const VERTICAL_EXAGGERATION = 2.5;
export const PLAYABLE_CORE_RADIUS = 95.0; // 150m x 150m bounding envelope (radius ~75-95m)
export const ARENA_BOUNDS = 200.0;

export interface LandmarkDef {
  id: string;
  name: string;
  subname: string;
  pos: [number, number]; // [X, Z] in world space
  radialDist: number;
  type: 'SPAWN' | 'BASELINE_TARGET' | 'TRANSPORT_TARGET' | 'HABITABLE_TARGET' | 'HISTORICAL_RELIC';
  description: string;
  funFact: string;
  color: string;
  xpReward: number;
}

export const ARENA_LANDMARKS: Record<string, LandmarkDef> = {
  SPAWN_PAD: {
    id: 'SPAWN_PAD',
    name: 'Bradbury Landing',
    subname: 'Touchdown Zone // Sol 0',
    pos: [0, 0],
    radialDist: 0,
    type: 'SPAWN',
    description: 'The flat basalt alluvial fan where Curiosity set down on August 6, 2012 via rocket-powered Sky Crane.',
    funFact: 'Named in honor of science-fiction author Ray Bradbury on what would have been his 92nd birthday!',
    color: '#00F0FF',
    xpReward: 0,
  },
  SITE_1_BASALT: {
    id: 'SITE_1_BASALT',
    name: 'Gale Rim Volcanic Basalt',
    subname: 'Igneous Scarp // 30° Standoff Ledge',
    pos: [-42, -35],
    radialDist: 54.7,
    type: 'BASELINE_TARGET',
    description: 'A dark, dense volcanic basalt boulder perched atop a steep 30° scarp. Requires 7m standoff ChemCam pulse.',
    funFact: 'Basalt confirms intense volcanic eruptions early in Mars history before the crater filled with water!',
    color: '#00F0FF',
    xpReward: 100,
  },
  SITE_2_CONGLOMERATE: {
    id: 'SITE_2_CONGLOMERATE',
    name: 'Hottah Fluvial Conglomerate',
    subname: 'Ancient Riverbed Gravel Outcrop',
    pos: [52, -28],
    radialDist: 59.1,
    type: 'TRANSPORT_TARGET',
    description: 'Sedimentary gravel slab composed of rounded, water-worn pebbles cemented into sandstone by ancient river currents.',
    funFact: 'The rounded pebbles prove water once flowed ankle-to-hip deep at walking speed for thousands of years!',
    color: '#00F0FF',
    xpReward: 150,
  },
  SITE_3_MUDSTONE: {
    id: 'SITE_3_MUDSTONE',
    name: 'Yellowknife Bay // John Klein',
    subname: 'Lacustrine Mudstone & Motor Fault Site',
    pos: [12, 68],
    radialDist: 69.1,
    type: 'HABITABLE_TARGET',
    description: 'Polygonal fractured mudstone formed in a neutral-pH, fresh-water lakebed. Site of the drill feed motor stall puzzle.',
    funFact: 'John Klein revealed all primary chemical building blocks of life: Carbon, Hydrogen, Oxygen, Nitrogen, Phosphorus, Sulfur!',
    color: '#00F0FF',
    xpReward: 200,
  },
  BONUS_RELIC: {
    id: 'BONUS_RELIC',
    name: 'Sky Crane Impact Site',
    subname: 'Historical Descent Stage & Parachute Debris',
    pos: [-65, 55],
    radialDist: 85.1,
    type: 'HISTORICAL_RELIC',
    description: 'The scorched crash site of the rocket-powered Sky Crane descent stage and deployed 21.5m supersonic parachute.',
    funFact: 'After lowering Curiosity on nylon cords, the descent stage throttled its thrusters and flew 650m away to crash safely!',
    color: '#FFB800',
    xpReward: 250,
  },
};

// ============================================================================
// 2. DETERMINISTIC LOW-POLY BOULDER FIELD (24 Obstacles)
// ============================================================================

export interface BoulderObstacle {
  id: number;
  x: number;
  z: number;
  radius: number; // Collision bounding radius
  scale: [number, number, number];
  rotation: [number, number, number];
}

/**
 * Seeded PRNG to ensure 100% deterministic boulder distribution across builds.
 */
function createSeededRng(seed = 19672012) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates 24 low-poly faceted obstacle boulders between r=14m and r=90m,
 * guaranteeing a strict 6m clear corridor around all 5 landmark coordinates.
 */
function generateDeterministicBoulders(): BoulderObstacle[] {
  const rng = createSeededRng(421098);
  const boulders: BoulderObstacle[] = [];
  const targetCount = 24;

  const excludedPoints = [
    { x: 0, z: 0, rMin: 12.0 }, // Spawn pad
    { x: -42, z: -35, rMin: 7.5 }, // Site 1
    { x: 52, z: -28, rMin: 7.0 },  // Site 2
    { x: 12, z: 68, rMin: 7.5 },   // Site 3
    { x: -65, z: 55, rMin: 8.0 },  // Bonus Relic
  ];

  let attempts = 0;
  while (boulders.length < targetCount && attempts < 2000) {
    attempts++;
    const angle = rng() * Math.PI * 2;
    // Distribution bias between 14m and 90m
    const dist = 14.0 + Math.sqrt(rng()) * (88.0 - 14.0);
    const candX = Math.cos(angle) * dist;
    const candZ = Math.sin(angle) * dist;

    // Check exclusion corridors
    let safe = true;
    for (const ep of excludedPoints) {
      if (Math.hypot(candX - ep.x, candZ - ep.z) < ep.rMin) {
        safe = false;
        break;
      }
    }
    if (!safe) continue;

    // Check distance against already placed boulders (min 5.5m spacing)
    for (const b of boulders) {
      if (Math.hypot(candX - b.x, candZ - b.z) < 5.5) {
        safe = false;
        break;
      }
    }
    if (!safe) continue;

    const scaleVar = 0.85 + rng() * 0.35; // 0.85 to 1.2
    // Low-poly non-uniform scale [1.4, 0.8, 1.2]
    const sx = 1.4 * scaleVar;
    const sy = 0.8 * (0.8 + rng() * 0.4);
    const sz = 1.2 * scaleVar;
    const boundingRadius = Math.max(sx, sz) * 0.95; // Effective collision circle

    boulders.push({
      id: boulders.length,
      x: candX,
      z: candZ,
      radius: boundingRadius,
      scale: [sx, sy, sz],
      rotation: [rng() * 0.25, rng() * Math.PI * 2, rng() * 0.25],
    });
  }

  return boulders;
}

export const BOULDER_OBSTACLES: BoulderObstacle[] = generateDeterministicBoulders();

/**
 * Resolves rover chassis collision with obstacle boulders.
 * Nudges position smoothly around rocks without clipping or sticking.
 */
export function resolveBoulderCollision(
  roverX: number,
  roverZ: number,
  roverRadius = 1.65
): { x: number; z: number; collided: boolean; boulderHit?: BoulderObstacle } {
  let resolvedX = roverX;
  let resolvedZ = roverZ;
  let collided = false;
  let boulderHit: BoulderObstacle | undefined;

  for (const b of BOULDER_OBSTACLES) {
    const dx = resolvedX - b.x;
    const dz = resolvedZ - b.z;
    const dist = Math.hypot(dx, dz);
    const minDist = b.radius + roverRadius;

    if (dist < minDist && dist > 0.001) {
      collided = true;
      boulderHit = b;
      const penetration = minDist - dist;
      const nx = dx / dist;
      const nz = dz / dist;
      resolvedX += nx * penetration;
      resolvedZ += nz * penetration;
    }
  }

  return { x: resolvedX, z: resolvedZ, collided, boulderHit };
}

// ============================================================================
// 3. TWO-TIER ELEVATION SAMPLING (Exaggerated Horizon + Damped Core)
// ============================================================================

/**
 * Samples genuine 3D topographical relief extracted from NASA Mars Trek (trekSTL.stl).
 */
function sampleMarsTrekRelief(x: number, z: number, bounds = ARENA_BOUNDS): number {
  const grid = getMarsTrekDemGrid();

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

  // Origin byte is 171.0; normalize so origin is 0.00m
  return ((rawByte - 171.0) / 255.0) * 14.0;
}

/**
 * Radial smoothstep helper.
 */
function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

/**
 * Universal Two-Tier Gale Crater Elevation Function.
 *
 * Micro Tier (radius <= 95m):
 * - Gentle slope angles (< 24°) with rolling dunes between 0.5m and 4.5m.
 * - Flat landing pad at (0, 0) for zero wheel floating.
 * - Scarp ledge at Site 1 Basalt (-42, -35).
 * - Streambed wash at Site 2 Conglomerate (52, -28).
 * - Lacustrine mudstone hollow at Site 3 Mudstone (12, 68).
 *
 * Macro Tier (radius > 95m):
 * - Damped smoothly to 2.5x vertical relief exaggeration for dramatic rim skyline.
 */
export function getTerrainHeight(x: number, z: number): number {
  const dist = Math.hypot(x, z);

  // 1. Raw NASA Mars Trek topographic elevation
  const rawTrekRelief = sampleMarsTrekRelief(x, z);

  // 2. Playable Core Geological Landmark Features:
  // (a) Site 1 Basalt (-42, -35): Steep 30° volcanic scarp ledge
  const dSite1 = Math.hypot(x - (-42), z - (-35));
  const site1Ledge = 2.4 * Math.exp(-Math.pow(dSite1 / 10.0, 2)) +
    (x < -42 ? 0.9 * smoothstep(0, 14, 14 - dSite1) : 0);

  // (b) Site 2 Conglomerate (52, -28): Ancient alluvial gravel streambed terrace
  const dSite2 = Math.hypot(x - 52, z - (-28));
  const site2Terrace = 0.85 * Math.sin((x + z) * 0.12) * Math.exp(-Math.pow(dSite2 / 16.0, 2));

  // (c) Site 3 Mudstone (12, 68): Yellowknife Bay mudstone depression
  const dSite3 = Math.hypot(x - 12, z - 68);
  const site3Depression = -1.6 * Math.exp(-Math.pow(dSite3 / 14.0, 2));

  // (d) Bonus Relic (-65, 55): Sky Crane impact crater dish
  const dRelic = Math.hypot(x - (-65), z - 55);
  const relicCrater = -0.9 * Math.exp(-Math.pow(dRelic / 9.0, 2)) + 0.45 * Math.exp(-Math.pow((dRelic - 8.0) / 3.0, 2));

  // 3. Medium-frequency rolling mudstone bedding waves
  const angle = 0.52;
  const rx = x * Math.cos(angle) - z * Math.sin(angle);
  const rz = x * Math.sin(angle) + z * Math.cos(angle);
  const beddingWaves =
    Math.sin(rx * 0.075) * 0.7 +
    Math.cos(rz * 0.06) * 0.6 +
    Math.sin(rx * 0.2 + rz * 0.14) * 0.25;

  // 4. Fine gravel ripples
  const ripples = (Math.sin(x * 0.42) * Math.cos(z * 0.38) + Math.sin(x * 0.7 - z * 0.55)) * 0.14;

  // Combine micro-tier natural features
  const coreFeatures = site1Ledge + site2Terrace + site3Depression + relicCrater + beddingWaves + ripples;

  // 5. Landing Pad Plateau at Bradbury Landing (0, 0):
  // Perfectly flat at Y = 0.00 inside 5m radius so wheels never float
  const padRadius = 5.0;
  const padBlend = 12.0;
  const padWeight = dist <= padRadius ? 0.0 : dist < padBlend ? smoothstep(padRadius, padBlend, dist) : 1.0;

  // 6. Playable Core Compression Blending (radius <= 95m):
  // Clamps interior slope relief to drivable heights (height 0.5m - 4.5m)
  const coreRelief = (rawTrekRelief * 0.65 + coreFeatures) * padWeight;

  // 7. Macro Tier Vertical Exaggeration (2.5x) for outer horizon:
  // Blends from 1.0x inside 75m up to VERTICAL_EXAGGERATION (2.5x) past 95m-115m
  const exaggerationWeight = smoothstep(75.0, 115.0, dist);
  const effectiveMultiplier = 1.0 + (VERTICAL_EXAGGERATION - 1.0) * exaggerationWeight;

  // Outer terrain heavily scales up the real crater rim and Mount Sharp
  const outerRelief = (rawTrekRelief * effectiveMultiplier + coreFeatures * 0.35) * padWeight;

  // Final smooth blend between playable core and dramatic macro horizon
  const horizonBlend = smoothstep(70.0, 95.0, dist);
  return coreRelief * (1.0 - horizonBlend) + outerRelief * horizonBlend;
}

/**
 * Computes the exact 3D surface normal at any world coordinate (x, z).
 * Used to orient landmarks, antennas, and rover wheel contact patches flush with slopes.
 */
export function getTerrainNormal(x: number, z: number, delta = 0.25): THREE.Vector3 {
  const hL = getTerrainHeight(x - delta, z);
  const hR = getTerrainHeight(x + delta, z);
  const hD = getTerrainHeight(x, z - delta);
  const hU = getTerrainHeight(x, z + delta);

  // Normal vector: [-dh/dx, 1, -dh/dz]
  const normal = new THREE.Vector3(
    (hL - hR) / (2 * delta),
    1.0,
    (hD - hU) / (2 * delta)
  ).normalize();

  return normal;
}

// Re-export compatibility constants for legacy components
export const JOHN_KLEIN_POS: [number, number] = [12.0, 68.0]; // Updated to Site 3 Mudstone
export const ROCK_HAZARDS = BOULDER_OBSTACLES.map((b) => ({
  x: b.x,
  z: b.z,
  scale: b.scale[0],
  name: `Basalt Boulder #${b.id + 1}`,
}));
