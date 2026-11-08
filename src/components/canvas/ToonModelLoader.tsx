import React, { useMemo, Suspense, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF, Outlines } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { getFourStepGradientMap, applyCelShadingToHierarchy } from '../../utils/celShading';
import { SpatialTelemetryTag, TelemetryData } from './SpatialTelemetryTag';

// Telemetry datasets for the two diegetic tags
const SOLAR_ARRAY_TELEMETRY: TelemetryData = {
  subsystemId: 'EPS-SOLAR-ARRAY-01',
  title: 'Ultra-Flex PV Generator & Power Bus',
  status: 'NOMINAL',
  metrics: [
    { label: 'Bus Voltage', value: '31.84', unit: 'V' },
    { label: 'Solar Flux', value: '584.2', unit: 'W/m²' },
    { label: 'Panel Temp', value: '-24.6', unit: '°C' },
    { label: 'Dust Deposition', value: '8.4', unit: '%' },
  ],
};

const MAST_ARM_TELEMETRY: TelemetryData = {
  subsystemId: 'NAV-MAST-ARM-04',
  title: 'Mastcam-Z & Robotic Turret Assembly',
  status: 'ACTIVE',
  metrics: [
    { label: 'Azimuth Joint', value: '138.2°', unit: 'AZ' },
    { label: 'Elevation Joint', value: '+18.5°', unit: 'EL' },
    { label: 'Laser Spectrometer', value: 'READY', unit: '' },
    { label: 'Torque Sensor', value: '14.2', unit: 'N·m' },
  ],
};

interface ToonModelLoaderProps {
  modelUrl?: string;
  forceProcedural?: boolean;
}

/**
 * GLTF Loader component that attempts to load /models/rover.glb
 * and injects the 4-step cel-shading gradient map into all traversed meshes.
 */
function GLTFModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const gradientMap = useMemo(() => getFourStepGradientMap(), []);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    applyCelShadingToHierarchy(clone, gradientMap);

    // Automatically align bottom bounding box of any GLB model to ground level Y = 0
    const bbox = new THREE.Box3().setFromObject(clone);
    clone.position.y = -bbox.min.y;

    return clone;
  }, [scene, gradientMap]);

  return (
    <primitive object={clonedScene} scale={[1, 1, 1]} castShadow receiveShadow>
      <Outlines color="#090d16" thickness={0.015} />
    </primitive>
  );
}

/**
 * Procedural compound rover geometry built with precision boxes, cylinders,
 * suspension rocker-bogie arms, 6 wheels, mastcam, solar wings, and high-gain antenna.
 * Employs THREE.MeshToonMaterial with the 4-step gradient map on every part.
 *
 * Positioned at [0, 1.15, 0] so the 6 wheels (center Y: -0.75, radius: 0.42 -> contact Y: -1.17)
 * touch down firmly on the Martian landing pad (ground level Y = 0.00).
 */
