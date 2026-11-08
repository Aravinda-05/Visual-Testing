import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { Perf } from 'r3f-perf';
import { useControls, folder } from 'leva';
import { EraKey, ERA_PRESETS } from '../../types/era';
import { PlanetarySurface } from './PlanetarySurface';
import { ToonModelLoader } from './ToonModelLoader';
import { LightingAndAtmosphere } from './LightingAndAtmosphere';
import { EraPostProcessing } from '../postprocessing/EraPostProcessing';

interface RoverSceneProps {
  currentEra: EraKey;
  onEraChange: (era: EraKey) => void;
}

export const RoverScene: React.FC<RoverSceneProps> = ({
  currentEra,
  onEraChange,
}) => {
  // Leva controls for Scene configurations
  const sceneControls = useControls('Scene & Camera', {
    showPerformanceMonitor: { value: true, label: 'Show Perf Monitor' },
    showFacetedGrid: { value: false, label: 'Show Nav Grid' },
    terrainColor: { value: '#C85A32', label: 'Martian Ochre' },
    wireframeTerrain: { value: false, label: 'Terrain Wireframe' },
    modelSource: {
      value: 'Procedural Compound Rover',
      options: ['Procedural Compound Rover', 'Custom GLTF (/models/rover.glb)'],
      label: 'Model Source',
    },
    lighting: folder({
      sunIntensity: { value: 2.5, min: 0.5, max: 5.0, step: 0.1, label: 'Sun Intensity' },
    }),
  });

  const activeDpr = ERA_PRESETS[currentEra].dpr;

  return (
    <div className="relative w-full h-full bg-[#05070B] overflow-hidden">
      <Canvas
        shadows
        dpr={activeDpr}
        camera={{ position: [9, 5.5, 11], fov: 42, near: 0.1, far: 500 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        className="w-full h-full"
      >
        {/* Performance metrics: FPS, GPU frame time, Draw calls */}
        {sceneControls.showPerformanceMonitor && <Perf position="top-left" />}

        {/* Orbit Controls with terrain horizon clamping */}
        <OrbitControls
          enableDamping
          dampingFactor={0.06}
          minDistance={3.5}
          maxDistance={60}
          maxPolarAngle={Math.PI / 2 - 0.05} // Prevent camera going underground
          target={[0, 1.2, 0]}
        />

        {/* Dynamic Lighting and Martian distance atmospheric fog */}
        <LightingAndAtmosphere
          eraKey={currentEra}
          sunIntensity={sceneControls.sunIntensity}
        />

        {/* 1. Procedural Compound or GLTF Rover with 4-step cel-shading & ink outlines */}
        <group position={[0, 0, 0]}>
          <ToonModelLoader
            modelUrl="/models/rover.glb"
            forceProcedural={
              sceneControls.modelSource === 'Procedural Compound Rover'
            }
          />
        </group>

        {/* 2. Faceted Martian Terrain with 4-step Toon Material & flatShading */}
        <PlanetarySurface
          color={sceneControls.terrainColor}
          wireframe={sceneControls.wireframeTerrain}
        />

        {/* Optional Tactical Navigation Grid */}
        {sceneControls.showFacetedGrid && (
          <Grid
            position={[0, 0.05, 0]}
            args={[100, 100]}
            cellSize={2}
            cellThickness={0.8}
            cellColor="#00F0FF"
            sectionSize={10}
            sectionThickness={1.2}
            sectionColor="#FFB800"
            fadeDistance={45}
            infiniteGrid
          />
        )}

        {/* 3. Era-Reactive Post-Processing Pipeline (Pixelation, Scanline, Chroma, Vignette) */}
        <Suspense fallback={null}>
          <EraPostProcessing onEraChange={onEraChange} />
        </Suspense>
      </Canvas>
    </div>
  );
};
