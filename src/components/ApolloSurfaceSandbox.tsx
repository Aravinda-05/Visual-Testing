/**
 * ApolloSurfaceSandbox.tsx - Level 1: Mare Tranquillitatis Surface Sandbox
 *
 * Implements:
 * 1. Pitch-black space sky, harsh directional sunlight (intensity 2.8), and zero atmospheric fog.
 * 2. Faceted DEM terrain with lunar silver-slate vertex coloring and 10m survey contour grid.
 * 3. Hero NASA Apollo 11 Lunar Module (Eagle) loading /models/apollo_lm.glb via useGLTF with Suspense,
 *    PBR Kapton gold foil, aluminum struts, <Outlines thickness={0.015} color="#05080F" />, and procedural fallback.
 * 4. 6 Prominent 3D & HTML Hardware Hotspots located on the ship (un-occluded, always visible).
 * 5. 3-Site Scientific Triangulation: Footpad Bearing, West Crater Basalt, and LRRR Laser Lock.
 * 6. Historical Fault: Electrostatic dust clearing ([F]) + Sun-angle prism tray leveling ([Q/E]).
 * 7. Multi-POV Camera Engine: 3rd-Person Hero Vista & Free Roam Orbit around the LM, plus MESA TV Cam ([C]).
 * 8. 1969 Westinghouse Slow-Scan TV Camera & Oscilloscope PiP HUD feed.
 * 9. 2-Step Kid-Friendly Buddy Hint Engine overlay.
 * 10. S-Band Dish Earth-Alignment ([T]) and Soul-Transfer Ascent Beam.
 */

import React, { useMemo, useRef, useState, useEffect, Suspense } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html, Outlines, Environment, Stars, Grid, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  getLunarTerrainHeight,
  LUNAR_LANDMARKS,
} from '../utils/lunarTerrainSampler';
import { useApolloMissionStore } from '../store/useApolloMissionStore';
import { soundEngine } from '../utils/soundEngine';
import { Tv, Sparkles, Camera, Compass } from 'lucide-react';

// Preload the NASA Apollo Lunar Module model
useGLTF.preload('/models/apollo_lm.glb');

// ==========================================
// 1. Faceted DEM Terrain with Vertex Colors
// ==========================================
export const LunarDemTerrain: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, material } = useMemo(() => {
    const width = 300;
    const height = 300;
    const segments = 160;

    const geom = new THREE.PlaneGeometry(width, height, segments, segments);
    geom.rotateX(-Math.PI / 2);

    const posAttr = geom.attributes.position;
    const colors: number[] = [];

    const colorDeepBasalt = new THREE.Color('#4D5562');
    const colorLowMare = new THREE.Color('#6E7785');
    const colorPlains = new THREE.Color('#9BA4B2');
    const colorEjecta = new THREE.Color('#BAC4D2');
    const colorBrightRim = new THREE.Color('#E2E8F0');

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const y = getLunarTerrainHeight(x, z);
      posAttr.setY(i, y);

      const tempColor = new THREE.Color();
      if (y < -2.5) {
        tempColor.copy(colorDeepBasalt);
      } else if (y < -0.5) {
        const t = (y - -2.5) / 2.0;
        tempColor.lerpColors(colorDeepBasalt, colorLowMare, t);
      } else if (y < 1.5) {
        const t = (y - -0.5) / 2.0;
        tempColor.lerpColors(colorLowMare, colorPlains, t);
      } else if (y < 4.0) {
        const t = (y - 1.5) / 2.5;
        tempColor.lerpColors(colorPlains, colorEjecta, t);
      } else {
        const t = Math.min(1.0, (y - 4.0) / 4.0);
        tempColor.lerpColors(colorEjecta, colorBrightRim, t);
      }

      colors.push(tempColor.r, tempColor.g, tempColor.b);
    }

    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshToonMaterial({
      vertexColors: true,
    });
    (mat as unknown as { flatShading: boolean }).flatShading = true;

    return { geometry: geom, material: mat };
  }, []);

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} material={material} receiveShadow castShadow />
      {/* 10m Translucent Survey Contour Grid */}
      <Grid
        position={[0, 0.05, 0]}
        args={[300, 300]}
        cellSize={10}
        cellThickness={0.7}
        cellColor="#00F0FF"
        sectionSize={50}
        sectionThickness={1.4}
        sectionColor="#00F0FF"
        fadeDistance={90}
        fadeStrength={1.5}
      />
    </group>
  );
};

