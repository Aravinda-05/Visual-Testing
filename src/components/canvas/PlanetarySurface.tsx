import React, { useMemo } from 'react';
import * as THREE from 'three';
import { generateFacetedMarsTerrain } from '../../utils/terrainGenerator';
import { getFourStepGradientMap } from '../../utils/celShading';

interface PlanetarySurfaceProps {
  color?: string;
  wireframe?: boolean;
}

export const PlanetarySurface: React.FC<PlanetarySurfaceProps> = ({
  color = '#C85A32',
  wireframe = false,
}) => {
  // Construct and procedurally sculpt the 200x200 plane with 128x128 segments
  const geometry = useMemo(() => {
    const basePlane = new THREE.PlaneGeometry(200, 200, 128, 128);
    const faceted = generateFacetedMarsTerrain(basePlane);
    basePlane.dispose();
    return faceted;
  }, []);

  const gradientMap = useMemo(() => getFourStepGradientMap(), []);

  // Configure MeshToonMaterial in Martian ochre with flatShading
  const material = useMemo(() => {
    const mat = new THREE.MeshToonMaterial({
      color,
      gradientMap,
      wireframe,
    });
    // Enable flatShading and define FLAT_SHADED for crisp geometric facets
    (mat as unknown as { flatShading: boolean }).flatShading = true;
    mat.defines = { ...mat.defines, FLAT_SHADED: '' };
    mat.needsUpdate = true;
    return mat;
  }, [color, gradientMap, wireframe]);

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
      castShadow
    />
  );
};
