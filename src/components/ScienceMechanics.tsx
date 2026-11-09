import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMissionStore } from '../store/useMissionStore';
import { JOHN_KLEIN_POS, getTerrainHeight } from '../utils/terrainMath';
import { soundEngine } from '../utils/soundEngine';

interface PlasmaSpark {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export const ScienceMechanics: React.FC = () => {
  const { camera } = useThree();
  const roverPos = useMissionStore((s) => s.roverPos);
  const roverRotation = useMissionStore((s) => s.roverRotation);
  const missionPhase = useMissionStore((s) => s.missionPhase);
  const distanceToTarget = useMissionStore((s) => s.distanceToTarget);
  const fireChemCamPulse = useMissionStore((s) => s.fireChemCamPulse);
  const cameraMode = useMissionStore((s) => s.cameraMode);
  const setCameraMode = useMissionStore((s) => s.setCameraMode);
  const setMissionPhase = useMissionStore((s) => s.setMissionPhase);

  // Laser beam visual state
  const [laserActive, setLaserActive] = useState(false);
  const laserBeamRef = useRef<THREE.Mesh>(null);
  const plasmaSparksRef = useRef<PlasmaSpark[]>([]);
  const sparkMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Soul Transfer ascending beam state
  const soulParticlesRef = useRef<{ pos: THREE.Vector3; speed: number }[]>([]);
  const soulMeshRef = useRef<THREE.InstancedMesh>(null);
  const soulDummy = useMemo(() => new THREE.Object3D(), []);
  const soulTriggered = useRef(false);

  // John Klein target position in 3D space
  const johnKleinTarget = useMemo(() => {
    const y = getTerrainHeight(JOHN_KLEIN_POS[0], JOHN_KLEIN_POS[1]) + 0.95;
    return new THREE.Vector3(JOHN_KLEIN_POS[0] + 0.2, y, JOHN_KLEIN_POS[1] - 0.1);
  }, []);

  // Dynamic active beam target position (either John Klein outcrop or ground test impact)
  const activeImpactSpot = useRef<THREE.Vector3>(johnKleinTarget.clone());

  // ChemCam Mast emitter world position
  const mastEmitter = useMemo(() => {
    return new THREE.Vector3(roverPos[0] + 0.42, roverPos[1] + 2.2, roverPos[2] + 0.85);
  }, [roverPos]);

  // Reset soul trigger when resetting mission
  useEffect(() => {
    if (missionPhase === 'EXPLORING') {
      soulTriggered.current = false;
    }
  }, [missionPhase]);

  // Laser firing trigger (works across all phases!)
  const triggerLaserPulse = useCallback(() => {
    const isNearTarget = distanceToTarget <= 7.0 || missionPhase === 'LASER_TARGETING';

    // If near John Klein, lock into LASER_TARGETING mode if not already
    if (isNearTarget && missionPhase === 'EXPLORING') {
      setCameraMode('CHEMCAM_TELESCOPE');
      setMissionPhase('LASER_TARGETING');
    }

    let impactPoint: THREE.Vector3;
    if (isNearTarget) {
      impactPoint = johnKleinTarget.clone();
    } else {
      // Calculate forward ground spot 7.5 meters ahead of rover
      const fwdX = Math.sin(roverRotation);
      const fwdZ = Math.cos(roverRotation);
      const blastX = roverPos[0] + fwdX * 7.5;
      const blastZ = roverPos[2] + fwdZ * 7.5;
      const blastY = getTerrainHeight(blastX, blastZ);
      impactPoint = new THREE.Vector3(blastX, blastY + 0.15, blastZ);
    }

    activeImpactSpot.current.copy(impactPoint);

    const result = fireChemCamPulse(isNearTarget);
    if (!result.hit) {
      if (result.overheated) {
        soundEngine.playWarningBeep();
      }
      return;
    }

    // Play ChemCam Acoustic Zap/Snap transient
    soundEngine.playChemCamSnap();

    // Trigger laser flash
    setLaserActive(true);
    setTimeout(() => setLaserActive(false), 85);

    // Spawn 24 glowing plasma spark particles at impact point
    for (let i = 0; i < 24; i++) {
      plasmaSparksRef.current.push({
        pos: impactPoint.clone(),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 5.0,
          Math.random() * 4.5 + 1.0,
          (Math.random() - 0.5) * 5.0
        ),
        life: 1.0,
        maxLife: 0.25 + Math.random() * 0.25,
      });
    }

    // If target was hit, check element harmonic chimes
    if (isNearTarget) {
      const hits = useMissionStore.getState().laserPulsesHit;
      if (hits === 8) soundEngine.playElementChime(0); // Hydrogen (656nm)
      if (hits === 16) soundEngine.playElementChime(1); // Silicon (288nm)
      if (hits === 24) soundEngine.playElementChime(2); // Iron (404nm)
      if (hits === 30) {
        soundEngine.playElementChime(3); // Magnesium (518nm)
        soundEngine.playElementChime(0);
      }
    }
  }, [
    distanceToTarget,
    missionPhase,
    roverPos,
    roverRotation,
    johnKleinTarget,
    fireChemCamPulse,
    setCameraMode,
    setMissionPhase,
  ]);

