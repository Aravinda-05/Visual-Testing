import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Perf } from 'r3f-perf';
import { useMissionStore, CameraMode } from '../../store/useMissionStore';
import { CuriosityRover, DriveControls } from '../CuriosityRover';
import { GaleCraterTerrain } from '../GaleCraterTerrain';
import { CompressedSandboxArena } from '../CompressedSandboxArena';
import { OrbitalMuseumGlobe } from '../OrbitalMuseumGlobe';
import { ScienceMechanics } from '../ScienceMechanics';
import { LightingAndAtmosphere } from './LightingAndAtmosphere';
import { DustTrail } from './DustTrail';
import { MastCameraRenderer } from '../OpticalSensorPiP';
import { ApolloLevelScene } from '../ApolloLevelScene';
import { JOHN_KLEIN_POS, getTerrainHeight } from '../../utils/terrainMath';

interface CameraDirectorProps {
  controlsRef: React.RefObject<OrbitControlsImpl>;
}

/**
 * Camera Director component managing Third-Person Drone Chase Cam,
 * Mast-mounted ChemCam Telescope zoom, and Free Orbit modes.
 */
function CameraDirector({ controlsRef }: CameraDirectorProps) {
  const { camera } = useThree();
  const cameraMode = useMissionStore((s) => s.cameraMode);
  const missionPhase = useMissionStore((s) => s.missionPhase);
  const activeTier = useMissionStore((s) => s.activeTier);
  const prevTier = useRef(activeTier);

  const targetSpot = useRef(
    new THREE.Vector3(
      JOHN_KLEIN_POS[0] + 0.2,
      getTerrainHeight(JOHN_KLEIN_POS[0], JOHN_KLEIN_POS[1]) + 0.95,
      JOHN_KLEIN_POS[1] - 0.1
    )
  );

  // Smooth camera yaw angle tracker (shortest-arc wrapping prevents snapping on turns)
  const cameraYaw = useRef<number | null>(null);
  const camY = useRef<number | null>(null);
  const followDistance = useRef<number>(16.0);
  const prevRoverPos = useRef(new THREE.Vector3());
  const prevMode = useRef<CameraMode>(cameraMode);

  // Handle transitions between Orbital Museum Globe and Surface Sandbox
  useEffect(() => {
    if (activeTier === 'ORBITAL_MUSEUM') {
      camera.position.set(0, 2.0, 10.8);
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    } else if (prevTier.current === 'ORBITAL_MUSEUM' && activeTier === 'SURFACE_SANDBOX') {
      camera.position.set(0, 9.8, -16.0);
      cameraYaw.current = null;
      camY.current = null;
    }
    prevTier.current = activeTier;
  }, [activeTier, camera, controlsRef]);

  // Mouse wheel scroll to zoom in / out
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // In 3rd person follow mode, wheel scroll dynamically zooms follow distance
      if (useMissionStore.getState().activeTier === 'SURFACE_SANDBOX' && useMissionStore.getState().cameraMode === 'THIRD_PERSON_DRONE') {
        const delta = e.deltaY * 0.008;
        followDistance.current = THREE.MathUtils.clamp(followDistance.current + delta, 6.0, 35.0);
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.08);

    // Orbital globe camera is managed via OrbitControls
    if (activeTier === 'ORBITAL_MUSEUM') return;

    // During Soul-Transfer, camera ascent is handled by ScienceMechanics
    if (missionPhase === 'SOUL_TRANSFER_COMPLETE') return;

    // DIRECT THREE.JS SCENE GRAPH LOOKUP:
    // Query CuriosityRoverRoot directly from WebGL scene graph.
    // This completely eliminates React state batching latency (the root cause of rubberbanding)!
    const roverObj = state.scene.getObjectByName('CuriosityRoverRoot');
    if (!roverObj) return;

    const rPos = roverObj.position;
    const rYaw = roverObj.rotation.y;

    // Initialize on first valid frame: elevated 3/4 chase vista
    if (cameraYaw.current === null) {
      cameraYaw.current = rYaw;
      const initDist = followDistance.current;
      camY.current = rPos.y + (initDist * 0.48 + 2.4);
      prevRoverPos.current.copy(rPos);
    }

    // Handle camera mode transitions
    if (prevMode.current !== cameraMode) {
      if (cameraMode === 'FREE_ORBIT') {
        // Transitioning into FREE_ORBIT:
        if (controlsRef.current) {
          controlsRef.current.target.set(rPos.x, rPos.y + 0.9, rPos.z);
          controlsRef.current.update();
        }
      } else if (cameraMode === 'THIRD_PERSON_DRONE') {
        // Transitioning back to THIRD_PERSON_DRONE:
        const dx = rPos.x - camera.position.x;
        const dz = rPos.z - camera.position.z;
        cameraYaw.current = Math.atan2(dx, dz);
        camY.current = camera.position.y;
        followDistance.current = THREE.MathUtils.clamp(Math.hypot(dx, dz), 6.0, 35.0);
      }
      prevMode.current = cameraMode;
    }

    if (cameraMode === 'FREE_ORBIT') {
      // FREE ROAM ORBIT MODE:
      // Translate camera along with rover movement so Curiosity remains in frame if driven
      const deltaX = rPos.x - prevRoverPos.current.x;
      const deltaY = rPos.y - prevRoverPos.current.y;
      const deltaZ = rPos.z - prevRoverPos.current.z;

      camera.position.x += deltaX;
      camera.position.y += deltaY;
      camera.position.z += deltaZ;

      if (controlsRef.current) {
        controlsRef.current.target.set(rPos.x, rPos.y + 0.9, rPos.z);
        controlsRef.current.update();
      }

      prevRoverPos.current.copy(rPos);

      // Restore nominal wide FOV
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const pCam = camera as THREE.PerspectiveCamera;
        pCam.fov = THREE.MathUtils.damp(pCam.fov, 45, 5.0, dt);
        pCam.updateProjectionMatrix();
      }
      return;
    }

    prevRoverPos.current.copy(rPos);

    if (cameraMode === 'CHEMCAM_TELESCOPE') {
      // Mast-mounted ChemCam Telescope zoom
      const mastX = rPos.x + 0.42;
      const mastY = rPos.y + 2.2;
      const mastZ = rPos.z + 0.85;

      const mastPos = new THREE.Vector3(mastX, mastY, mastZ);
      camera.position.lerp(mastPos, 8.0 * dt);

      // Narrow field of view zoom
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const pCam = camera as THREE.PerspectiveCamera;
        pCam.fov = THREE.MathUtils.damp(pCam.fov, 18, 5.0, dt);
        pCam.updateProjectionMatrix();
      }

      camera.lookAt(targetSpot.current);
    } else {
      // THIRD PERSON DRONE CHASE CAM (Follow Mode):
      // 1. Smoothly interpolate camera yaw behind the rover (circular shortest-arc math)
      let diff = (rYaw - cameraYaw.current) % (Math.PI * 2);
      if (diff < -Math.PI) diff += Math.PI * 2;
      if (diff > Math.PI) diff -= Math.PI * 2;

      cameraYaw.current += diff * Math.min(1.0, 5.0 * dt);

      // 2. Direct translation anchoring:
      // The camera's horizontal offset is rigidly tied to the rover's instantaneous translation.
      // Zero distance stretching while driving, zero rubberband snapback!
      const dist = followDistance.current;
      const chaseHeight = dist * 0.48 + 2.4;

      const camFwdX = Math.sin(cameraYaw.current);
      const camFwdZ = Math.cos(cameraYaw.current);

      const targetCamX = rPos.x - camFwdX * dist;
      const targetCamZ = rPos.z - camFwdZ * dist;

      if (camY.current === null) camY.current = rPos.y + chaseHeight;
      camY.current = THREE.MathUtils.damp(camY.current, rPos.y + chaseHeight, 10.0, dt);

      camera.position.set(targetCamX, camY.current, targetCamZ);

      // 3. Look target directly at rover's center
      camera.lookAt(rPos.x, rPos.y + 0.8, rPos.z);

      // Restore nominal wide FOV
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const pCam = camera as THREE.PerspectiveCamera;
        pCam.fov = THREE.MathUtils.damp(pCam.fov, 45, 5.0, dt);
        pCam.updateProjectionMatrix();
      }
    }
  });

  return null;
}

