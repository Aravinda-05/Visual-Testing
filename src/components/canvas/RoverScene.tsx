import React, { useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Perf } from 'r3f-perf';
import { useMissionStore } from '../../store/useMissionStore';
import { CuriosityRover, DriveControls } from '../CuriosityRover';
import { GaleCraterTerrain } from '../GaleCraterTerrain';
import { ScienceMechanics } from '../ScienceMechanics';
import { LightingAndAtmosphere } from './LightingAndAtmosphere';
import { DustTrail } from './DustTrail';
import { MastCameraRenderer } from '../OpticalSensorPiP';
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
  const roverPos = useMissionStore((s) => s.roverPos);
  const roverRotation = useMissionStore((s) => s.roverRotation);
  const cameraMode = useMissionStore((s) => s.cameraMode);
  const missionPhase = useMissionStore((s) => s.missionPhase);

  const targetSpot = useRef(
    new THREE.Vector3(
      JOHN_KLEIN_POS[0] + 0.2,
      getTerrainHeight(JOHN_KLEIN_POS[0], JOHN_KLEIN_POS[1]) + 0.95,
      JOHN_KLEIN_POS[1] - 0.1
    )
  );

  // Smooth camera yaw angle tracker (shortest-arc wrapping prevents snapping on turns)
  const cameraYaw = useRef(roverRotation);
  const lookTargetRef = useRef(new THREE.Vector3(0, 1.2, 0));
  const initialized = useRef(false);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.08);

    // During Soul-Transfer, camera ascent is handled by ScienceMechanics
    if (missionPhase === 'SOUL_TRANSFER_COMPLETE') return;

    if (cameraMode === 'FREE_ORBIT') {
      // In Free Roam Orbit mode, OrbitControls has full control of camera position
      // Smoothly guide OrbitControls target to follow the rover center
      if (controlsRef.current) {
        const roverCenter = new THREE.Vector3(roverPos[0], roverPos[1] + 0.9, roverPos[2]);
        controlsRef.current.target.lerp(roverCenter, Math.min(1.0, 12.0 * dt));
        controlsRef.current.update();
      }

      // Restore wide FOV
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const pCam = camera as THREE.PerspectiveCamera;
        pCam.fov = THREE.MathUtils.damp(pCam.fov, 45, 5.0, dt);
        pCam.updateProjectionMatrix();
      }
      return;
    }

    if (cameraMode === 'CHEMCAM_TELESCOPE') {
      // Position camera directly at Curiosity's Remote Sensing Mast looking down at the rock
      const mastX = roverPos[0] + 0.42;
      const mastY = roverPos[1] + 2.2;
      const mastZ = roverPos[2] + 0.85;

      const mastPos = new THREE.Vector3(mastX, mastY, mastZ);
      camera.position.lerp(mastPos, 6.0 * dt);

      // Narrow field of view zoom
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const pCam = camera as THREE.PerspectiveCamera;
        pCam.fov = THREE.MathUtils.damp(pCam.fov, 18, 5.0, dt);
        pCam.updateProjectionMatrix();
      }

      camera.lookAt(targetSpot.current);
    } else {
      // Third-Person Drone Chase Cam (Follow mode)
      // 1. Smoothly interpolate camera yaw behind the rover (circular shortest-arc math)
      let diff = (roverRotation - cameraYaw.current) % (Math.PI * 2);
      if (diff < -Math.PI) diff += Math.PI * 2;
      if (diff > Math.PI) diff -= Math.PI * 2;

      // On first frame, snap directly behind rover
      if (!initialized.current) {
        cameraYaw.current = roverRotation;
        lookTargetRef.current.set(roverPos[0], roverPos[1] + 1.05, roverPos[2]);
        initialized.current = true;
      } else {
        cameraYaw.current += diff * Math.min(1.0, 5.5 * dt);
      }

      // 2. Firm follow distance behind rover orientation
      const chaseDistance = 7.0;
      const chaseHeight = 3.2;

      const camFwdX = Math.sin(cameraYaw.current);
      const camFwdZ = Math.cos(cameraYaw.current);

      const targetCamX = roverPos[0] - camFwdX * chaseDistance;
      const targetCamZ = roverPos[2] - camFwdZ * chaseDistance;
      const targetCamY = roverPos[1] + chaseHeight;

      const targetCamPos = new THREE.Vector3(targetCamX, targetCamY, targetCamZ);

      // High-responsiveness follow (16.0 * dt) rigidly maintains 7.0m follow distance while driving!
      // Completely eliminates the rubberband lag where rover moved away before snapping back!
      camera.position.lerp(targetCamPos, Math.min(1.0, 16.0 * dt));

      // 3. Smooth Look Target directly at rover's center of mass
      const lookTarget = new THREE.Vector3(roverPos[0], roverPos[1] + 1.05, roverPos[2]);
      lookTargetRef.current.lerp(lookTarget, Math.min(1.0, 16.0 * dt));
      camera.lookAt(lookTargetRef.current);

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
  const roverPos = useMissionStore((s) => s.roverPos);
  const roverSpeed = useMissionStore((s) => s.roverSpeed);
  const roverRotation = useMissionStore((s) => s.roverRotation);
  const eraShader = useMissionStore((s) => s.eraShaderOverride);
  const cameraMode = useMissionStore((s) => s.cameraMode);

  // Map eraShader to Lighting era key
  const eraKey = eraShader === '1967_ANALOG' ? '1967_SURVEYOR' : eraShader === '1997_RETRO_16BIT' ? '1997_SOJOURNER' : '2021_MODERN';

  return (
    <div className="relative w-full h-full bg-[#05070B] overflow-hidden">
      <Canvas
        shadows
        camera={{ position: [0, 5.5, -9.5], fov: cameraMode === 'CHEMCAM_TELESCOPE' ? 24 : 45, near: 0.1, far: 500 }}
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

        {/* Orbit Controls (Available in FREE_ORBIT mode) */}
        <OrbitControls
          ref={controlsRef}
          enabled={cameraMode === 'FREE_ORBIT'}
          minDistance={2.5}
          maxDistance={85}
          maxPolarAngle={Math.PI / 2 - 0.05}
          enableDamping={true}
          dampingFactor={0.08}
        />

        {/* Dynamic Camera Director */}
        <CameraDirector controlsRef={controlsRef} />

        {/* Dynamic Martian Gale Crater Lighting and Atmospheric Distance Fog */}
        <LightingAndAtmosphere eraKey={eraKey} sunIntensity={2.5} />

        {/* 1. Gale Crater Terrain + John Klein Mudstone Target + Rock Hazards */}
        <GaleCraterTerrain />

        {/* 2. NASA Curiosity Rover (GLTF Draco + 4-band Toon + Outlines + Spatial Tags) */}
        <CuriosityRover controlsRef={driveControlsRef} />

        {/* 3. Regolith Dust Particle Trail behind wheels */}
        <DustTrail roverPos={roverPos} speed={roverSpeed} yaw={roverRotation} />

        {/* 4. ChemCam 1064nm Laser, Plasma Sparks & Soul-Transfer Ascending Beam */}
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

        {/* 5. Dedicated Remote Sensing Mast Secondary Camera & PiP Optical Sensor Renderer */}
        <MastCameraRenderer />
      </Canvas>
    </div>
  );
};