function ProceduralRover() {
  const gradientMap = useMemo(() => getFourStepGradientMap(), []);
  const radarRef = useRef<THREE.Group>(null);
  const wheelsRef = useRef<THREE.Group>(null);

  // Subtle idle animation
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (radarRef.current) {
      radarRef.current.rotation.y = Math.sin(t * 0.5) * 0.4 + 0.2;
    }
  });

  // Reusable toon materials with 4-step Moebius gradient
  const materials = useMemo(
    () => ({
      whiteChassis: new THREE.MeshToonMaterial({
        color: '#E5E7EB',
        gradientMap,
      }),
      darkMetal: new THREE.MeshToonMaterial({
        color: '#1E293B',
        gradientMap,
      }),
      goldMLI: new THREE.MeshToonMaterial({
        color: '#D97706',
        gradientMap,
      }),
      solarDeck: new THREE.MeshToonMaterial({
        color: '#0F172A',
        gradientMap,
      }),
      cameraOptics: new THREE.MeshToonMaterial({
        color: '#00F0FF',
        gradientMap,
      }),
      antennaSilver: new THREE.MeshToonMaterial({
        color: '#CBD5E1',
        gradientMap,
      }),
      wheelTread: new THREE.MeshToonMaterial({
        color: '#334155',
        gradientMap,
      }),
      hubGold: new THREE.MeshToonMaterial({
        color: '#F59E0B',
        gradientMap,
      }),
    }),
    [gradientMap]
  );

  return (
    <group position={[0, 1.15, 0]}>
      {/* 1. MAIN CHASSIS WARM ELECTRONICS BOX (WEB) */}
      <mesh
        castShadow
        receiveShadow
        position={[0, 0.45, 0]}
        material={materials.whiteChassis}
      >
        <boxGeometry args={[2.0, 0.8, 3.2]} />
        <Outlines color="#090d16" thickness={0.015} />
      </mesh>

      {/* Gold Foil Thermal Insulation Undercarriage */}
      <mesh
        castShadow
        receiveShadow
        position={[0, 0.02, 0.2]}
        material={materials.goldMLI}
      >
        <boxGeometry args={[1.85, 0.4, 2.7]} />
        <Outlines color="#090d16" thickness={0.015} />
      </mesh>

      {/* 2. SOLAR PANEL ARRAY DECK (Photovoltaic Wings) */}
      <group position={[0, 0.9, 0]}>
        {/* Main Center Deck */}
        <mesh
          castShadow
          receiveShadow
          position={[0, 0.02, 0]}
          material={materials.solarDeck}
        >
          <boxGeometry args={[2.2, 0.06, 3.4]} />
          <Outlines color="#090d16" thickness={0.015} />
        </mesh>

        {/* Port (Left) Solar Wing */}
        <mesh
          castShadow
          receiveShadow
          position={[-1.7, 0.1, 0]}
          rotation={[0, 0, 0.08]}
          material={materials.solarDeck}
        >
          <boxGeometry args={[1.2, 0.05, 3.2]} />
          <Outlines color="#090d16" thickness={0.015} />
        </mesh>

        {/* Starboard (Right) Solar Wing */}
        <mesh
          castShadow
          receiveShadow
          position={[1.7, 0.1, 0]}
          rotation={[0, 0, -0.08]}
          material={materials.solarDeck}
        >
          <boxGeometry args={[1.2, 0.05, 3.2]} />
          <Outlines color="#090d16" thickness={0.015} />
        </mesh>

        {/* Aft Hexagonal Solar Extender */}
        <mesh
          castShadow
          receiveShadow
          position={[0, 0.08, -1.95]}
          material={materials.solarDeck}
        >
          <boxGeometry args={[1.6, 0.05, 0.9]} />
          <Outlines color="#090d16" thickness={0.015} />
        </mesh>

        {/* DIEGETIC CALLOUT 1: Attached directly to Solar Panel Wing */}
        <SpatialTelemetryTag
          position={[-1.7, 0.25, -0.4]}
          data={SOLAR_ARRAY_TELEMETRY}
          distanceFactor={12}
          offset={[-45, -70]}
        />
      </group>

      {/* 3. REMOTE SENSING MAST (PMA / Mastcam-Z Assembly) */}
      <group position={[0.55, 0.9, 1.2]} ref={radarRef}>
        {/* Mast Base Collar */}
        <mesh
          castShadow
          receiveShadow
          position={[0, 0.08, 0]}
          material={materials.darkMetal}
        >
          <cylinderGeometry args={[0.12, 0.16, 0.16, 12]} />
          <Outlines color="#090d16" thickness={0.015} />
        </mesh>

        {/* Vertical Mast Column */}
        <mesh
          castShadow
          receiveShadow
          position={[0, 0.85, 0]}
          material={materials.whiteChassis}
        >
          <cylinderGeometry args={[0.07, 0.07, 1.4, 12]} />
          <Outlines color="#090d16" thickness={0.015} />
        </mesh>

        {/* Mastcam-Z Sensor Head Crossbar */}
        <mesh
          castShadow
          receiveShadow
          position={[0, 1.58, 0]}
          material={materials.darkMetal}
        >
          <boxGeometry args={[0.55, 0.22, 0.28]} />
          <Outlines color="#090d16" thickness={0.015} />
        </mesh>

        {/* Stereo Navigation Camera Left Eye */}
        <mesh
          castShadow
          receiveShadow
          position={[-0.18, 1.58, 0.16]}
          rotation={[Math.PI / 2, 0, 0]}
          material={materials.cameraOptics}
        >
          <cylinderGeometry args={[0.06, 0.06, 0.1, 16]} />
          <Outlines color="#090d16" thickness={0.015} />
        </mesh>

        {/* Stereo Navigation Camera Right Eye */}
        <mesh
          castShadow
          receiveShadow
          position={[0.18, 1.58, 0.16]}
          rotation={[Math.PI / 2, 0, 0]}
          material={materials.cameraOptics}
        >
          <cylinderGeometry args={[0.06, 0.06, 0.1, 16]} />
          <Outlines color="#090d16" thickness={0.015} />
        </mesh>

        {/* SuperCam Cylindrical Spectrometer Hood */}
        <mesh
          castShadow
          receiveShadow
          position={[0, 1.76, 0.02]}
          rotation={[Math.PI / 2, 0, 0]}
          material={materials.whiteChassis}
        >
          <cylinderGeometry args={[0.08, 0.08, 0.26, 16]} />
          <Outlines color="#090d16" thickness={0.015} />
        </mesh>

        {/* DIEGETIC CALLOUT 2: Attached directly to Mast Head */}
        <SpatialTelemetryTag
          position={[0, 1.85, 0.2]}
          data={MAST_ARM_TELEMETRY}
          distanceFactor={12}
          offset={[50, -65]}
        />
      </group>

      {/* 4. HIGH-GAIN PARABOLIC DISH ANTENNA (HGA) */}
      <group position={[-0.65, 1.1, -0.9]} rotation={[0.4, 0.5, 0]}>
        <mesh
          castShadow
          receiveShadow
          position={[0, 0, 0]}
          material={materials.antennaSilver}
        >
          <cylinderGeometry args={[0.42, 0.08, 0.15, 20]} />
          <Outlines color="#090d16" thickness={0.015} />
        </mesh>
        <mesh
          castShadow
          receiveShadow
          position={[0, 0.16, 0]}
          material={materials.cameraOptics}
        >
          <cylinderGeometry args={[0.02, 0.02, 0.24, 8]} />
        </mesh>
      </group>

      {/* UHF Cylindrical Whip Antenna */}
      <mesh
        castShadow
        receiveShadow
        position={[0.7, 1.45, -1.2]}
        material={materials.darkMetal}
      >
        <cylinderGeometry args={[0.02, 0.02, 1.1, 8]} />
        <Outlines color="#090d16" thickness={0.015} />
      </mesh>

      {/* 5. ROBOTIC SAMPLING ARM (Instrument Turret) */}
      <group position={[-0.65, 0.45, 1.6]}>
        {/* Shoulder Yaw Joint */}
        <mesh castShadow receiveShadow material={materials.darkMetal}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <Outlines color="#090d16" thickness={0.015} />
        </mesh>
        {/* Upper Bicep Tube */}
        <mesh
          castShadow
          receiveShadow
          position={[0, -0.25, 0.4]}
          rotation={[0.6, 0, 0]}
          material={materials.whiteChassis}
        >
          <cylinderGeometry args={[0.06, 0.06, 0.8, 12]} />
          <Outlines color="#090d16" thickness={0.015} />
        </mesh>
        {/* Forearm & Rotary Turret Drill */}
        <mesh
          castShadow
          receiveShadow
          position={[0, -0.6, 0.95]}
          material={materials.darkMetal}
        >
          <cylinderGeometry args={[0.12, 0.12, 0.3, 12]} />
          <Outlines color="#090d16" thickness={0.015} />
        </mesh>
        {/* Drill Bit Coring Rod */}
        <mesh
          castShadow
          receiveShadow
          position={[0, -0.85, 1.05]}
          rotation={[Math.PI / 4, 0, 0]}
          material={materials.antennaSilver}
        >
          <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
        </mesh>
      </group>

      {/* 6. ROCKER-BOGIE MOBILITY SUSPENSION & 6 WHEELS */}
      <group ref={wheelsRef}>
        {/* Suspension Linkage Tubes (Left & Right) */}
        {[-1.3, 1.3].map((sideX, i) => (
          <group key={i}>
            {/* Main Rocker Arm */}
            <mesh
              castShadow
              receiveShadow
              position={[sideX * 0.9, -0.1, 0]}
              rotation={[0, 0, sideX > 0 ? -0.2 : 0.2]}
              material={materials.darkMetal}
            >
              <cylinderGeometry args={[0.05, 0.05, 2.6, 8]} />
              <Outlines color="#090d16" thickness={0.015} />
            </mesh>
            {/* Rocker Pivot Housing */}
            <mesh
              castShadow
              receiveShadow
              position={[sideX * 0.95, 0.1, 0.2]}
              rotation={[0, 0, Math.PI / 2]}
              material={materials.goldMLI}
            >
              <cylinderGeometry args={[0.1, 0.1, 0.3, 12]} />
              <Outlines color="#090d16" thickness={0.015} />
            </mesh>
          </group>
        ))}

        {/* 6 Wheels (Front, Middle, Rear on each side) */}
        {[
          { pos: [-1.45, -0.75, 1.35], name: 'W-FL' },
          { pos: [1.45, -0.75, 1.35], name: 'W-FR' },
          { pos: [-1.45, -0.75, 0.0], name: 'W-ML' },
          { pos: [1.45, -0.75, 0.0], name: 'W-MR' },
          { pos: [-1.45, -0.75, -1.35], name: 'W-RL' },
          { pos: [1.45, -0.75, -1.35], name: 'W-RR' },
        ].map((wheel, index) => (
          <group key={index} position={wheel.pos as [number, number, number]}>
            {/* Wheel Rim / Tire */}
            <mesh
              castShadow
              receiveShadow
              rotation={[0, 0, Math.PI / 2]}
              material={materials.wheelTread}
            >
              <cylinderGeometry args={[0.42, 0.42, 0.32, 22]} />
              <Outlines color="#090d16" thickness={0.015} />
            </mesh>
            {/* Wheel Hub Cap */}
            <mesh
              castShadow
              receiveShadow
              position={[wheel.pos[0] > 0 ? 0.17 : -0.17, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
              material={materials.hubGold}
            >
              <cylinderGeometry args={[0.16, 0.16, 0.05, 16]} />
              <Outlines color="#090d16" thickness={0.015} />
            </mesh>
            {/* Tire Cleats / Grousers */}
            {[0, 1, 2, 3, 4, 5].map((g) => (
              <mesh
                key={g}
                rotation={[(g * Math.PI) / 3, 0, 0]}
                material={materials.darkMetal}
              >
                <boxGeometry args={[0.34, 0.04, 0.86]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * Robust Error Boundary wrapper for asynchronous GLTF loading.
 * Gracefully switches to Procedural compound rover if file is missing or corrupt.
 */
class GLTFErrorBoundary extends React.Component<
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

  componentDidCatch(error: unknown) {
    console.info(
      '[ToonModelLoader] /models/rover.glb not found or failed to parse. Defaulting to procedural compound rover geometry.',
      error
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export const ToonModelLoader: React.FC<ToonModelLoaderProps> = ({
  modelUrl = '/models/rover.glb',
  forceProcedural = false,
}) => {
  if (forceProcedural) {
    return <ProceduralRover />;
  }

  return (
    <GLTFErrorBoundary fallback={<ProceduralRover />}>
      <Suspense fallback={<ProceduralRover />}>
        <GLTFModel url={modelUrl} />
      </Suspense>
    </GLTFErrorBoundary>
  );
};
