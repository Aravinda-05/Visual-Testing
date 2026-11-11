/**
 * CompressedSandboxArena.tsx - Two-Tier Compressed "Greatest Hits" Sandbox Engine
 *
 * Implements:
 * 1. 24 Deterministic Low-Poly Faceted Boulders (InstancedMesh, MeshToonMaterial, flatShading)
 *    with 6m safe corridors around all landmarks.
 * 2. 5 Canonical Mission Nodes within a 45m - 90m radial ring:
 *    - SPAWN_PAD (0, 0): Bradbury Landing flat touchdown zone.
 *    - SITE_1_BASALT (-42, -35): Volcanic crater-rim boulder perched on a 30° scarp ledge (7m ChemCam standoff).
 *    - SITE_2_CONGLOMERATE (52, -28): Hottah ancient riverbed gravel outcrop with rounded pebbles.
 *    - SITE_3_MUDSTONE (12, 68): Yellowknife Bay (John Klein) polygonal cracked mudstone & drill fault site.
 *    - BONUS_RELIC (-65, 55): Discarded Sky Crane descent stage & 21.5m parachute debris (+250 XP).
 * 3. Elevation & Normal Snapping: Landmark bases adhere to getTerrainHeight() and getTerrainNormal().
 * 4. Ground-Projected Topographic Ring Pulses (#00F0FF & #FFB800) with proximity fade.
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  ARENA_LANDMARKS,
  BOULDER_OBSTACLES,
  getTerrainHeight,
  getTerrainNormal,
  LandmarkDef,
} from '../utils/terrainSampler';
import { getFourStepGradientMap } from '../utils/celShading';
import { useMissionStore } from '../store/useMissionStore';
import { soundEngine } from '../utils/soundEngine';
import { Sparkles, CheckCircle2, Target, AlertTriangle, Compass, Award } from 'lucide-react';

export const CompressedSandboxArena: React.FC = () => {
  const gradientMap = useMemo(() => getFourStepGradientMap(), []);
  const instancedBouldersRef = useRef<THREE.InstancedMesh>(null);

  const roverPos = useMissionStore((s) => s.roverPos);
  const cameraMode = useMissionStore((s) => s.cameraMode);
  const isOpticalFeedOpen = useMissionStore((s) => s.isOpticalFeedOpen);
  const discoveredLandmarks = useMissionStore((s) => s.discoveredLandmarks);
  const discoverLandmark = useMissionStore((s) => s.discoverLandmark);
  const drillFaultActive = useMissionStore((s) => s.drillFaultActive);
  const drillFaultResolved = useMissionStore((s) => s.drillFaultResolved);
  const triggerDrillFault = useMissionStore((s) => s.triggerDrillFault);
  const resolveDrillFault = useMissionStore((s) => s.resolveDrillFault);
  const setCameraMode = useMissionStore((s) => s.setCameraMode);
  const setMissionPhase = useMissionStore((s) => s.setMissionPhase);

  // Pulse animation time reference
  const pulseRingsRef = useRef<{ [key: string]: THREE.MeshBasicMaterial }>({});

  // 1. Boulder Field Instanced Mesh Material (Dark Basalt Rust)
  const boulderMaterial = useMemo(() => {
    const mat = new THREE.MeshToonMaterial({
      color: '#6E2C1B',
      gradientMap,
    });
    (mat as unknown as { flatShading: boolean }).flatShading = true;
    mat.defines = { ...mat.defines, FLAT_SHADED: '' };
    mat.needsUpdate = true;
    return mat;
  }, [gradientMap]);

  // 2. Initialize 24 Low-Poly Faceted Boulders on Mount
  useEffect(() => {
    const mesh = instancedBouldersRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();

    BOULDER_OBSTACLES.forEach((b, i) => {
      const groundY = getTerrainHeight(b.x, b.z);
      const normal = getTerrainNormal(b.x, b.z);

      // Embed rock ~15% into terrain so it sits naturally
      const rockY = groundY + b.scale[1] * 0.42;

      dummy.position.set(b.x, rockY, b.z);
      dummy.scale.set(b.scale[0], b.scale[1], b.scale[2]);

      // Slight alignment to slope normal plus seeded yaw
      const alignQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rotation[1]);
      dummy.quaternion.copy(alignQ.multiply(yawQ));

      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  // Animate Ground-Projected Topographic Pulses
  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    Object.entries(pulseRingsRef.current).forEach(([id, mat]) => {
      if (!mat) return;
      const landmark = ARENA_LANDMARKS[id];
      if (!landmark) return;

      const dist = Math.hypot(roverPos[0] - landmark.pos[0], roverPos[2] - landmark.pos[1]);
      const isNear = dist < 22.0 || isOpticalFeedOpen;
      const baseAlpha = isNear ? 0.65 : 0.22;
      const pulse = Math.sin(time * 3.5 + landmark.radialDist * 0.1) * 0.18;

      mat.opacity = THREE.MathUtils.clamp(baseAlpha + pulse, 0.05, 0.95);
    });
  });

  return (
    <group name="CompressedSandboxArena">
      {/* ================================================================= */}
      {/* 1. INSTANCED LOW-POLY BOULDER FIELD (24 Basaltic Obstacles)       */}
      {/* ================================================================= */}
      <instancedMesh
        ref={instancedBouldersRef}
        args={[undefined, undefined, BOULDER_OBSTACLES.length]}
        material={boulderMaterial}
        castShadow
        receiveShadow
      >
        <dodecahedronGeometry args={[1.0, 0]} />
      </instancedMesh>

      {/* ================================================================= */}
      {/* 2. THE 5 COMPRESSED LANDMARKS & GROUND-PROJECTED DIEGETIC RINGS   */}
      {/* ================================================================= */}

      {/* --- (A) SPAWN PAD: Bradbury Landing (0, 0) --- */}
      <LandmarkNode
        landmark={ARENA_LANDMARKS.SPAWN_PAD}
        roverPos={roverPos}
        isDiscovered={discoveredLandmarks.includes('SPAWN_PAD')}
        cameraMode={cameraMode}
        onDiscover={() => discoverLandmark('SPAWN_PAD')}
        ringMatRef={(mat) => { if (mat) pulseRingsRef.current.SPAWN_PAD = mat; }}
      >
        {/* Hexagonal Bradbury Touchdown Decal */}
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
          <circleGeometry args={[4.2, 6]} />
          <meshBasicMaterial color="#00F0FF" wireframe transparent opacity={0.4} />
        </mesh>
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.0, 2.15, 32]} />
          <meshBasicMaterial color="#00F0FF" transparent opacity={0.7} />
        </mesh>
      </LandmarkNode>

      {/* --- (B) SITE 1: Gale Rim Volcanic Basalt (-42, -35) --- */}
      <LandmarkNode
        landmark={ARENA_LANDMARKS.SITE_1_BASALT}
        roverPos={roverPos}
        isDiscovered={discoveredLandmarks.includes('SITE_1_BASALT')}
        cameraMode={cameraMode}
        onDiscover={() => {
          discoverLandmark('SITE_1_BASALT');
          soundEngine.playHotspotSelect();
        }}
        ringMatRef={(mat) => { if (mat) pulseRingsRef.current.SITE_1_BASALT = mat; }}
      >
        {/* Steep 30° Igneous Columnar Scarp Formation */}
        <group position={[0, 0.8, 0]}>
          {/* Base volcanic sill */}
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[2.8, 4.0, 1.8, 6]} />
            <meshToonMaterial color="#2E1813" gradientMap={gradientMap} />
          </mesh>
          {/* Main Standoff Laser Target Basalt Block */}
          <mesh position={[0.4, 1.35, -0.2]} rotation={[0.15, 0.3, -0.1]} castShadow receiveShadow>
            <boxGeometry args={[1.8, 1.4, 2.0]} />
            <meshToonMaterial color="#1C100C" gradientMap={gradientMap} />
          </mesh>
          {/* Secondary basalt spires */}
          <mesh position={[-1.2, 0.9, 0.8]} rotation={[-0.1, 0.5, 0.2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.5, 0.9, 1.5, 5]} />
            <meshToonMaterial color="#24130E" gradientMap={gradientMap} />
          </mesh>
          {/* Laser targeting reticle mark on rock */}
          <mesh position={[0.4, 1.5, 0.82]} rotation={[0, 0, 0]}>
            <ringGeometry args={[0.12, 0.18, 16]} />
            <meshBasicMaterial color="#FF1493" transparent opacity={0.85} />
          </mesh>
        </group>
      </LandmarkNode>

      {/* --- (C) SITE 2: Hottah Fluvial Conglomerate (52, -28) --- */}
      <LandmarkNode
        landmark={ARENA_LANDMARKS.SITE_2_CONGLOMERATE}
        roverPos={roverPos}
        isDiscovered={discoveredLandmarks.includes('SITE_2_CONGLOMERATE')}
        cameraMode={cameraMode}
        onDiscover={() => {
          discoverLandmark('SITE_2_CONGLOMERATE');
          soundEngine.playHotspotSelect();
        }}
        ringMatRef={(mat) => { if (mat) pulseRingsRef.current.SITE_2_CONGLOMERATE = mat; }}
      >
        {/* Ancient Streambed Gravel Slab Formation */}
        <group position={[0, 0.45, 0]}>
          {/* Main sedimentary gravel slab */}
          <mesh castShadow receiveShadow rotation={[0.08, 0.25, -0.05]}>
            <boxGeometry args={[4.2, 0.5, 3.2]} />
            <meshToonMaterial color="#8C5338" gradientMap={gradientMap} />
          </mesh>
          {/* Upper fractured terrace */}
          <mesh position={[-0.5, 0.4, -0.4]} rotation={[-0.05, 0.4, 0.08]} castShadow receiveShadow>
            <boxGeometry args={[2.8, 0.4, 2.2]} />
            <meshToonMaterial color="#A36647" gradientMap={gradientMap} />
          </mesh>
          {/* Water-rounded fluvial pebbles (distinct rounded cobbles) */}
          {[
            [-1.2, 0.35, 0.6, 0.22],
            [-0.7, 0.32, 0.9, 0.18],
            [0.8, 0.34, 0.4, 0.25],
            [1.2, 0.33, -0.6, 0.19],
            [0.2, 0.68, -0.2, 0.15],
            [-0.9, 0.67, -0.6, 0.2],
          ].map(([px, py, pz, pr], idx) => (
            <mesh key={idx} position={[px, py, pz]} castShadow>
              <sphereGeometry args={[pr, 8, 8]} />
              <meshToonMaterial color="#C59B7E" gradientMap={gradientMap} />
            </mesh>
          ))}
        </group>
      </LandmarkNode>

      {/* --- (D) SITE 3: Yellowknife Bay // John Klein (12, 68) --- */}
      <LandmarkNode
        landmark={ARENA_LANDMARKS.SITE_3_MUDSTONE}
        roverPos={roverPos}
        isDiscovered={discoveredLandmarks.includes('SITE_3_MUDSTONE')}
        cameraMode={cameraMode}
        onDiscover={() => {
          discoverLandmark('SITE_3_MUDSTONE');
          soundEngine.playHotspotSelect();
        }}
        ringMatRef={(mat) => { if (mat) pulseRingsRef.current.SITE_3_MUDSTONE = mat; }}
        actionPrompt={
          drillFaultActive ? (
            <div className="flex flex-col gap-1 items-center">
              <span className="text-red-400 font-bold animate-pulse text-[9px] flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-400" />
                DRILL FEED MOTOR STALL DETECTED!
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resolveDrillFault();
                  soundEngine.playAntennaClick();
                }}
                className="px-2 py-0.5 rounded bg-amber-500 text-black font-bold text-[8.5px] hover:bg-amber-400 transition shadow-[0_0_10px_#F59E0B]"
              >
                PERCUSSIVE REVERSE PULSE [RESOLVE]
              </button>
            </div>
          ) : !drillFaultResolved ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                triggerDrillFault();
                soundEngine.playWarningBeep();
              }}
              className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-400 text-cyan-200 font-bold text-[8.5px] hover:bg-cyan-800 transition"
            >
              ENGAGE PERCUSSIVE DRILL TEST
            </button>
          ) : (
            <span className="text-emerald-400 font-bold text-[8.5px] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              SMECTITE CLAY DRILL CORE SECURED
            </span>
          )
        }
      >
        {/* Lacustrine Mudstone Bedding & Polygonal Tiles */}
        <group position={[0, 0.45, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[4.8, 0.55, 3.8]} />
            <meshToonMaterial color="#6E442B" gradientMap={gradientMap} />
          </mesh>
          <mesh position={[0.6, 0.45, -0.3]} castShadow receiveShadow>
            <boxGeometry args={[3.0, 0.4, 2.5]} />
            <meshToonMaterial color="#7D4F33" gradientMap={gradientMap} />
          </mesh>
          {/* White Calcium Sulfate Mineral Veins indicative of fresh water */}
          <mesh position={[0.2, 0.58, -0.1]} rotation={[0, 0.35, 0]}>
            <boxGeometry args={[2.8, 0.06, 0.12]} />
            <meshBasicMaterial color="#E2E8F0" />
          </mesh>
          <mesh position={[-0.4, 0.57, 0.4]} rotation={[0, -0.5, 0]}>
            <boxGeometry args={[2.0, 0.05, 0.1]} />
            <meshBasicMaterial color="#E2E8F0" />
          </mesh>
          {/* 1.6cm Drill Hole in Mudstone */}
          <mesh position={[0.8, 0.72, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.25, 16]} />
            <meshBasicMaterial color="#1A0D09" />
          </mesh>
          {/* Grey drill powder tailings ring around hole */}
          <mesh position={[0.8, 0.73, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.08, 0.35, 24]} />
            <meshBasicMaterial color="#94A3B8" transparent opacity={0.85} />
          </mesh>
        </group>
      </LandmarkNode>

      {/* --- (E) BONUS RELIC: Sky Crane Impact Site (-65, 55) --- */}
      <LandmarkNode
        landmark={ARENA_LANDMARKS.BONUS_RELIC}
        roverPos={roverPos}
        isDiscovered={discoveredLandmarks.includes('BONUS_RELIC')}
        cameraMode={cameraMode}
        onDiscover={() => {
          discoverLandmark('BONUS_RELIC');
          soundEngine.playAntennaClick();
        }}
        ringMatRef={(mat) => { if (mat) pulseRingsRef.current.BONUS_RELIC = mat; }}
      >
        {/* Crashed Rocket Descent Stage & Supersonic Parachute Relics */}
        <group position={[0, 0.4, 0]}>
          {/* Impact Scorch Mark Ring */}
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[4.5, 24]} />
            <meshBasicMaterial color="#0F0907" transparent opacity={0.65} />
          </mesh>

          {/* Shattered Titanium Descent Stage Airframe */}
          <mesh position={[0, 0.65, 0]} rotation={[0.3, 0.6, -0.4]} castShadow receiveShadow>
            <cylinderGeometry args={[0.9, 1.4, 1.3, 8]} />
            <meshToonMaterial color="#475569" gradientMap={gradientMap} />
          </mesh>
          {/* Hydrazine Propellant Tanks (Charred Titanium Spheres) */}
          <mesh position={[-0.8, 0.55, 0.7]} castShadow>
            <sphereGeometry args={[0.42, 12, 12]} />
            <meshToonMaterial color="#64748B" gradientMap={gradientMap} />
          </mesh>
          <mesh position={[0.9, 0.48, -0.6]} castShadow>
            <sphereGeometry args={[0.38, 12, 12]} />
            <meshToonMaterial color="#334155" gradientMap={gradientMap} />
          </mesh>

          {/* Twisted Airframe Truss Struts */}
          <mesh position={[-0.3, 1.1, -0.2]} rotation={[0.8, 0.2, 0.5]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 2.4, 6]} />
            <meshBasicMaterial color="#94A3B8" />
          </mesh>
          <mesh position={[0.5, 0.85, 0.4]} rotation={[-0.4, 0.8, -0.6]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 2.1, 6]} />
            <meshBasicMaterial color="#64748B" />
          </mesh>

          {/* Draped 21.5m Supersonic Parachute Fabric (Orange & White Gores) */}
          <group position={[2.8, 0.12, 1.8]} rotation={[-Math.PI / 2 + 0.1, 0, 0.4]}>
            <mesh receiveShadow>
              <planeGeometry args={[3.8, 2.8, 8, 8]} />
              <meshToonMaterial color="#EA580C" side={THREE.DoubleSide} gradientMap={gradientMap} />
            </mesh>
            <mesh position={[0.6, 0.02, 0]} receiveShadow>
              <planeGeometry args={[1.6, 2.7, 4, 4]} />
              <meshToonMaterial color="#F8FAFC" side={THREE.DoubleSide} gradientMap={gradientMap} />
            </mesh>
          </group>

          {/* Nylon Technora Suspension Cords trail */}
          <mesh position={[1.4, 0.2, 0.9]} rotation={[0, 0.6, 0]}>
            <boxGeometry args={[2.2, 0.03, 0.03]} />
            <meshBasicMaterial color="#CBD5E1" />
          </mesh>
        </group>
      </LandmarkNode>
    </group>
  );
};