  // Handle laser firing input (Spacebar across all phases, or click when targeting)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        triggerLaserPulse();
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      // Allow clicking on screen to fire laser when in telescope mode
      if (cameraMode === 'CHEMCAM_TELESCOPE' || missionPhase === 'LASER_TARGETING') {
        const target = e.target as HTMLElement;
        if (target && !['BUTTON', 'INPUT', 'A'].includes(target.tagName)) {
          triggerLaserPulse();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [triggerLaserPulse, cameraMode, missionPhase]);

  // Soul Transfer Particle System initialization
  useEffect(() => {
    if (missionPhase === 'SOUL_TRANSFER_COMPLETE' && !soulTriggered.current) {
      soulTriggered.current = true;
      soundEngine.playSoulTransferBeam();

      // Initialize 120 ascending data particles
      soulParticlesRef.current = Array.from({ length: 120 }, () => ({
        pos: new THREE.Vector3(
          roverPos[0] + (Math.random() - 0.5) * 2.5,
          roverPos[1] + Math.random() * 5.0,
          roverPos[2] + (Math.random() - 0.5) * 2.5
        ),
        speed: 8.0 + Math.random() * 14.0,
      }));
    }
  }, [missionPhase, roverPos]);

  // Frame simulation for Sparks, Laser Beam orientation, and Soul Beam
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.08);

    // 1. Orient Laser Beam cylinder between mast and rock/ground target
    if (laserBeamRef.current && laserActive) {
      const target = activeImpactSpot.current;
      const dir = target.clone().sub(mastEmitter);
      const len = dir.length();
      laserBeamRef.current.position.copy(mastEmitter).add(dir.clone().multiplyScalar(0.5));
      laserBeamRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      laserBeamRef.current.scale.set(1, len, 1);
    }

    // 2. Update Plasma Sparks
    if (sparkMeshRef.current) {
      for (let i = plasmaSparksRef.current.length - 1; i >= 0; i--) {
        const s = plasmaSparksRef.current[i];
        s.life -= dt / s.maxLife;
        if (s.life <= 0) {
          plasmaSparksRef.current.splice(i, 1);
          continue;
        }
        s.pos.addScaledVector(s.vel, dt);
        s.vel.y -= 9.8 * dt; // Martian gravity
      }

      // Render sparks to instanced mesh
      for (let i = 0; i < 48; i++) {
        if (i < plasmaSparksRef.current.length) {
          const s = plasmaSparksRef.current[i];
          const scale = s.life * 0.14;
          dummy.position.copy(s.pos);
          dummy.scale.set(scale, scale, scale);
          dummy.updateMatrix();
        } else {
          dummy.position.set(0, -500, 0);
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
        }
        sparkMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      sparkMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // 3. Update Soul Transfer Ascending Beam & Cinematic Camera Ascent
    if (missionPhase === 'SOUL_TRANSFER_COMPLETE' && soulMeshRef.current) {
      soulParticlesRef.current.forEach((p, idx) => {
        p.pos.y += p.speed * dt;
        if (p.pos.y > roverPos[1] + 45.0) {
          p.pos.y = roverPos[1] + 1.2;
          p.pos.x = roverPos[0] + (Math.random() - 0.5) * 2.5;
          p.pos.z = roverPos[2] + (Math.random() - 0.5) * 2.5;
        }
        soulDummy.position.copy(p.pos);
        soulDummy.rotation.set(0, state.clock.getElapsedTime() * 3, 0);
        soulDummy.scale.set(0.18, 0.45, 0.18);
        soulDummy.updateMatrix();
        soulMeshRef.current?.setMatrixAt(idx, soulDummy.matrix);
      });
      soulMeshRef.current.instanceMatrix.needsUpdate = true;

      // Ascend camera into the heavens toward Mars Reconnaissance Orbiter
      camera.position.y += 3.8 * dt;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, roverPos[0] + 5, 2.0, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, roverPos[2] + 7, 2.0, dt);
      camera.lookAt(new THREE.Vector3(roverPos[0], roverPos[1] + 2, roverPos[2]));
    }
  });

  return (
    <group>
      {/* ChemCam 1064nm Infrared/Visible Plasma Laser Beam */}
      {laserActive && (
        <mesh ref={laserBeamRef}>
          <cylinderGeometry args={[0.035, 0.035, 1, 8]} />
          <meshBasicMaterial color="#FF1493" transparent opacity={0.92} />
        </mesh>
      )}

      {/* Plasma Spark Burst Particles */}
      <instancedMesh
        ref={sparkMeshRef}
        args={[undefined, undefined, 48]}
        frustumCulled={false}
      >
        <octahedronGeometry args={[0.3, 0]} />
        <meshBasicMaterial color="#00F0FF" />
      </instancedMesh>

      {/* Soul-Transfer Ascending Binary Particle Beam */}
      {missionPhase === 'SOUL_TRANSFER_COMPLETE' && (
        <>
          {/* Vertical Glowing Cylinder Pillar */}
          <mesh position={[roverPos[0], roverPos[1] + 25, roverPos[2]]}>
            <cylinderGeometry args={[1.6, 2.8, 50, 16, 1, true]} />
            <meshBasicMaterial
              color="#00F0FF"
              wireframe
              transparent
              opacity={0.35}
            />
          </mesh>

          {/* Ascending Binary Telemetry Particles */}
          <instancedMesh
            ref={soulMeshRef}
            args={[undefined, undefined, 120]}
            frustumCulled={false}
          >
            <boxGeometry args={[0.2, 0.4, 0.2]} />
            <meshBasicMaterial color="#00F0FF" />
          </instancedMesh>
        </>
      )}
    </group>
  );
};