// ==========================================
// 2. Procedural Fallback Geometry
// ==========================================
function ProceduralApolloLMFallback() {
  const terrainY = getLunarTerrainHeight(0, 0);

  return (
    <group position={[0, terrainY, 0]}>
      {/* Octagonal Descent Stage Gold Foil */}
      <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.2, 2.4, 1.6, 8]} />
        <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.25} />
        <Outlines thickness={0.015} color="#05080F" />
      </mesh>

      {/* Ascent Stage Cabin */}
      <mesh position={[0, 2.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 1.8, 2.2]} />
        <meshStandardMaterial color="#88929E" metalness={0.7} roughness={0.35} />
        <Outlines thickness={0.015} color="#05080F" />
      </mesh>

      {/* 4 Landing Legs and Footpads */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i * Math.PI) / 2 + Math.PI / 4;
        const lx = Math.cos(angle) * 3.2;
        const lz = Math.sin(angle) * 3.2;
        return (
          <group key={i} position={[0, 0, 0]}>
            <mesh position={[lx * 0.5, 0.6, lz * 0.5]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 1.8, 8]} />
              <meshStandardMaterial color="#657182" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[lx, 0.1, lz]} castShadow receiveShadow>
              <cylinderGeometry args={[0.45, 0.45, 0.1, 16]} />
              <meshStandardMaterial color="#D4AF37" metalness={0.8} roughness={0.3} />
              <Outlines thickness={0.015} color="#05080F" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ==========================================
// 3. GLTF Loader Component for apollo_lm.glb
// ==========================================
function GLTFApolloLMModel() {
  const { scene } = useGLTF('/models/apollo_lm.glb');
  const terrainY = getLunarTerrainHeight(0, 0);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  // Base of footpads in model coordinates is at Y ≈ 0.10, so offset to touch terrain
  return (
    <group position={[0, terrainY - 0.10, 0]}>
      <primitive object={clonedScene} />
      <Outlines thickness={0.015} color="#05080F" />
    </group>
  );
}

class LMErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('[ApolloLMModel] Falling back to procedural geometry:', error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export const ApolloLMModel: React.FC = () => {
  return (
    <LMErrorBoundary fallback={<ProceduralApolloLMFallback />}>
      <Suspense fallback={<ProceduralApolloLMFallback />}>
        <GLTFApolloLMModel />
      </Suspense>
    </LMErrorBoundary>
  );
};

// ==========================================
// 4. 6 Prominent 3D & HTML Hardware Hotspots
// ==========================================
export const ApolloHotspots: React.FC = () => {
  const selectedHotspotId = useApolloMissionStore((s) => s.selectedHotspotId);
  const setSelectedHotspotId = useApolloMissionStore((s) => s.setSelectedHotspotId);
  const discoveredHotspots = useApolloMissionStore((s) => s.discoveredHotspots);
  const terrainY = getLunarTerrainHeight(0, 0);

  const hotspots = useMemo(() => [
    {
      id: 'kapton_foil',
      name: 'Kapton Thermal Blanket',
      pos: [0.0, terrainY + 1.6, 1.8] as [number, number, number],
      title: 'Kapton & Mylar Radiation Foil',
      specs: '25 Layers Aluminized Mylar // +120°C to -170°C Rating',
      description: 'Crinkled gold and amber Kapton sheets isolated the ascent engine and cabin from direct solar radiation in the airless lunar vacuum.',
    },
    {
      id: 'landing_gear',
      name: 'Landing Strut & Contact Probe',
      pos: [-2.2, terrainY + 0.65, 2.2] as [number, number, number],
      title: 'Crushable Honeycomb Shock Absorber',
      specs: 'Compressible Cartridge // 1.7m Lunar Contact Probe',
      description: 'Deformable aluminum honeycomb absorbed vertical impact velocity. Blue "CONTACT LIGHT" illuminated when the 1.7m wire probe touched soil.',
    },
    {
      id: 'mesa_tv',
      name: 'MESA & Westinghouse TV Camera',
      pos: [-1.35, terrainY + 1.45, 1.6] as [number, number, number],
      title: 'Modular Equipment Stowage Assembly (MESA)',
      specs: '10 fps // 320 lines monochrome // 228MHz VHF Relay',
      description: 'Mounted inside Quad 4 of the descent stage. Neil Armstrong pulled a lanyard on the ladder porch to deploy the camera and broadcast humanity\'s first steps.',
    },
    {
      id: 'lrrr_array',
      name: 'Laser Ranging Retroreflector (LRRR)',
      pos: [4.5, getLunarTerrainHeight(4.5, 6.0) + 0.35, 6.0] as [number, number, number],
      title: '100 Fused-Silica Corner Cube Prisms',
      specs: '384,400km Baseline // 2.56s Light Return // 532nm Nd:YAG',
      description: 'Corner-cube prisms reflect green Earth laser pulses exactly back along their path of arrival, measuring the Moon\'s 3.8 cm/year orbital recession.',
    },
    {
      id: 'psep_seismic',
      name: 'Passive Seismic Experiment (PSEP)',
      pos: [-5.2, getLunarTerrainHeight(-5.2, 5.5) + 0.35, 5.5] as [number, number, number],
      title: 'First Extraterrestrial Seismometer',
      specs: 'Solar-Powered // Dual Beryllium Sensors // 21-Day Lifetime',
      description: 'Detected astronaut footfalls, venting gases, and deep moonquakes, proving that the Moon is seismically active with a fractured outer megaregolith.',
    },
    {
      id: 'sband_dish',
      name: 'S-Band Erectable Antenna',
      pos: [1.75, terrainY + 3.8, -1.1] as [number, number, number],
      title: '2.1m Collapsible Parabolic Dish',
      specs: '2287.5 MHz High-Gain // 384,400km Earth Link',
      description: 'Unfurled like an umbrella to provide high-bandwidth telemetry and color TV downlinks directly to NASA Deep Space Network stations on Earth.',
    },
  ], [terrainY]);

  return (
    <group>
      {hotspots.map((spot) => {
        const isSelected = selectedHotspotId === spot.id;
        const isDiscovered = discoveredHotspots.includes(spot.id);

        return (
          <group key={spot.id} position={spot.pos}>
            {/* 3D Pulsing Holographic Diamond Beacon */}
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                setSelectedHotspotId(isSelected ? null : spot.id);
              }}
            >
              <octahedronGeometry args={[0.18, 0]} />
              <meshBasicMaterial
                color={isSelected ? '#00F0FF' : isDiscovered ? '#10B981' : '#FFB800'}
              />
            </mesh>

            {/* Vertical Beacon Needle */}
            <mesh position={[0, -0.22, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.44, 8]} />
              <meshBasicMaterial color={isSelected ? '#00F0FF' : isDiscovered ? '#10B981' : '#FFB800'} />
            </mesh>

            {/* Pulsing ground ring */}
            <mesh position={[0, -0.44, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.14, 0.32, 16]} />
              <meshBasicMaterial
                color={isSelected ? '#00F0FF' : '#FFB800'}
                transparent
                opacity={0.7}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Floating Spatial HTML Badge - Unoccluded for crystal clarity */}
            <Html center distanceFactor={8} className="pointer-events-auto select-none">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedHotspotId(isSelected ? null : spot.id);
                }}
                className={`font-mono cursor-pointer rounded px-2.5 py-1.5 backdrop-blur-md transition-all duration-200 border shadow-2xl ${
                  isSelected
                    ? 'bg-[#05080F]/95 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(0,240,255,0.45)] w-64'
                    : 'bg-[#05080F]/90 border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? 'animate-ping' : ''}`}
                    style={{ backgroundColor: isDiscovered ? '#10B981' : '#00F0FF' }}
                  />
                  <strong className="text-[9.5px] truncate">{spot.name}</strong>
                </div>

                {isSelected && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[8.5px] space-y-1">
                    <div className="text-amber-300 font-bold">{spot.title}</div>
                    <div className="text-cyan-400 font-mono">{spot.specs}</div>
                    <div className="text-slate-300 leading-tight">{spot.description}</div>
                  </div>
                )}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

// ==========================================
// 5. 3 Triangulation Sites & Ladder Plaque
// ==========================================
export const TriangulationNodes: React.FC = () => {
  const completedSites = useApolloMissionStore((s) => s.completedSites);
  const completeSite = useApolloMissionStore((s) => s.completeSite);
  const scanBonusPlaque = useApolloMissionStore((s) => s.scanBonusPlaque);
  const bonusPlaqueScanned = useApolloMissionStore((s) => s.bonusPlaqueScanned);

  return (
    <group>
      {/* Site 1: Footpad Bearing & Bootprint Trench */}
      <group position={[-3.44, getLunarTerrainHeight(-3.44, 4.91), 4.91]}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            completeSite('SITE_1_REGOLITH');
          }}
        >
          <ringGeometry args={[0.4, 0.85, 24]} />
          <meshBasicMaterial
            color={completedSites.SITE_1_REGOLITH ? '#10B981' : '#00F0FF'}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
        <Html center distanceFactor={8} className="pointer-events-none select-none">
          <div className="bg-[#05080F]/90 border border-cyan-400 px-2 py-1 rounded text-[8.5px] font-mono text-cyan-300 whitespace-nowrap">
            SITE 1: FOOTPAD BEARING [0.7 N/cm²]
          </div>
        </Html>
      </group>

      {/* Site 2: West Crater Basalt Outcrop */}
      <group position={[34.44, getLunarTerrainHeight(34.44, 16.06), 16.06]}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            completeSite('SITE_2_EJECTA');
          }}
        >
          <ringGeometry args={[1.2, 2.0, 24]} />
          <meshBasicMaterial
            color={completedSites.SITE_2_EJECTA ? '#10B981' : '#10B981'}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
          <dodecahedronGeometry args={[1.4, 0]} />
          <meshToonMaterial
            color="#4A5260"
            onUpdate={(self) => {
              (self as unknown as { flatShading: boolean }).flatShading = true;
            }}
          />
          <Outlines thickness={0.02} color="#05080F" />
        </mesh>
        <Html center distanceFactor={14} className="pointer-events-none select-none">
          <div className="bg-[#05080F]/90 border border-emerald-400 px-2 py-1 rounded text-[8.5px] font-mono text-emerald-300 whitespace-nowrap">
            SITE 2: WEST CRATER BASALT [3.8 Ga]
          </div>
        </Html>
      </group>

      {/* Site 3 & Historical Fault: LRRR Prism Tray */}
      <group position={[4.33, getLunarTerrainHeight(4.33, 13.31), 13.31]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 1.1, 24]} />
          <meshBasicMaterial
            color={completedSites.SITE_3_LRRR_LOCK ? '#10B981' : '#FFB800'}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0.35, 0]} rotation={[0.22, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.9, 0.25, 0.9]} />
          <meshStandardMaterial color="#C5D0DE" metalness={0.95} roughness={0.1} />
          <Outlines thickness={0.015} color="#05080F" />
        </mesh>
        <Html center distanceFactor={9} className="pointer-events-none select-none">
          <div className="bg-[#05080F]/90 border border-amber-400 px-2 py-1 rounded text-[8.5px] font-mono text-amber-300 whitespace-nowrap">
            SITE 3: LRRR LASER PRISM TRAY
          </div>
        </Html>
      </group>

      {/* Bonus Relic: Ladder Plaque */}
      <group position={[0, getLunarTerrainHeight(0, 0) + 0.8, 2.1]}>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            scanBonusPlaque();
          }}
        >
          <boxGeometry args={[0.4, 0.28, 0.04]} />
          <meshStandardMaterial color="#E2E8F0" metalness={0.85} roughness={0.2} />
          <Outlines thickness={0.015} color="#05080F" />
        </mesh>
        <Html center distanceFactor={4} className="pointer-events-none select-none">
          <div className="bg-[#05080F]/90 border border-amber-500/50 px-2 py-0.5 rounded text-[7.5px] font-mono text-amber-300 whitespace-nowrap">
            {bonusPlaqueScanned ? '★ PLAQUE SCANNED (+250 XP)' : 'FRONT LADDER PLAQUE [SCAN]'}
          </div>
        </Html>
      </group>
    </group>
  );
};

