/**
 * OrbitalMuseumGlobe.tsx - Tier 1: Cartographically Accurate Toon Globe
 *
 * Implements:
 * 1. Macro Tier (ORBITAL_MUSEUM): Global Martian Topography on a SphereGeometry(4.0, 64, 64).
 * 2. NASA Equirectangular Mapping:
 *    - Loads /textures/mars_albedo_2k.jpg (or .webp) and /textures/mars_mola_bump_2k.png (bumpScale: 0.05).
 *    - Includes automatic procedural offscreen <canvas> fallback generating distinct continent & basin zones:
 *      Valles Marineris, Olympus Mons, Gale Crater, Syrtis Major, and Polar Ice Caps.
 * 3. 4-step NearestFilter gradientMap via THREE.MeshToonMaterial for crisp graphic novel illustration.
 * 4. Exact Crater Pin Alignment:
 *    - Exact spherical-to-Cartesian latLonToVector3() mapping.
 *    - Curiosity (-4.5895°S, 137.4417°E) placed visibly inside the real Gale Crater basin.
 * 5. Interactive landing site beacons with hover badges and click-to-deploy down to the Surface Sandbox.
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, Outlines } from '@react-three/drei';
import { getFourStepGradientMap } from '../utils/celShading';
import { createStylizedPlanetTextures } from '../utils/stylizePlanetTexture';
import { useMissionStore } from '../store/useMissionStore';
import { soundEngine } from '../utils/soundEngine';
import { Radio, MapPin, Sparkles, Navigation, Globe, ArrowDown, ExternalLink } from 'lucide-react';

export interface GlobeMissionPin {
  id: string;
  name: string;
  mission: string;
  lat: number;   // degrees: North > 0, South < 0
  lon: number;   // degrees: East > 0, West < 0 (or 0 - 360)
  solRange: string;
  targetType: 'ACTIVE_PLAYABLE' | 'HISTORICAL_ROVER' | 'LANDER' | 'TOPOGRAPHIC_WONDER';
  description: string;
  color: string;
}

export const GLOBE_PINS: GlobeMissionPin[] = [
  {
    id: 'curiosity',
    name: 'Gale Crater // Mount Sharp',
    mission: 'Curiosity (Mars Science Laboratory)',
    lat: -4.5895,
    lon: 137.4417,
    solRange: 'Sol 0 – Present (12+ Years)',
    targetType: 'ACTIVE_PLAYABLE',
    description: 'Ancient lacustrine lakebed basin with central 5.5km layered mountain. Current active sandbox environment!',
    color: '#00F0FF',
  },
  {
    id: 'perseverance',
    name: 'Jezero Crater Delta',
    mission: 'Perseverance & Ingenuity (Mars 2020)',
    lat: 18.38,
    lon: 77.58,
    solRange: 'Sol 0 – Present',
    targetType: 'HISTORICAL_ROVER',
    description: 'Ancient river-lake delta system hunting for biosignatures and caching drill core sample tubes.',
    color: '#10B981',
  },
  {
    id: 'opportunity',
    name: 'Meridiani Planum',
    mission: 'Opportunity (MER-B)',
    lat: -1.95,
    lon: 354.47,
    solRange: 'Sol 0 – 5111 (14 Years)',
    targetType: 'HISTORICAL_ROVER',
    description: 'Hematite blueberry fields that revealed Mars was once drenched in liquid groundwater.',
    color: '#F59E0B',
  },
  {
    id: 'spirit',
    name: 'Gusev Crater // Columbia Hills',
    mission: 'Spirit (MER-A)',
    lat: -14.57,
    lon: 175.47,
    solRange: 'Sol 0 – 2210 (6 Years)',
    targetType: 'HISTORICAL_ROVER',
    description: 'Hydrothermal silica deposits discovered after a stalled front wheel churned up bright white soil.',
    color: '#EC4899',
  },
  {
    id: 'pathfinder',
    name: 'Ares Vallis',
    mission: 'Mars Pathfinder & Sojourner',
    lat: 19.33,
    lon: 326.45,
    solRange: 'July 4, 1997',
    targetType: 'HISTORICAL_ROVER',
    description: 'Catastrophic ancient flood channel and the very first mobile wheeled rover on Mars.',
    color: '#A855F7',
  },
  {
    id: 'viking1',
    name: 'Chryse Planitia',
    mission: 'Viking 1 Lander',
    lat: 22.48,
    lon: 312.05,
    solRange: 'July 20, 1976',
    targetType: 'LANDER',
    description: 'First spacecraft to successfully land on Mars and operate for over 6 years.',
    color: '#94A3B8',
  },
  {
    id: 'olympus_mons',
    name: 'Olympus Mons Caldera',
    mission: 'Shield Volcano Landmark',
    lat: 18.65,
    lon: 226.2,
    solRange: 'Topographic Feature',
    targetType: 'TOPOGRAPHIC_WONDER',
    description: 'The largest volcano in the Solar System: 21.9 km high (nearly 3x Everest) and 600 km wide.',
    color: '#F97316',
  },
  {
    id: 'valles_marineris',
    name: 'Valles Marineris',
    mission: 'Grand Canyon of Mars',
    lat: -14.0,
    lon: 301.0,
    solRange: 'Topographic Feature',
    targetType: 'TOPOGRAPHIC_WONDER',
    description: 'Vast canyon tectonic fracture spanning 4,000 km long and up to 7 km deep across Mars equator.',
    color: '#E11D48',
  },
];

/**
 * Exact Spherical-to-Cartesian coordinates conversion matching Three.js equirectangular UV mapping.
 * Latitude [-90°, 90°] (North > 0, South < 0)
 * Longitude [-180°, 180°] or [0°, 360°] (East > 0, West < 0)
 */
