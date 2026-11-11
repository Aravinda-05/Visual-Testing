import React, { useMemo, Suspense, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF, Outlines, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMissionStore } from '../store/useMissionStore';
import { getTerrainHeight, ROCK_HAZARDS, JOHN_KLEIN_POS, resolveBoulderCollision } from '../utils/terrainSampler';
import { soundEngine } from '../utils/soundEngine';
import { getFourStepGradientMap, applyCelShadingToHierarchy } from '../utils/celShading';
import { RoverHotspots } from './RoverHotspots';

// Configure Draco decoder path so Draco compressed GLB loads seamlessly
useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

export interface DriveControls {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  brake: boolean;
  reset: boolean;
}

interface CuriosityRoverProps {
  controlsRef: React.MutableRefObject<DriveControls>;
}

/**
 * GLTF Loader Component for public/models/curiosity.glb
 */
function GLTFCuriosityModel() {
  const { scene } = useGLTF('/models/curiosity.glb');
  const gradientMap = useMemo(() => getFourStepGradientMap(), []);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    applyCelShadingToHierarchy(clone, gradientMap);

    // Compute bounding box to center rover and ground wheels cleanly to Y = 0
    const wheelNames = ['wheel_01_L', 'wheel_02_L', 'wheel_03_L', 'wheel_01_R', 'wheel_02_R', 'wheel_03_R'];
    const wheelsBox = new THREE.Box3();
    let hasWheels = false;
    wheelNames.forEach((name) => {
      const w = clone.getObjectByName(name);
      if (w) {
        w.updateWorldMatrix(true, true);
        const wBox = new THREE.Box3().setFromObject(w);
        wheelsBox.union(wBox);
        hasWheels = true;
      }
    });

    if (hasWheels && !wheelsBox.isEmpty()) {
      const wheelCenter = new THREE.Vector3();
      wheelsBox.getCenter(wheelCenter);
      // Center clone so that:
      // X = 0 is the lateral center between left and right wheels
      // Y = 0 is the exact ground contact point (bottom of wheels)
      // Z = 0 is the longitudinal center of the wheelbase
      clone.position.x = -wheelCenter.x;
      clone.position.y = -wheelsBox.min.y;
      clone.position.z = -wheelCenter.z;
    } else {
      const bbox = new THREE.Box3().setFromObject(clone);
      if (!bbox.isEmpty() && isFinite(bbox.min.y)) {
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        clone.position.x = -center.x;
        clone.position.y = -bbox.min.y;
        clone.position.z = -center.z;
      }
    }

    return clone;
  }, [scene, gradientMap]);

  return <primitive object={clonedScene} castShadow receiveShadow />;
}

/**
 * Procedural Articulated Curiosity Rover Fallback
 * Features chassis, angled rear MMRTG nuclear generator, Remote Sensing Mast with ChemCam lens,
 * robotic arm, hexagonal HGA, and 6 cleated wheels.
 */
