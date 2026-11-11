/**
 * GaleCraterTerrain.tsx - Two-Tier Planetary Surface Mesh
 *
 * Renders the 200m x 200m Gale Crater planetary terrain plane geometry with:
 * - Macro Tier 2.5x vertical relief exaggeration for outer horizon and Mount Sharp skyline.
 * - Micro Tier damped driving core with smoothstep radial blending for gentle rolling dunes.
 * - NASA Mars Trek DEM color map, normal map, and 4-step cel-shading toon material.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { getTerrainHeight, ARENA_BOUNDS } from '../utils/terrainSampler';
import { getFourStepGradientMap } from '../utils/celShading';

export const GaleCraterTerrain: React.FC = () => {
  const gradientMap = useMemo(() => getFourStepGradientMap(), []);

  // Load NASA Mars Trek photorealistic hypsometric color map and normal relief map
  const { colorMap, normalMap } = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const color = loader.load('/terrains/gale_crater_texture.png');
    color.wrapS = THREE.ClampToEdgeWrapping;
    color.wrapT = THREE.ClampToEdgeWrapping;
    color.colorSpace = THREE.SRGBColorSpace;

    const normal = loader.load('/terrains/gale_crater_normal.png');
    normal.wrapS = THREE.ClampToEdgeWrapping;
    normal.wrapT = THREE.ClampToEdgeWrapping;

    return { colorMap: color, normalMap: normal };
  }, []);

  // NASA Mars Trek DEM 200x200 Plane Geometry (96x96 resolution, 60fps optimized)
  const terrainGeometry = useMemo(() => {
    const baseGeo = new THREE.PlaneGeometry(ARENA_BOUNDS, ARENA_BOUNDS, 96, 96);
    const posAttr = baseGeo.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      const worldX = vertex.x;
      const worldZ = -vertex.y;
      // Samples the Two-Tier height function with 2.5x outer horizon exaggeration
      const elevation = getTerrainHeight(worldX, worldZ);
      posAttr.setZ(i, elevation);
    }

    posAttr.needsUpdate = true;
    const nonIndexed = baseGeo.toNonIndexed();
    nonIndexed.computeVertexNormals();
    baseGeo.dispose();
    return nonIndexed;
  }, []);

  // Terrain Toon Material with NASA Mars Trek DEM texture & normal map
  const terrainMaterial = useMemo(() => {
    const mat = new THREE.MeshToonMaterial({
      map: colorMap,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(1.4, 1.4),
      color: '#FFFFFF',
      gradientMap,
    });
    (mat as unknown as { flatShading: boolean }).flatShading = true;
    mat.defines = { ...mat.defines, FLAT_SHADED: '' };
    mat.needsUpdate = true;
    return mat;
  }, [colorMap, normalMap, gradientMap]);

  return (
    <mesh
      geometry={terrainGeometry}
      material={terrainMaterial}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
    />
  );
};