export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  // Three.js SphereGeometry equirectangular UV map:
  // phi: polar angle from North Pole (0 at +90°N, PI at -90°S)
  const phi = (90.0 - lat) * (Math.PI / 180.0);
  // theta: azimuth angle starting at Prime Meridian
  const theta = (lon + 180.0) * (Math.PI / 180.0);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

/**
 * Creates an in-memory procedural 2K Mars Equirectangular texture canvas as a 100% resilient fallback.
 */
function createProceduralMarsCanvas(isBump = false): HTMLCanvasElement {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  if (!isBump) {
    // Albedo Base: Warm Martian Ochre
    ctx.fillStyle = '#C1613A';
    ctx.fillRect(0, 0, width, height);

    // Dark albedo markings (Syrtis Major, Sinus Meridiani, Mare Erythraeum)
    const drawFeature = (lat: number, lon: number, radLat: number, radLon: number, color: string) => {
      const u = ((lon + 180) % 360) / 360;
      const v = (90 - lat) / 180;
      const cx = u * width;
      const cy = v * height;
      const rx = (radLon / 360) * width;
      const ry = (radLat / 180) * height;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    };

    drawFeature(10, 70, 15, 20, '#6A2E1A'); // Syrtis Major
    drawFeature(0, 0, 12, 22, '#5E2616');  // Sinus Meridiani
    drawFeature(-25, -40, 18, 30, '#582414'); // Mare Erythraeum
    drawFeature(47, -30, 20, 25, '#6E321D'); // Acidalia Planitia

    // Valles Marineris canyon
    const vmX0 = (((-80 + 180) % 360) / 360) * width;
    const vmX1 = (((-40 + 180) % 360) / 360) * width;
    const vmY = ((90 - -12) / 180) * height;
    ctx.strokeStyle = '#3E160C';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(vmX0, vmY);
    ctx.lineTo(vmX1, vmY + 10);
    ctx.stroke();

    // Olympus Mons
    drawFeature(18.6, -133.8, 12, 12, '#D87A4A');
    drawFeature(18.6, -133.8, 3.5, 3.5, '#4A1C0E'); // Caldera

    // Gale Crater
    drawFeature(-4.6, 137.4, 6, 6, '#8E4324');
    drawFeature(-4.6, 137.4, 2, 2, '#DF8B5D'); // Mount Sharp

    // Polar ice caps
    ctx.fillStyle = '#F0F9FF';
    ctx.fillRect(0, 0, width, height * 0.08);
    ctx.fillStyle = '#E8F4FB';
    ctx.fillRect(0, height * 0.92, width, height * 0.08);
  } else {
    // Bump Map: Grayscale Topography (128 neutral)
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, width, height);

    const drawBump = (lat: number, lon: number, radLat: number, radLon: number, grayHex: string) => {
      const u = ((lon + 180) % 360) / 360;
      const v = (90 - lat) / 180;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(u * width, v * height, (radLon / 360) * width, (radLat / 180) * height, 0, 0, Math.PI * 2);
      ctx.fillStyle = grayHex;
      ctx.fill();
      ctx.restore();
    };

    // Deep basins (darker)
    drawBump(-42, 70, 22, 25, '#2D2D2D'); // Hellas Basin
    drawBump(-50, -42, 14, 16, '#3D3D3D'); // Argyre Basin

    // Peaks (brighter)
    drawBump(18.6, -133.8, 14, 14, '#F5F5F5'); // Olympus Mons
    drawBump(9.0, -105.0, 10, 10, '#E0E0E0');  // Ascraeus Mons
    drawBump(0.8, -113.0, 10, 10, '#DADADA');  // Pavonis Mons
    drawBump(-9.0, -121.0, 10, 10, '#D4D4D4'); // Arsia Mons

    // Gale Crater rim & Mount Sharp
    drawBump(-4.6, 137.4, 7, 7, '#B0B0B0');
    drawBump(-4.6, 137.4, 4.5, 4.5, '#4A4A4A'); // Crater floor
    drawBump(-4.6, 137.4, 2, 2, '#EAEAEA');     // Mount Sharp peak

    // Polar plateaus
    ctx.fillStyle = '#C8C8C8';
    ctx.fillRect(0, 0, width, height * 0.08);
    ctx.fillRect(0, height * 0.92, width, height * 0.08);
  }

  return canvas;
}