function ProceduralCuriosity() {
  const gradientMap = useMemo(() => getFourStepGradientMap(), []);

  const materials = useMemo(
    () => ({
      chassisWhite: new THREE.MeshToonMaterial({ color: '#E2E8F0', gradientMap }),
      darkMetal: new THREE.MeshToonMaterial({ color: '#1E293B', gradientMap }),
      mmrtgFin: new THREE.MeshToonMaterial({ color: '#475569', gradientMap }),
      goldThermal: new THREE.MeshToonMaterial({ color: '#D97706', gradientMap }),
      chemCamLens: new THREE.MeshToonMaterial({ color: '#00F0FF', gradientMap }),
      hgaHexagon: new THREE.MeshToonMaterial({ color: '#CBD5E1', gradientMap }),
      aluminumWheel: new THREE.MeshToonMaterial({ color: '#64748B', gradientMap }),
    }),
    [gradientMap]
  );

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Main Chassis Warm Electronics Box (WEB) */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow material={materials.chassisWhite}>
        <boxGeometry args={[1.8, 0.65, 2.6]} />
        <Outlines thickness={0.015} color="#090d16" />
      </mesh>

      {/* Gold Foil Thermal Insulation Underbody */}
      <mesh position={[0, 0.42, 0.1]} castShadow receiveShadow material={materials.goldThermal}>
        <boxGeometry args={[1.65, 0.25, 2.2]} />
        <Outlines thickness={0.015} color="#090d16" />
      </mesh>

      {/* 2. Rear Angled MMRTG Nuclear Power Generator with Heat Radiating Fins */}
      <group position={[0, 0.85, -1.45]} rotation={[-0.26, 0, 0]}>
        {/* Core Cylinder */}
        <mesh castShadow receiveShadow material={materials.mmrtgFin}>
          <cylinderGeometry args={[0.32, 0.32, 0.85, 16]} />
          <Outlines thickness={0.015} color="#090d16" />
        </mesh>
        {/* Radiating Cooling Fins (8 cross fins) */}
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            rotation={[0, (i * Math.PI) / 4, 0]}
            castShadow
            receiveShadow
            material={materials.mmrtgFin}
          >
            <boxGeometry args={[0.95, 0.78, 0.04]} />
            <Outlines thickness={0.015} color="#090d16" />
          </mesh>
        ))}
      </group>

      {/* 3. Remote Sensing Mast (PMA) with ChemCam Cyclops Lens */}
      <group position={[0.42, 1.05, 0.85]}>
        {/* Mast Strut */}
        <mesh position={[0, 0.7, 0]} castShadow receiveShadow material={materials.chassisWhite}>
          <cylinderGeometry args={[0.06, 0.06, 1.4, 12]} />
          <Outlines thickness={0.015} color="#090d16" />
        </mesh>
        {/* Sensor Crossbar Head */}
        <mesh position={[0, 1.45, 0]} castShadow receiveShadow material={materials.darkMetal}>
          <boxGeometry args={[0.55, 0.22, 0.28]} />
          <Outlines thickness={0.015} color="#090d16" />
        </mesh>
        {/* ChemCam 1064nm Telescope Aperture (Cyclops Eye) */}
        <mesh
          position={[0, 1.62, 0.06]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
          material={materials.chemCamLens}
        >
          <cylinderGeometry args={[0.11, 0.11, 0.28, 16]} />
          <Outlines thickness={0.015} color="#090d16" />
        </mesh>
        {/* Stereo NavCams */}
        <mesh
          position={[-0.18, 1.45, 0.16]}
          rotation={[Math.PI / 2, 0, 0]}
          material={materials.chemCamLens}
        >
          <cylinderGeometry args={[0.04, 0.04, 0.08, 12]} />
        </mesh>
        <mesh
          position={[0.18, 1.45, 0.16]}
          rotation={[Math.PI / 2, 0, 0]}
          material={materials.chemCamLens}
        >
          <cylinderGeometry args={[0.04, 0.04, 0.08, 12]} />
        </mesh>
      </group>

      {/* 4. Hexagonal High-Gain Antenna (HGA) */}
      <group position={[-0.52, 1.15, -0.6]} rotation={[0.45, 0.35, 0]}>
        <mesh castShadow receiveShadow material={materials.hgaHexagon}>
          <cylinderGeometry args={[0.45, 0.45, 0.08, 6]} />
          <Outlines thickness={0.015} color="#090d16" />
        </mesh>
        <mesh position={[0, 0.14, 0]} material={materials.chemCamLens}>
          <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
        </mesh>
      </group>

      {/* 5. 5-DoF Robotic Sample Arm */}
      <group position={[-0.55, 0.55, 1.3]}>
        {/* Shoulder Joint */}
        <mesh material={materials.darkMetal}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <Outlines thickness={0.015} color="#090d16" />
        </mesh>
        {/* Upper Arm Bone */}
        <mesh position={[0, 0.35, 0.3]} rotation={[0.65, 0, 0]} material={materials.chassisWhite}>
          <cylinderGeometry args={[0.045, 0.045, 0.75, 10]} />
          <Outlines thickness={0.015} color="#090d16" />
        </mesh>
        {/* Elbow Joint */}
        <mesh position={[0, 0.65, 0.58]} material={materials.darkMetal}>
          <sphereGeometry args={[0.1, 10, 10]} />
        </mesh>
        {/* Forearm Bone */}
        <mesh position={[0, 0.5, 0.95]} rotation={[-0.5, 0, 0]} material={materials.chassisWhite}>
          <cylinderGeometry args={[0.04, 0.04, 0.8, 10]} />
          <Outlines thickness={0.015} color="#090d16" />
        </mesh>
        {/* Turret Instrument Tool Head (MAHLI, APXS, Drill) */}
        <mesh position={[0, 0.35, 1.3]} rotation={[0, 0.3, 0]} material={materials.darkMetal}>
          <boxGeometry args={[0.35, 0.28, 0.35]} />
          <Outlines thickness={0.015} color="#090d16" />
        </mesh>
      </group>

      {/* 6. Rocker-Bogie Suspension & 6 Aluminum Cleated Wheels */}
      {/* Wheel Positions: [Front-Left, Mid-Left, Rear-Left, Front-Right, Mid-Right, Rear-Right] */}
      {[
        [-1.35, 0.45, 1.15],
        [-1.38, 0.45, 0.0],
        [-1.35, 0.45, -1.15],
        [1.35, 0.45, 1.15],
        [1.38, 0.45, 0.0],
        [1.35, 0.45, -1.15],
      ].map((pos, idx) => (
        <group key={idx} position={pos as [number, number, number]}>
          {/* Wheel Hub & Rim */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow material={materials.aluminumWheel}>
            <cylinderGeometry args={[0.42, 0.42, 0.38, 20]} />
            <Outlines thickness={0.015} color="#090d16" />
          </mesh>
          {/* Cleated Chevron Grousers (6 cleats per wheel) */}
          {[0, 1, 2, 3, 4, 5].map((c) => (
            <mesh
              key={c}
              rotation={[(c * Math.PI) / 3, 0, 0]}
              position={[0, 0, 0]}
              material={materials.darkMetal}
            >
              <boxGeometry args={[0.4, 0.88, 0.04]} />
            </mesh>
          ))}
          {/* Suspension Drive Axel Pivot */}
          <mesh
            position={[pos[0] > 0 ? -0.17 : 0.17, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            material={materials.darkMetal}
          >
            <cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Error boundary wrapping the GLTF Curiosity Model with seamless procedural fallback
 */
class ModelErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.info('Curiosity GLB model fallback engaged:', err);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export const CuriosityRover: React.FC<CuriosityRoverProps> = ({ controlsRef }) => {
  const roverGroupRef = useRef<THREE.Group>(null);

  // Zustand Store Selectors
  const missionPhase = useMissionStore((s) => s.missionPhase);
  const mmrtgCoreTempC = useMissionStore((s) => s.mmrtgCoreTempC);
  const mmrtgCooldown = useMissionStore((s) => s.mmrtgCooldown);
  const wheelIntegrityPct = useMissionStore((s) => s.wheelIntegrityPct);
  const laserPulsesHit = useMissionStore((s) => s.laserPulsesHit);
  const resetCounter = useMissionStore((s) => s.resetCounter);
  const setRoverTransform = useMissionStore((s) => s.setRoverTransform);
  const damageWheel = useMissionStore((s) => s.damageWheel);
  const tickClock = useMissionStore((s) => s.tickClock);

  // Internal kinematic state (high frequency 60fps)
  const pos = useRef(new THREE.Vector3(0, 0, 0));
  const yaw = useRef(0);
  const pitch = useRef(0);
  const roll = useRef(0);
  const speed = useRef(0);
  const steerAngle = useRef(0);
  const lastHazardCheck = useRef(0);
  const lastResetCounter = useRef(resetCounter);
  const isFirstFrame = useRef(true);
  const lastStoreUpdate = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.08);

    // Update mission clock countdowns
    tickClock(dt);

    const input = controlsRef.current;

    // Kinematics reset when [R] is pressed or store reset counter changes
    if (input.reset || lastResetCounter.current !== resetCounter) {
      lastResetCounter.current = resetCounter;
      isFirstFrame.current = true;
      input.reset = false;
      pos.current.set(0, 0, 0);
      yaw.current = 0;
      pitch.current = 0;
      roll.current = 0;
      speed.current = 0;
      steerAngle.current = 0;
      if (roverGroupRef.current) {
        roverGroupRef.current.position.set(0, 0, 0);
        roverGroupRef.current.rotation.set(0, 0, 0);
      }
      soundEngine.updateDriveSound(0, 100);
      setRoverTransform([0, 0, 0], 0, 0, 0, 0, 34.0);
      return;
    }

    if (missionPhase === 'SOUL_TRANSFER_COMPLETE') return;

    // 1. Steering & Wheel Drift
    // Wheel damage adds lateral drift pulling toward the damaged wheel
    const driftFactor = (100 - wheelIntegrityPct) * 0.003;
    let targetSteer = 0;
    if (input.left) targetSteer += 1;
    if (input.right) targetSteer -= 1;
    targetSteer += driftFactor; // Drift pull

    steerAngle.current = THREE.MathUtils.damp(steerAngle.current, targetSteer * 0.52, 6.0, dt);

    // 2. Throttle & Top Speed (Puncture Speed Penalty)
    const integritySpeedFactor = Math.max(0.70, wheelIntegrityPct / 100.0);
    // Dynamic cruise speed: 16.0 m/s (~58 km/h). Boost speed (Shift): 28.0 m/s (~100 km/h)
    const maxForward = (input.boost ? 28.0 : 16.0) * integritySpeedFactor;
    const maxReverse = -8.0 * integritySpeedFactor;

    let throttle = 0;
    if (input.forward) throttle += 1;
    if (input.backward) throttle -= 1;

    // If MMRTG is in thermal lock, kill throttle
    if (mmrtgCooldown) {
      throttle = 0;
    }

    if (input.brake) {
      speed.current = THREE.MathUtils.damp(speed.current, 0, 24.0, dt);
    } else if (throttle > 0) {
      speed.current = THREE.MathUtils.damp(speed.current, maxForward, 14.0, dt);
    } else if (throttle < 0) {
      speed.current = THREE.MathUtils.damp(speed.current, maxReverse, 12.0, dt);
    } else {
      speed.current = THREE.MathUtils.damp(speed.current, 0, 8.0, dt);
    }

    // 3. Turning Yaw
    const isMoving = Math.abs(speed.current) > 0.1;
    if (isMoving) {
      yaw.current += steerAngle.current * 2.6 * Math.sign(speed.current) * dt;
    } else if (targetSteer !== 0) {
      // Stationary pivot turn
      yaw.current += targetSteer * 2.0 * dt;
    }

    // 4. Position Translation
    const fwdX = Math.sin(yaw.current);
    const fwdZ = Math.cos(yaw.current);
    pos.current.x += fwdX * speed.current * dt;
    pos.current.z += fwdZ * speed.current * dt;

    // Resolve low-poly obstacle boulder collisions:
    // Nudges chassis smoothly around rocks without clipping or sticking
    const boulderResolution = resolveBoulderCollision(pos.current.x, pos.current.z, 1.45);
    pos.current.x = boulderResolution.x;
    pos.current.z = boulderResolution.z;

    if (boulderResolution.collided && Math.abs(speed.current) > 2.8) {
      damageWheel(2.0 * dt);
      soundEngine.playWarningBeep();
      speed.current *= 0.88; // Gentle deflection deceleration
    }

    // Gale Crater boundary clamp ([-88, 88])
    pos.current.x = THREE.MathUtils.clamp(pos.current.x, -88, 88);
    pos.current.z = THREE.MathUtils.clamp(pos.current.z, -88, 88);

    // 5. Terrain Elevation & 4-Corner Wheel Suspension Probes
    const groundY = getTerrainHeight(pos.current.x, pos.current.z);

    const halfWheelbase = 1.10;
    const halfTrackwidth = 1.05;
    const rightX = Math.cos(yaw.current);
    const rightZ = -Math.sin(yaw.current);

    // 4 Corner outer wheel elevation probes
    const flX = pos.current.x + fwdX * halfWheelbase - rightX * halfTrackwidth;
    const flZ = pos.current.z + fwdZ * halfWheelbase - rightZ * halfTrackwidth;
    const yFL = getTerrainHeight(flX, flZ);

    const frX = pos.current.x + fwdX * halfWheelbase + rightX * halfTrackwidth;
    const frZ = pos.current.z + fwdZ * halfWheelbase + rightZ * halfTrackwidth;
    const yFR = getTerrainHeight(frX, frZ);

    const rlX = pos.current.x - fwdX * halfWheelbase - rightX * halfTrackwidth;
    const rlZ = pos.current.z - fwdZ * halfWheelbase - rightZ * halfTrackwidth;
    const yRL = getTerrainHeight(rlX, rlZ);

    const rrX = pos.current.x - fwdX * halfWheelbase + rightX * halfTrackwidth;
    const rrZ = pos.current.z - fwdZ * halfWheelbase + rightZ * halfTrackwidth;
    const yRR = getTerrainHeight(rrX, rrZ);

    // Front/Rear and Left/Right axle centers
    const yFront = (yFL + yFR) * 0.5;
    const yRear = (yRL + yRR) * 0.5;
    const yLeft = (yFL + yRL) * 0.5;
    const yRight = (yFR + yRR) * 0.5;

    // Pitch: Negative sign ensures that when front is higher (uphill), pitch is negative,
    // which tilts the front of the rover UP in Three.js right-handed YXZ rotation!
    const targetPitch = -Math.atan2(yFront - yRear, halfWheelbase * 2);
    // Roll: Positive roll lifts the right side (+X)
    const targetRoll = Math.atan2(yRight - yLeft, halfTrackwidth * 2);

    pitch.current = THREE.MathUtils.damp(pitch.current, targetPitch, 9.0, dt);
    roll.current = THREE.MathUtils.damp(roll.current, targetRoll, 9.0, dt);

    // Ground contact height at the center of the wheelbase
    const avgWheelGround = (yFL + yFR + yRL + yRR) * 0.25;
    const targetY = avgWheelGround;

    if (isFirstFrame.current) {
      pos.current.y = targetY;
      isFirstFrame.current = false;
    } else {
      pos.current.y = THREE.MathUtils.damp(pos.current.y, targetY, 15.0, dt);
    }

    // Update 3D Object transform and attach live kinematic properties for 3D elements
    if (roverGroupRef.current) {
      roverGroupRef.current.position.set(pos.current.x, pos.current.y, pos.current.z);
      roverGroupRef.current.rotation.set(pitch.current, yaw.current, roll.current, 'YXZ');
      roverGroupRef.current.userData = {
        speed: speed.current,
        yaw: yaw.current,
        pitch: pitch.current,
        roll: roll.current,
      };
    }

    // 6. Sound Synthesis
    soundEngine.updateDriveSound(speed.current, wheelIntegrityPct);

    // 7. Hazard Detection: Check distance to basalt ventifacts
    const now = Date.now();
    if (now - lastHazardCheck.current > 200) {
      lastHazardCheck.current = now;
      if (Math.abs(speed.current) > 2.0) {
        for (const rock of ROCK_HAZARDS) {
          const distToRock = Math.hypot(pos.current.x - rock.x, pos.current.z - rock.z);
          if (distToRock < 1.7) {
            // Speeding impact punctures thin 0.75mm aluminum wheel grousers!
            damageWheel(3.5);
            soundEngine.playWarningBeep();
            break;
          }
        }
      }
    }

    // Distance to John Klein mudstone target
    const distToTarget = Math.hypot(pos.current.x - JOHN_KLEIN_POS[0], pos.current.z - JOHN_KLEIN_POS[1]);

    // Push to Zustand store (throttled to 10Hz to eliminate React re-render thrashing!)
    const perfNow = performance.now();
    if (perfNow - lastStoreUpdate.current > 100) {
      lastStoreUpdate.current = perfNow;
      setRoverTransform(
        [pos.current.x, pos.current.y, pos.current.z],
        yaw.current,
        pitch.current,
        roll.current,
        speed.current,
        distToTarget
      );
    }
  });

  return (
    <group ref={roverGroupRef} name="CuriosityRoverRoot" position={[0, 0, 0]}>
      {/* Primary Model Loader with Draco compression + fallback */}
      <ModelErrorBoundary fallback={<ProceduralCuriosity />}>
        <Suspense fallback={<ProceduralCuriosity />}>
          <GLTFCuriosityModel />
        </Suspense>
      </ModelErrorBoundary>

      {/* Interactive 3D Hardware Hotspot Inspection System */}
      <RoverHotspots />
    </group>
  );
};