// ==========================================
// 6. 1969 Westinghouse Slow-Scan TV & Laser PiP
// ==========================================
export const ApolloSensorPiP: React.FC = () => {
  const activeInstrument = useApolloMissionStore((s) => s.activeInstrument);
  const setActiveInstrument = useApolloMissionStore((s) => s.setActiveInstrument);
  const lrrrPhotonReturnPct = useApolloMissionStore((s) => s.lrrrPhotonReturnPct);
  const earthLaserLocked = useApolloMissionStore((s) => s.earthLaserLocked);
  const cameraAzimuthDeg = useApolloMissionStore((s) => s.cameraAzimuthDeg);
  const cameraElevationDeg = useApolloMissionStore((s) => s.cameraElevationDeg);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = '#060B0E';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1);
      }

      if (activeInstrument === 'LRRR_LASER_ARRAY') {
        ctx.strokeStyle = earthLaserLocked ? '#10B981' : '#00F0FF';
        ctx.lineWidth = 2.0;
        ctx.beginPath();

        const baselineY = h * 0.65;
        const pulseCenter = w * 0.5;

        for (let x = 0; x < w; x++) {
          const distToPulse = Math.abs(x - pulseCenter);
          let y = baselineY + (Math.random() - 0.5) * 4;

          if (distToPulse < 35) {
            const amplitude = (lrrrPhotonReturnPct / 100) * 85.0;
            const gaussian = Math.exp(-Math.pow(distToPulse / 10.0, 2));
            y -= amplitude * gaussian;
          }

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 184, 0, 0.45)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, baselineY - 75);
        ctx.lineTo(w, baselineY - 75);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = 'rgba(180, 200, 215, 0.15)';
        ctx.beginPath();
        ctx.arc(w * 0.45, h * 0.5, 45, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        const crosses = [
          [w * 0.25, h * 0.25],
          [w * 0.75, h * 0.25],
          [w * 0.5, h * 0.5],
          [w * 0.25, h * 0.75],
          [w * 0.75, h * 0.75],
        ];

        crosses.forEach(([cx, cy]) => {
          ctx.beginPath();
          ctx.moveTo(cx - 6, cy);
          ctx.lineTo(cx + 6, cy);
          ctx.moveTo(cx, cy - 6);
          ctx.lineTo(cx, cy + 6);
          ctx.stroke();
        });
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeInstrument, earthLaserLocked, lrrrPhotonReturnPct]);

  return (
    <div className="absolute top-4 right-4 z-40 w-[360px] bg-[#05080F]/95 border border-cyan-500/40 rounded shadow-2xl backdrop-blur-md overflow-hidden font-mono text-slate-200">
      <div className="px-3 py-1.5 bg-[#090E17] border-b border-cyan-500/30 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5 text-cyan-300">
          <Tv className="w-3.5 h-3.5" />
          <span className="font-bold tracking-wider">1969 WESTINGHOUSE TV // SENSOR PiP</span>
        </div>
        <div className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-700/50">
          LIVE VHF RELAY
        </div>
      </div>

      <div className="relative w-full h-[200px] bg-black">
        <canvas ref={canvasRef} width={360} height={200} className="w-full h-full block" />

        <div className="absolute top-2 left-2 text-[8.5px] text-cyan-300/80 space-y-0.5 pointer-events-none">
          <div>CAM AZIMUTH: {cameraAzimuthDeg.toFixed(1)}°</div>
          <div>CAM ELEVATION: {cameraElevationDeg.toFixed(1)}°</div>
          <div>RATE: 10 FPS // 320 LINES</div>
        </div>

        {activeInstrument === 'LRRR_LASER_ARRAY' && (
          <div className="absolute bottom-2 right-2 text-right text-[8.5px] font-mono pointer-events-none">
            <div className={earthLaserLocked ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
              PHOTON RETURN: {lrrrPhotonReturnPct}%
            </div>
            <div className="text-slate-400">RTT: 2.56 SECONDS</div>
          </div>
        )}
      </div>

      <div className="p-2 bg-[#080D15] border-t border-slate-800 grid grid-cols-2 gap-1.5 text-[9px]">
        <button
          onClick={() => setActiveInstrument('WESTINGHOUSE_TV')}
          className={`py-1 px-2 rounded font-bold border transition ${
            activeInstrument === 'WESTINGHOUSE_TV'
              ? 'bg-cyan-500 text-black border-cyan-400'
              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
          }`}
        >
          [1] WESTINGHOUSE TV
        </button>

        <button
          onClick={() => setActiveInstrument('LRRR_LASER_ARRAY')}
          className={`py-1 px-2 rounded font-bold border transition ${
            activeInstrument === 'LRRR_LASER_ARRAY'
              ? 'bg-amber-400 text-black border-amber-300'
              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
          }`}
        >
          [2] LRRR LASER ARRAY
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 7. 2-Step Kid-Friendly Buddy Hint Engine
// ==========================================
export const ApolloBuddyEngine: React.FC = () => {
  const completedSites = useApolloMissionStore((s) => s.completedSites);
  const lrrrDustCleaned = useApolloMissionStore((s) => s.lrrrDustCleaned);
  const lrrrTiltOffsetDeg = useApolloMissionStore((s) => s.lrrrTiltOffsetDeg);
  const earthLaserLocked = useApolloMissionStore((s) => s.earthLaserLocked);

  const allSitesDone = completedSites.SITE_1_REGOLITH && completedSites.SITE_2_EJECTA && completedSites.SITE_3_LRRR_LOCK;

  let hintText = '';
  let hintAction = '';

  if (!completedSites.SITE_1_REGOLITH) {
    hintText = 'Welcome to Tranquility Base! Aim the TV camera down at the footpad to inspect the lunar dust bearing capacity.';
    hintAction = 'Use [W/S] to tilt camera downward toward Site 1.';
  } else if (!completedSites.SITE_2_EJECTA) {
    hintText = 'Great job! Now pan right toward West Crater to scan the 3.8-billion-year-old basalt boulders.';
    hintAction = 'Use [D] to pan camera to Azimuth +65°.';
  } else if (!lrrrDustCleaned) {
    hintText = 'Static lunar dust is sticking to our mirror cubes and blocking Earth\'s green laser return beam!';
    hintAction = 'Press [F] to deploy the Thermal Dust Shade and clear the mirrors!';
  } else if (!earthLaserLocked) {
    hintText = `Prism tilt is off by ${Math.abs(lrrrTiltOffsetDeg).toFixed(1)}°! Tilt the tray toward Earth to achieve 100% laser lock.`;
    hintAction = 'Use [Q] and [E] to adjust prism tilt to 0.0°.';
  } else if (!allSitesDone) {
    hintText = 'Target locked! Completing geological calibration...';
  } else {
    hintText = 'All 3 scientific sites triangulated! S-Band Antenna is ready to beam telemetry to Earth.';
    hintAction = 'Press [T] to align S-Band Dish and initiate Soul-Transfer!';
  }

  return (
    <div className="absolute bottom-6 left-6 z-40 max-w-md bg-[#05080F]/95 border border-cyan-500/50 p-3 rounded-lg shadow-2xl backdrop-blur-md font-mono text-slate-200">
      <div className="flex items-center gap-2 mb-1.5 text-cyan-400 text-[10px] font-bold tracking-wider">
        <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
        <span>BUDDY GUIDE // MISSION COPILOT</span>
      </div>
      <p className="text-[11px] text-white leading-relaxed mb-1">{hintText}</p>
      {hintAction && (
        <div className="text-[9.5px] text-amber-300 font-extrabold tracking-wide border-t border-slate-800 pt-1 mt-1 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          {hintAction}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 8. Multi-POV Camera Director & Controller
// ==========================================
interface ApolloCameraDirectorProps {
  controlsRef: React.RefObject<OrbitControlsImpl>;
}

function ApolloCameraDirector({ controlsRef }: ApolloCameraDirectorProps) {
  const { camera } = useThree();
  const cameraMode = useApolloMissionStore((s) => s.cameraMode);
  const cameraAzimuthDeg = useApolloMissionStore((s) => s.cameraAzimuthDeg);
  const cameraElevationDeg = useApolloMissionStore((s) => s.cameraElevationDeg);
  const viewMode = useApolloMissionStore((s) => s.viewMode);
  const prevMode = useRef(cameraMode);

  const terrainY = getLunarTerrainHeight(0, 0);
  const lmCenter = useMemo(() => new THREE.Vector3(0, terrainY + 2.2, 0), [terrainY]);

  // Handle camera mode transitions
  useEffect(() => {
    if (viewMode !== 'SURFACE_SANDBOX') return;

    if (cameraMode === 'THIRD_PERSON_HERO' || cameraMode === 'FREE_ORBIT') {
      if (controlsRef.current) {
        controlsRef.current.target.copy(lmCenter);
        controlsRef.current.update();
      }
      if (prevMode.current === 'MESA_TV_CAM' || prevMode.current === undefined) {
        // Position camera in an elevated 3/4 hero vista viewing the full Lunar Module
        camera.position.set(11.0, terrainY + 5.2, 11.0);
        camera.lookAt(lmCenter);
      }
    } else if (cameraMode === 'MESA_TV_CAM') {
      // Mount camera on MESA TV porch
      const tvPos = new THREE.Vector3(-1.35, terrainY + 1.45, 1.6);
      camera.position.copy(tvPos);
    }
    prevMode.current = cameraMode;
  }, [cameraMode, viewMode, camera, controlsRef, lmCenter, terrainY]);

  useFrame(() => {
    if (viewMode !== 'SURFACE_SANDBOX') return;

    if (cameraMode === 'MESA_TV_CAM') {
      const eyePos = new THREE.Vector3(-1.35, terrainY + 1.45, 1.6);
      camera.position.copy(eyePos);

      const azRad = (cameraAzimuthDeg * Math.PI) / 180.0;
      const elRad = (cameraElevationDeg * Math.PI) / 180.0;

      const lookTarget = new THREE.Vector3(
        eyePos.x + Math.sin(azRad) * Math.cos(elRad) * 50.0,
        eyePos.y + Math.sin(elRad) * 50.0,
        eyePos.z + Math.cos(azRad) * Math.cos(elRad) * 50.0
      );
      camera.lookAt(lookTarget);
    }
  });

  return null;
}

// ==========================================
// 9. Main ApolloSurfaceSandbox Container
// ==========================================
export const ApolloSurfaceSandbox: React.FC = () => {
  const panCamera = useApolloMissionStore((s) => s.panCamera);
  const cleanLrrrDust = useApolloMissionStore((s) => s.cleanLrrrDust);
  const adjustLrrrTilt = useApolloMissionStore((s) => s.adjustLrrrTilt);
  const alignSBandDish = useApolloMissionStore((s) => s.alignSBandDish);
  const completeLevelAndAscend = useApolloMissionStore((s) => s.completeLevelAndAscend);
  const completedSites = useApolloMissionStore((s) => s.completedSites);
  const cameraMode = useApolloMissionStore((s) => s.cameraMode);

  const controlsRef = useRef<OrbitControlsImpl>(null);
  const terrainY = getLunarTerrainHeight(0, 0);

  // Global Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const key = e.code;

      // Pan & Tilt Controls for MESA TV / Laser Unit [W/A/S/D]
      if (key === 'KeyA' || key === 'ArrowLeft') panCamera(-2.5, 0);
      if (key === 'KeyD' || key === 'ArrowRight') panCamera(2.5, 0);
      if (key === 'KeyW' || key === 'ArrowUp') panCamera(0, 2.0);
      if (key === 'KeyS' || key === 'ArrowDown') panCamera(0, -2.0);

      // Historical Fault Dust Cleaning [F]
      if (key === 'KeyF') {
        cleanLrrrDust();
      }

      // LRRR Prism Tray Tilt Adjustment [Q/E]
      if (key === 'KeyQ') adjustLrrrTilt(-1.5);
      if (key === 'KeyE') adjustLrrrTilt(1.5);

      // S-Band Dish Alignment & Soul-Transfer [T]
      if (key === 'KeyT') {
        const allDone = completedSites.SITE_1_REGOLITH && completedSites.SITE_2_EJECTA && completedSites.SITE_3_LRRR_LOCK;
        if (allDone) {
          alignSBandDish(0.0, 42.0);
          completeLevelAndAscend();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panCamera, cleanLrrrDust, adjustLrrrTilt, alignSBandDish, completeLevelAndAscend, completedSites]);

  return (
    <>
      {/* 1. Pitch-black space sky with sharp star points */}
      <color attach="background" args={['#030508']} />
      <Stars radius={150} depth={50} count={3500} factor={4} saturation={0} fade />

      {/* 2. Harsh directional sunlight (intensity 2.8) */}
      <directionalLight
        position={[60, 45, 40]}
        intensity={2.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />
      <ambientLight intensity={0.14} />

      {/* 3. PBR Environment reflections for Kapton foil */}
      <Environment preset="warehouse" environmentIntensity={0.5} />

      {/* 4. OrbitControls centered on Apollo LM when in 3rd Person or Free Roam */}
      <OrbitControls
        ref={controlsRef}
        enabled={cameraMode === 'THIRD_PERSON_HERO' || cameraMode === 'FREE_ORBIT'}
        target={[0, terrainY + 2.2, 0]}
        minDistance={3.5}
        maxDistance={50.0}
        enableDamping
        dampingFactor={0.06}
      />

      {/* 5. Camera Director */}
      <ApolloCameraDirector controlsRef={controlsRef} />

      {/* 6. Faceted DEM Terrain */}
      <LunarDemTerrain />

      {/* 7. NASA Apollo Lunar Module (Eagle) */}
      <ApolloLMModel />

      {/* 8. 6 Clickable Hardware Hotspots */}
      <ApolloHotspots />

      {/* 9. 3 Triangulation Sites & Ladder Plaque */}
      <TriangulationNodes />

      {/* 10. HTML Sensor PiP and 2-Step Buddy Hint Engine */}
      <Html fullscreen className="pointer-events-none select-none">
        <ApolloSensorPiP />
        <ApolloBuddyEngine />
      </Html>
    </>
  );
};