interface RoverSceneProps {
  driveControlsRef: React.MutableRefObject<DriveControls>;
}

export const RoverScene: React.FC<RoverSceneProps> = ({ driveControlsRef }) => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const eraShader = useMissionStore((s) => s.eraShaderOverride);
  const cameraMode = useMissionStore((s) => s.cameraMode);
  const activeTier = useMissionStore((s) => s.activeTier);
  const activeLevel = useMissionStore((s) => s.activeLevel);

  // Map eraShader to Lighting era key
  const eraKey = eraShader === '1967_ANALOG' ? '1967_SURVEYOR' : eraShader === '1997_RETRO_16BIT' ? '1997_SOJOURNER' : '2021_MODERN';

  return (
    <div className="relative w-full h-full bg-[#05070B] overflow-hidden">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 9.8, -16.0], fov: cameraMode === 'CHEMCAM_TELESCOPE' ? 24 : 45, near: 0.1, far: 500 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        className="w-full h-full"
      >
        {/* Performance Monitor */}
        <Perf position="top-left" />

        {/* Level 1: Apollo 11 Lunar Module (Moon) vs Level 2: Curiosity Rover (Mars) */}
        {activeLevel === 'LEVEL_1_APOLLO_11' ? (
          <ApolloLevelScene />
        ) : (
          <>
            {/* Orbit Controls (Available in ORBITAL_MUSEUM or FREE_ORBIT mode) */}
            <OrbitControls
              ref={controlsRef}
              enabled={activeTier === 'ORBITAL_MUSEUM' || cameraMode === 'FREE_ORBIT'}
              minDistance={activeTier === 'ORBITAL_MUSEUM' ? 5.2 : 2.5}
              maxDistance={activeTier === 'ORBITAL_MUSEUM' ? 22.0 : 85}
              maxPolarAngle={activeTier === 'ORBITAL_MUSEUM' ? Math.PI : Math.PI / 2 - 0.05}
              enableDamping={true}
              dampingFactor={0.06}
            />

            {/* Dynamic Camera Director */}
            <CameraDirector controlsRef={controlsRef} />

            {/* Dynamic Martian Gale Crater Lighting and Atmospheric Distance Fog */}
            <LightingAndAtmosphere eraKey={eraKey} sunIntensity={2.5} />

            {/* Two-Tier System: Tier 1 Orbital Museum Globe vs Tier 2 Surface Sandbox */}
            {activeTier === 'ORBITAL_MUSEUM' ? (
              <OrbitalMuseumGlobe />
            ) : (
              <>
                {/* 1. Gale Crater Macro Topography */}
                <GaleCraterTerrain />

                {/* 2. Compressed Greatest Hits Sandbox Arena (5 Landmarks + 24 Low-Poly Boulders) */}
                <CompressedSandboxArena />

                {/* 3. NASA Curiosity Rover (GLTF Draco + 4-band Toon + Outlines + Spatial Tags) */}
                <CuriosityRover controlsRef={driveControlsRef} />

                {/* 4. Regolith Dust Particle Trail behind wheels */}
                <DustTrail />

                {/* 5. ChemCam 1064nm Laser, Plasma Sparks & Soul-Transfer Ascending Beam */}
                <ScienceMechanics />

                {/* Tactical Landing Pad Target Grid (local to touchdown site) */}
                <Grid
                  position={[0, 0.02, 0]}
                  args={[18, 18]}
                  cellSize={1.5}
                  cellThickness={0.8}
                  cellColor="#00F0FF"
                  sectionSize={6}
                  sectionThickness={1.2}
                  sectionColor="#FFB800"
                  fadeDistance={20}
                  fadeStrength={1.5}
                />

                {/* 6. Dedicated Remote Sensing Mast Secondary Camera & PiP Optical Sensor Renderer */}
                <MastCameraRenderer />
              </>
            )}
          </>
        )}
      </Canvas>
    </div>
  );
};