// ============================================================================
// 3. REUSABLE LANDMARK NODE COMPONENT
// ============================================================================

interface LandmarkNodeProps {
  landmark: LandmarkDef;
  roverPos: [number, number, number];
  isDiscovered: boolean;
  cameraMode: string;
  onDiscover: () => void;
  ringMatRef: (mat: THREE.MeshBasicMaterial | null) => void;
  actionPrompt?: React.ReactNode;
  children: React.ReactNode;
}

const LandmarkNode: React.FC<LandmarkNodeProps> = ({
  landmark,
  roverPos,
  isDiscovered,
  cameraMode,
  onDiscover,
  ringMatRef,
  actionPrompt,
  children,
}) => {
  const groundY = useMemo(
    () => getTerrainHeight(landmark.pos[0], landmark.pos[1]),
    [landmark.pos]
  );

  const surfaceNormal = useMemo(
    () => getTerrainNormal(landmark.pos[0], landmark.pos[1]),
    [landmark.pos]
  );

  // Surface normal orientation quaternion
  const orientation = useMemo(() => {
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      surfaceNormal
    );
    return new THREE.Euler().setFromQuaternion(q, 'YXZ');
  }, [surfaceNormal]);

  // Distance from rover to landmark
  const distToRover = Math.hypot(roverPos[0] - landmark.pos[0], roverPos[2] - landmark.pos[1]);
  const isInInteractRange = distToRover <= 14.0;
  const isTargetVisible = distToRover <= 42.0 && cameraMode !== 'CHEMCAM_TELESCOPE';

  return (
    <group position={[landmark.pos[0], groundY, landmark.pos[1]]}>
      {/* 1. Ground-Projected Topographic Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[4.8, 5.15, 48]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={landmark.color}
          transparent
          opacity={0.35}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[7.2, 7.35, 48]} />
        <meshBasicMaterial
          color={landmark.color}
          transparent
          opacity={0.18}
          wireframe
        />
      </mesh>

      {/* 2. Snapped & Normal-Aligned 3D Geological Mesh Geometry */}
      <group rotation={orientation}>{children}</group>

      {/* 3. Diegetic Spatial HUD Callout Pin */}
      {isTargetVisible && (
        <Html position={[0, 2.6, 0]} center occlude className="pointer-events-auto select-none">
          <div
            className={`font-mono text-[9.5px] rounded-lg p-2.5 shadow-2xl backdrop-blur-md whitespace-nowrap transition-all duration-200 border ${
              isDiscovered
                ? 'bg-[#05070B]/90 border-emerald-500/60 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : landmark.type === 'HISTORICAL_RELIC'
                ? 'bg-[#05070B]/95 border-amber-400 text-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.4)]'
                : 'bg-[#05070B]/95 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(0,240,255,0.4)]'
            }`}
          >
            {/* Header: Title & Radial Distance */}
            <div className="flex items-center justify-between gap-3 pb-1 mb-1 border-b border-white/10">
              <span className="font-extrabold flex items-center gap-1.5 text-white text-[10px]">
                {isDiscovered ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: landmark.color }} />
                )}
                {landmark.name}
              </span>
              <span className="text-[8.5px] px-1 py-0.2 rounded bg-black/60 font-bold" style={{ color: landmark.color }}>
                {distToRover.toFixed(1)}m
              </span>
            </div>

            {/* Subtitle / Classification */}
            <div className="text-[8.5px] text-slate-400 mb-1.5">
              {landmark.subname}
            </div>

            {/* Contextual Action / Discovery Button */}
            {actionPrompt ? (
              <div className="mt-1">{actionPrompt}</div>
            ) : !isDiscovered ? (
              isInInteractRange ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDiscover();
                  }}
                  className="w-full py-1 px-2 rounded font-bold text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md animate-pulse"
                  style={{
                    backgroundColor: landmark.color,
                    color: '#000000',
                  }}
                >
                  <Award className="w-3 h-3 text-black" />
                  LOG SITE (+{landmark.xpReward} XP)
                </button>
              ) : (
                <div className="text-[8.5px] text-amber-300 font-bold">
                  APPROACH WITHIN 14m TO SCAN
                </div>
              )
            ) : (
              <div className="text-[8.5px] text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                LOGGED IN CODEX // +{landmark.xpReward} XP EARNED
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

