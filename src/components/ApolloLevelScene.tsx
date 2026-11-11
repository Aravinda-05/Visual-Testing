/**
 * ApolloLevelScene.tsx - Dedicated Canvas Director for Level 1: Apollo 11 (Moon)
 *
 * Coordinates:
 * 1. ORBITAL_GLOBE: Interactive 3D Lunar Orbital Museum Globe.
 * 2. SOUL_TRANSFER_DESCENT: Cyan particle beam descending from orbit down to Tranquility Base.
 * 3. SURFACE_SANDBOX: Localized Mare Tranquillitatis surface sandbox with Apollo LM, DEM, and science loops.
 * 4. SOUL_TRANSFER_ASCENT: Ascending telemetry carrier beam unlocking next mission.
 */

import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useApolloMissionStore } from '../store/useApolloMissionStore';
import { LunarOrbitalGlobe } from './LunarOrbitalGlobe';
import { ApolloSurfaceSandbox } from './ApolloSurfaceSandbox';
import { getLunarTerrainHeight } from '../utils/lunarTerrainSampler';

export const ApolloLevelScene: React.FC = () => {
  const { camera } = useThree();
  const viewMode = useApolloMissionStore((s) => s.viewMode);
  const setViewMode = useApolloMissionStore((s) => s.setViewMode);
  const orbitControlsRef = useRef<OrbitControlsImpl>(null);

  const descentTimeRef = useRef(0.0);
  const ascentTimeRef = useRef(0.0);

  // Transition animations
  useFrame((_, delta) => {
    if (viewMode === 'SOUL_TRANSFER_DESCENT') {
      descentTimeRef.current += delta;
      const progress = Math.min(1.0, descentTimeRef.current / 2.6);

      // Camera descends from space down to 3rd-person hero vista
      const terrainY = getLunarTerrainHeight(0, 0);
      camera.position.set(
        THREE.MathUtils.lerp(0.0, 11.0, progress),
        THREE.MathUtils.lerp(35.0, terrainY + 5.2, Math.pow(progress, 1.8)),
        THREE.MathUtils.lerp(25.0, 11.0, progress)
      );
      camera.lookAt(0, terrainY + 2.0, 0);

      if (progress >= 1.0) {
        descentTimeRef.current = 0.0;
        setViewMode('SURFACE_SANDBOX');
      }
    } else if (viewMode === 'SOUL_TRANSFER_ASCENT') {
      ascentTimeRef.current += delta;
      const progress = Math.min(1.0, ascentTimeRef.current / 3.2);

      // Camera pulls up into orbital view
      camera.position.set(
        0.0,
        THREE.MathUtils.lerp(getLunarTerrainHeight(0, 0) + 2.2, 30.0, Math.pow(progress, 1.5)),
        THREE.MathUtils.lerp(1.8, 18.0, progress)
      );
      camera.lookAt(0, 0, 0);

      if (progress >= 1.0) {
        ascentTimeRef.current = 0.0;
        setViewMode('ORBITAL_GLOBE');
      }
    }
  });

  return (
    <>
      {/* Orbit Controls (Enabled in ORBITAL_GLOBE mode) */}
      <OrbitControls
        ref={orbitControlsRef}
        enabled={viewMode === 'ORBITAL_GLOBE'}
        minDistance={5.2}
        maxDistance={22.0}
        enableDamping
        dampingFactor={0.06}
      />

      {/* View Switcher */}
      {viewMode === 'ORBITAL_GLOBE' ? (
        <LunarOrbitalGlobe />
      ) : (
        <>
          <ApolloSurfaceSandbox />

          {/* Luminous Soul-Transfer Vertical Cyan Beam during descent/ascent */}
          {(viewMode === 'SOUL_TRANSFER_DESCENT' || viewMode === 'SOUL_TRANSFER_ASCENT') && (
            <group position={[0, getLunarTerrainHeight(0, 0), 0]}>
              <mesh position={[0, 40, 0]}>
                <cylinderGeometry args={[0.9, 1.4, 80, 16]} />
                <meshBasicMaterial color="#00F0FF" transparent opacity={0.65} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, 40, 0]}>
                <cylinderGeometry args={[0.3, 0.45, 80, 16]} />
                <meshBasicMaterial color="#FFFFFF" transparent opacity={0.9} side={THREE.DoubleSide} />
              </mesh>
            </group>
          )}
        </>
      )}
    </>
  );
};