export const OrbitalMuseumGlobe: React.FC = () => {
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

  const globeGroupRef = useRef<THREE.Group>(null);
  const globeMeshRef = useRef<THREE.Mesh>(null);

  const setActiveTier = useMissionStore((s) => s.setActiveTier);
  const selectedHotspotId = useMissionStore((s) => s.selectedHotspotId);

  const [activePinId, setActivePinId] = useState<string | null>('curiosity');
  const [isHovered, setIsHovered] = useState(false);

  // Initialize with procedural fallback canvas textures, then asynchronously swap
  // with the 6-band quantized, contour-inked Moebius texture from /textures/2k_mars.jpg
  const [textures, setTextures] = useState<{
    map: THREE.Texture;
    bumpMap: THREE.Texture;
  }>(() => {
    const fallbackAlbedoCanvas = createProceduralMarsCanvas(false);
    const fallbackBumpCanvas = createProceduralMarsCanvas(true);

    const fallbackAlbedoTex = new THREE.CanvasTexture(fallbackAlbedoCanvas);
    fallbackAlbedoTex.colorSpace = THREE.SRGBColorSpace;
    fallbackAlbedoTex.wrapS = THREE.RepeatWrapping;
    fallbackAlbedoTex.wrapT = THREE.ClampToEdgeWrapping;

    const fallbackBumpTex = new THREE.CanvasTexture(fallbackBumpCanvas);
    fallbackBumpTex.wrapS = THREE.RepeatWrapping;
    fallbackBumpTex.wrapT = THREE.ClampToEdgeWrapping;

    return {
      map: fallbackAlbedoTex,
      bumpMap: fallbackBumpTex,
    };
  });

  useEffect(() => {
    let isMounted = true;

    async function loadStylizedSurfaces() {
      try {
        const stylizedResult = await createStylizedPlanetTextures('/textures/2k_mars.jpg', 'MARS');

        // Attempt loading real static bump texture, falling back to pre-quantized luminance buffer
        const loader = new THREE.TextureLoader();
        loader.load(
          '/textures/mars_bump_2k.jpg',
          (loadedBump) => {
            loadedBump.wrapS = THREE.RepeatWrapping;
            loadedBump.wrapT = THREE.ClampToEdgeWrapping;
            if (isMounted) {
              setTextures({
                map: stylizedResult.map,
                bumpMap: loadedBump,
              });
            }
          },
          undefined,
          () => {
            if (isMounted) {
              setTextures({
                map: stylizedResult.map,
                bumpMap: stylizedResult.bumpMap,
              });
            }
          }
        );
      } catch (err) {
        console.warn('[OrbitalMuseumGlobe] Error generating stylized Mars texture:', err);
      }
    }

    loadStylizedSurfaces();

    return () => {
      isMounted = false;
    };
  }, []);

  // Globe Toon Material with NASA Equirectangular maps and bumpScale = 0.045
  const globeMaterial = useMemo(() => {
    const mat = new THREE.MeshToonMaterial({
      map: textures.map,
      bumpMap: textures.bumpMap,
      bumpScale: 0.045,
      gradientMap,
      color: '#FFFFFF',
    });
    return mat;
  }, [textures, gradientMap]);

  // Atmospheric Glow Material (Thin rim Fresnel shell)
  const atmosphereMaterial = useMemo(() => {
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
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
          vec3 rimColor = vec3(0.85, 0.42, 0.28); // Martian dusty salmon atmosphere
          gl_FragColor = vec4(rimColor, intensity * 0.45);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  // Slow majestic planetary rotation (pauses gently on hover to inspect pins)
  useFrame((_, delta) => {
    if (!globeGroupRef.current) return;
    if (!isHovered) {
      globeGroupRef.current.rotation.y += delta * 0.035;
    }
  });

  const GLOBE_RADIUS = 4.0;

  return (
    <group
      ref={globeGroupRef}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      {/* 1. Planetary Sphere Geometry with NASA MOLA Topography */}
      <mesh ref={globeMeshRef} material={globeMaterial} castShadow receiveShadow>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <Outlines thickness={0.025} color="#090d16" />
      </mesh>

      {/* 2. Atmospheric Rim Shell */}
      <mesh material={atmosphereMaterial}>
        <sphereGeometry args={[GLOBE_RADIUS * 1.035, 48, 48]} />
      </mesh>

      {/* 3. Orbiting Carrier Ring (Subtle Celestial Equator) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[GLOBE_RADIUS * 1.15, GLOBE_RADIUS * 1.158, 64]} />
        <meshBasicMaterial color="#00F0FF" transparent opacity={0.25} wireframe />
      </mesh>

      {/* 4. Cartographically Aligned Landing Site Pins */}
      {GLOBE_PINS.map((pin) => {
        const pinPos = latLonToVector3(pin.lat, pin.lon, GLOBE_RADIUS * 1.015);
        const normal = pinPos.clone().normalize();
        const needlePos = pinPos.clone().addScaledVector(normal, 0.22);
        const isCuriosity = pin.id === 'curiosity';
        const isSelected = activePinId === pin.id;

        return (
          <group key={pin.id} position={pinPos}>
            {/* Holographic Pulse Ring at Crater Surface */}
            <mesh
              quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)}
            >
              <ringGeometry args={[0.08, 0.14, 24]} />
              <meshBasicMaterial
                color={pin.color}
                transparent
                opacity={isCuriosity ? 0.9 : 0.6}
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
              <sphereGeometry args={[isCuriosity ? 0.06 : 0.045, 12, 12]} />
              <meshBasicMaterial color={pin.color} />
            </mesh>

            {/* 5. Spatial Diegetic Tooltip Badge */}
            <Html
              position={[normal.x * 0.38, normal.y * 0.38, normal.z * 0.38]}
              center
              distanceFactor={8}
              occlude
              className="pointer-events-auto select-none"
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePinId(pin.id);
                  soundEngine.playHotspotSelect();
                  if (isCuriosity) {
                    setActiveTier('SURFACE_SANDBOX');
                  }
                }}
                className={`font-mono cursor-pointer rounded p-2 backdrop-blur-md transition-all duration-200 border shadow-xl ${
                  isCuriosity
                    ? 'bg-[#05070B]/95 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(0,240,255,0.45)] hover:border-white'
                    : 'bg-[#05070B]/90 border-slate-700 text-slate-300 hover:border-amber-400'
                }`}
                style={{ width: isSelected ? '230px' : 'auto' }}
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
                    <div className="text-amber-300 font-bold">{pin.mission}</div>
                    <div className="text-slate-400">
                      COORD: {Math.abs(pin.lat).toFixed(2)}°{pin.lat >= 0 ? 'N' : 'S'}, {Math.abs(pin.lon).toFixed(2)}°E
                    </div>
                    <div className="text-slate-300 leading-tight">{pin.description}</div>

                    {isCuriosity && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTier('SURFACE_SANDBOX');
                          soundEngine.playUiBlip();
                        }}
                        className="w-full mt-2 py-1 px-2 rounded bg-[#00F0FF] text-black font-extrabold text-[9px] uppercase tracking-wider hover:bg-cyan-300 transition flex items-center justify-center gap-1 shadow-lg"
                      >
                        <ArrowDown className="w-3 h-3 text-black" />
                        DEPLOY TO GALE SANDBOX →
                      </button>
                    )}
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
