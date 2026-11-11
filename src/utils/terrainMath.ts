/**
 * terrainMath.ts - Re-exports synchronized elevation and landmarks from terrainSampler.ts
 */

export {
  VERTICAL_EXAGGERATION,
  PLAYABLE_CORE_RADIUS,
  ARENA_BOUNDS,
  ARENA_LANDMARKS,
  BOULDER_OBSTACLES,
  resolveBoulderCollision,
  getTerrainHeight,
  getTerrainNormal,
  JOHN_KLEIN_POS,
  ROCK_HAZARDS,
} from './terrainSampler';

export type { LandmarkDef, BoulderObstacle } from './terrainSampler';
