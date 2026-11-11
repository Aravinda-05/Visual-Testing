/**
 * LunarOrbitalGlobe.tsx - Interactive 3D Lunar Orbital Museum Globe
 *
 * Implements:
 * 1. 3D Lunar Globe on SphereGeometry(4.0, 64, 64) with stylized 6-Band Moebius cel-shading.
 * 2. 4-step NearestFilter gradientMap ([65, 130, 195, 255]) + Outlines(thickness 0.025, #05080F).
 * 3. Exact spherical-to-Cartesian pin mapping matching Three.js UV wrapping via geoMath.ts.
 * 4. Live pointer raycast tracking displaying ORBITAL CURSOR TELEMETRY: LAT / LON in real time.
 * 5. Interactive landing site beacons (Apollo 11, Surveyor 3, Apollo 17).
 * 6. Smooth camera slerp and Mission Briefing Drawer with [INITIATE SOUL-TRANSFER // DESCEND].
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Outlines } from '@react-three/drei';
import { latLonToVector3, vector3ToLatLon, formatLatLon } from '../utils/geoMath';
import { createStylizedPlanetTextures } from '../utils/stylizePlanetTexture';
import { useApolloMissionStore } from '../store/useApolloMissionStore';
import { soundEngine } from '../utils/soundEngine';
import { Radio, ArrowDown, MapPin, Sparkles, Navigation, Globe, Shield, Terminal } from 'lucide-react';

export interface LunarMissionPin {
  id: string;
  name: string;
  mission: string;
  lat: number;
  lon: number;
  dateStr: string;
  isPlayable: boolean;
  description: string;
  color: string;
}

export const LUNAR_PINS: LunarMissionPin[] = [
  {
    id: 'APOLLO_11',
    name: 'Tranquility Base // Mare Tranquillitatis',
    mission: 'Apollo 11 (Eagle Descent Stage)',
    lat: 0.6741,
    lon: 23.473,
    dateStr: 'July 20, 1969',
    isPlayable: true,
    description: "Humanity's first crewed lunar touchdown. Eagle Descent Stage, EASEP seismic package, and Laser Ranging Retroreflector.",
    color: '#00F0FF',
  },
  {
    id: 'SURVEYOR_3',
    name: 'Oceanus Procellarum',
    mission: 'Surveyor 3 (Robotic Lander)',
    lat: -3.016,
    lon: -23.418,
    dateStr: 'April 20, 1967',
    isPlayable: false,
    description: 'Robotic soft-landing in a 200m crater. Later visited and examined by Apollo 12 astronauts Conrad and Bean.',
    color: '#FFB800',
  },
  {
    id: 'APOLLO_17',
    name: 'Taurus-Littrow Valley',
    mission: 'Apollo 17 (Challenger & LRV)',
    lat: 20.1908,
    lon: 30.7717,
    dateStr: 'December 11, 1972',
    isPlayable: false,
    description: 'Final Apollo landing site in a deep geological graben valley, where astronauts discovered orange volcanic glass beads.',
    color: '#FFB800',
  },
];

export const LunarOrbitalGlobe: React.FC = () => {
  const { camera } = useThree();
  const globeGroupRef = useRef<THREE.Group>(null);
  const globeMeshRef = useRef<THREE.Mesh>(null);

  const selectedPinId = useApolloMissionStore((s) => s.selectedPinId);
  const setSelectedPinId = useApolloMissionStore((s) => s.setSelectedPinId);
  const setCursorCoords = useApolloMissionStore((s) => s.setCursorCoords);
  const cursorCoords = useApolloMissionStore((s) => s.cursorCoords);
  const isBriefingOpen = useApolloMissionStore((s) => s.isBriefingOpen);
  const setBriefingOpen = useApolloMissionStore((s) => s.setBriefingOpen);
  const initiateSoulTransferDescent = useApolloMissionStore((s) => s.initiateSoulTransferDescent);

  const [isHovered, setIsHovered] = useState(false);
  const [targetCamPos, setTargetCamPos] = useState<THREE.Vector3 | null>(null);

  // 4-Step NearestFilter DataTexture for comic graphic novel lighting steps [65, 130, 195, 255]
  const gradientMap = useMemo(() => {
    const steps = new Uint8Array([65, 130, 195, 255]);
    const texture = new THREE.DataTexture(steps, 4, 1, THREE.RedFormat);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }, []);

  // Async texture pipeline for stylized Moebius Moon
  const [textures, setTextures] = useState<{
    map: THREE.Texture;
    bumpMap: THREE.Texture;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMoonTextures() {
      try {
        const result = await createStylizedPlanetTextures('/textures/moon_2k.jpg', 'MOON');
        if (isMounted) {
          setTextures({
            map: result.map,
            bumpMap: result.bumpMap,
          });
        }
      } catch (err) {
        console.warn('[LunarOrbitalGlobe] Texture loading error:', err);
      }
    }

    loadMoonTextures();

    return () => {
      isMounted = false;
    };
  }, []);

  // MeshToonMaterial with bumpScale = 0.045
  const globeMaterial = useMemo(() => {
    return new THREE.MeshToonMaterial({
      map: textures ? textures.map : null,
      bumpMap: textures ? textures.bumpMap : null,
      bumpScale: 0.045,
      gradientMap,
      color: '#E0E6EE',
    });
  }, [textures, gradientMap]);

  // Subtle lunar exosphere glow
  const exosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.2);
          vec3 rimColor = vec3(0.72, 0.82, 0.94); // Cool silvery lunar glow
          gl_FragColor = vec4(rimColor, intensity * 0.38);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  const GLOBE_RADIUS = 4.0;

  // Slow planetary rotation (pauses on hover to inspect pins)
  useFrame((_, delta) => {
    if (!globeGroupRef.current) return;

    if (!isHovered && !targetCamPos) {
      globeGroupRef.current.rotation.y += delta * 0.035;
    }

    // Camera slerp to focus selected pin
    if (targetCamPos) {
      camera.position.lerp(targetCamPos, delta * 3.5);
      camera.lookAt(0, 0, 0);
      if (camera.position.distanceTo(targetCamPos) < 0.08) {
        setTargetCamPos(null);
      }
    }
  });

  // Handle pointer raycasting to update live latitude / longitude readout
  const handlePointerMove = (e: any) => {
    if (!globeGroupRef.current) return;
    e.stopPropagation();

    // Convert intersection point into local space of rotating globe
    const localPoint = e.point.clone();
    globeGroupRef.current.worldToLocal(localPoint);

    const coords = vector3ToLatLon(localPoint, GLOBE_RADIUS);
    setCursorCoords(coords);
  };

  // Focus and select pin
  const handleSelectPin = (pin: LunarMissionPin, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPinId(pin.id);
    soundEngine.playHotspotSelect();

    if (pin.isPlayable) {
      setBriefingOpen(true);
      // Position camera facing pin in world space
      const pinVec = latLonToVector3(pin.lat, pin.lon, GLOBE_RADIUS * 2.2);
      setTargetCamPos(pinVec);
    }
  };

  const activePin = LUNAR_PINS.find((p) => p.id === selectedPinId) || LUNAR_PINS[0];

  return (
    <group
      ref={globeGroupRef}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => {
        setIsHovered(false);
      }}
    >
      {/* 1. Lunar Sphere Geometry with Stylized 6-Band Toon Shading */}
      <mesh
        ref={globeMeshRef}
        material={globeMaterial}
        onPointerMove={handlePointerMove}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <Outlines thickness={0.025} color="#05080F" />
      </mesh>

      {/* 2. Silver Exosphere Rim Glow */}
      <mesh material={exosphereMaterial}>
        <sphereGeometry args={[GLOBE_RADIUS * 1.025, 48, 48]} />
      </mesh>

      {/* 3. Celestial Equator Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[GLOBE_RADIUS * 1.15, GLOBE_RADIUS * 1.158, 64]} />
        <meshBasicMaterial color="#00F0FF" transparent opacity={0.22} wireframe />
      </mesh>

      {/* 4. Cartographically Aligned Lunar Pins */}
      {LUNAR_PINS.map((pin) => {
        const pinPos = latLonToVector3(pin.lat, pin.lon, GLOBE_RADIUS * 1.015);
        const normal = pinPos.clone().normalize();
        const isApollo11 = pin.id === 'APOLLO_11';
        const isSelected = selectedPinId === pin.id;

        return (
          <group key={pin.id} position={pinPos}>
            {/* Holographic Pulse Ring at Landing Site */}
            <mesh
              quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)}
            >
              <ringGeometry args={[0.07, 0.13, 24]} />
              <meshBasicMaterial
                color={pin.color}
                transparent
                opacity={isApollo11 ? 0.95 : 0.65}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Vertical Beacon Needle */}
            <mesh
              position={[normal.x * 0.12, normal.y * 0.12, normal.z * 0.12]}
              quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)}
            >
              <cylinderGeometry args={[0.015, 0.015, 0.24, 8]} />
              <meshBasicMaterial color={pin.color} />
            </mesh>

            {/* Glowing Beacon Head */}
            <mesh position={[normal.x * 0.24, normal.y * 0.24, normal.z * 0.24]}>
              <sphereGeometry args={[isApollo11 ? 0.065 : 0.045, 12, 12]} />
              <meshBasicMaterial color={pin.color} />
            </mesh>

            {/* Spatial Pin Label */}
            <Html
              position={[normal.x * 0.38, normal.y * 0.38, normal.z * 0.38]}
              center
              distanceFactor={8}
              occlude
              className="pointer-events-auto select-none"
            >
              <div
                onClick={(e) => handleSelectPin(pin, e)}
                className={`font-mono cursor-pointer rounded p-2 backdrop-blur-md transition-all duration-200 border shadow-xl ${
                  isApollo11
                    ? 'bg-[#05070B]/95 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(0,240,255,0.45)] hover:border-white'
                    : 'bg-[#05070B]/90 border-slate-700 text-slate-300 hover:border-amber-400'
                }`}
                style={{ width: isSelected ? '240px' : 'auto' }}
              >
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    className="w-2 h-2 rounded-full animate-ping flex-shrink-0"
                    style={{ backgroundColor: pin.color }}
                  />
                  <strong className="text-[10px] text-white tracking-wide truncate">
                    {pin.name}
                  </strong>
                </div>

                {isSelected && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[8.5px] space-y-1">
                    <div className="text-cyan-300 font-bold">{pin.mission}</div>
                    <div className="text-slate-400">
                      COORD: {formatLatLon(pin.lat, pin.lon)}
                    </div>
                    <div className="text-slate-300 leading-tight">{pin.description}</div>

                    {isApollo11 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          initiateSoulTransferDescent();
                        }}
                        className="w-full mt-2 py-1 px-2 rounded bg-[#00F0FF] text-black font-extrabold text-[9px] uppercase tracking-wider hover:bg-cyan-300 transition flex items-center justify-center gap-1 shadow-lg"
                      >
                        <ArrowDown className="w-3 h-3 text-black" />
                        INITIATE SOUL-TRANSFER // DESCEND →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Html>
          </group>
        );
      })}

      {/* 5. Live Orbital Cursor Lat/Lon HUD Overlay */}
      {cursorCoords && (
        <Html position={[0, -GLOBE_RADIUS * 1.25, 0]} center className="pointer-events-none select-none">
          <div className="bg-[#05080F]/90 border border-cyan-500/40 px-3 py-1.5 rounded text-[9px] text-cyan-300 font-mono tracking-widest backdrop-blur-md shadow-lg flex items-center gap-2">
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span>ORBITAL CURSOR TELEMETRY:</span>
            <span className="text-white font-bold">{formatLatLon(cursorCoords.lat, cursorCoords.lon)}</span>
          </div>
        </Html>
      )}
    </group>
  );
};

