import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { getTerrainHeight, JOHN_KLEIN_POS, ROCK_HAZARDS } from '../utils/terrainMath';
import { getFourStepGradientMap } from '../utils/celShading';
import { useMissionStore } from '../store/useMissionStore';

export const GaleCraterTerrain: React.FC = () => {
  const gradientMap = useMemo(() => getFourStepGradientMap(), []);
  const distanceToTarget = useMissionStore((s) => s.distanceToTarget);
  const missionPhase = useMissionStore((s) => s.missionPhase);
  const setCameraMode = useMissionStore((s) => s.setCameraMode);
  const setMissionPhase = useMissionStore((s) => s.setMissionPhase);

  // Load NASA Mars Trek photorealistic hypsometric color map and normal relief map
  const { colorMap, normalMap } = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const color = loader.load('/terrains/gale_crater_texture.png');
    color.wrapS = THREE.ClampToEdgeWrapping;
    color.wrapT = THREE.ClampToEdgeWrapping;
    color.colorSpace = THREE.SRGBColorSpace;

    const normal = loader.load('/terrains/gale_crater_normal.png');
    normal.wrapS = THREE.ClampToEdgeWrapping;
    normal.wrapT = THREE.ClampToEdgeWrapping;

    return { colorMap: color, normalMap: normal };
  }, []);

  // 1. NASA Mars Trek DEM 200x200 Plane Geometry (96x96 resolution, optimized for 60fps)
  const terrainGeometry = useMemo(() => {
    const baseGeo = new THREE.PlaneGeometry(200, 200, 96, 96);
    const posAttr = baseGeo.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      const worldX = vertex.x;
      const worldZ = -vertex.y;
      const elevation = getTerrainHeight(worldX, worldZ);
      posAttr.setZ(i, elevation);
    }

    posAttr.needsUpdate = true;
    const nonIndexed = baseGeo.toNonIndexed();
    nonIndexed.computeVertexNormals();
    baseGeo.dispose();
    return nonIndexed;
  }, []);

  // Terrain Toon Material with NASA Mars Trek DEM texture & normal map
  const terrainMaterial = useMemo(() => {
    const mat = new THREE.MeshToonMaterial({
      map: colorMap,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(1.4, 1.4),
      color: '#FFFFFF', // Tint white so the rich Martian texture shines through fully
      gradientMap,
    });
    (mat as unknown as { flatShading: boolean }).flatShading = true;
    mat.defines = { ...mat.defines, FLAT_SHADED: '' };
    mat.needsUpdate = true;
    return mat;
  }, [colorMap, normalMap, gradientMap]);

  // Dark basalt rock material for ventifact hazards
  const rockMaterial = useMemo(() => {
    const mat = new THREE.MeshToonMaterial({
      color: '#2A1F1D',
      gradientMap,
    });
    (mat as unknown as { flatShading: boolean }).flatShading = true;
    mat.defines = { ...mat.defines, FLAT_SHADED: '' };
    mat.needsUpdate = true;
    return mat;
  }, [gradientMap]);

  // John Klein Mudstone Outcrop elevation
  const johnKleinY = useMemo(
    () => getTerrainHeight(JOHN_KLEIN_POS[0], JOHN_KLEIN_POS[1]),
    []
  );

  const isInLaserRange = distanceToTarget <= 7.0;

  return (
    <group>
      {/* 1. Main Faceted Gale Crater Planetary Surface */}
      <mesh
        geometry={terrainGeometry}
        material={terrainMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      />

      {/* 2. 12 Basaltic Ventifact Rock Hazards */}
      {ROCK_HAZARDS.map((hazard, idx) => {
        const rockY = getTerrainHeight(hazard.x, hazard.z);
        return (
          <group
            key={idx}
            position={[hazard.x, rockY + 0.35, hazard.z]}
            scale={[hazard.scale, hazard.scale * 1.3, hazard.scale]}
          >
            <mesh castShadow receiveShadow material={rockMaterial}>
              <dodecahedronGeometry args={[0.7, 0]} />
            </mesh>
          </group>
        );
      })}

      {/* 3. "John Klein" Mudstone Outcrop Discovery Site */}
      <group position={[JOHN_KLEIN_POS[0], johnKleinY, JOHN_KLEIN_POS[1]]}>
        {/* Layered Mudstone Slab Formation */}
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.8, 0.7, 2.9]} />
          <meshToonMaterial
            color="#8B5A3C"
            gradientMap={gradientMap}
          />
        </mesh>
        <mesh position={[0.4, 0.9, -0.2]} castShadow receiveShadow>
          <boxGeometry args={[2.5, 0.45, 2.0]} />
          <meshToonMaterial
            color="#A06948"
            gradientMap={gradientMap}
          />
        </mesh>
        {/* Sulfate Mineral Veins (White Calcium Sulfate seams indicative of past water) */}
        <mesh position={[0.2, 0.95, -0.1]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[2.2, 0.08, 0.15]} />
          <meshBasicMaterial color="#E2E8F0" />
        </mesh>

        {/* Pulsing Cyan Wireframe Target Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
          <ringGeometry args={[6.8, 7.0, 32]} />
          <meshBasicMaterial
            color="#00F0FF"
            wireframe
            transparent
            opacity={0.7}
          />
        </mesh>

        {/* Spatial Discovery Beacon Callout */}
        <Html
          position={[0, 2.2, 0]}
          center
          distanceFactor={12}
          className="pointer-events-auto select-none"
        >
          <div className="font-mono text-[10px] bg-[#05070B]/95 border border-[#00F0FF] p-2 rounded text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.4)] backdrop-blur-md whitespace-nowrap text-center">
            <div className="font-bold text-white text-[11px] mb-0.5 flex items-center justify-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-ping" />
              <span>PRIMARY TARGET: JOHN KLEIN</span>
            </div>
            <div className="text-[9px] text-slate-400 mb-1">
              Yellowknife Bay Mudstone Formation
            </div>
            <div className="text-[10px] text-amber-300 font-bold mb-1.5">
              DISTANCE: {distanceToTarget.toFixed(1)} m {isInLaserRange ? '(IN RANGE)' : '(DRIVE CLOSER)'}
            </div>

            {/* Prompt to engage ChemCam telescope when in range */}
            {isInLaserRange && missionPhase === 'EXPLORING' && (
              <button
                onClick={() => {
                  setCameraMode('CHEMCAM_TELESCOPE');
                  setMissionPhase('LASER_TARGETING');
                }}
                className="w-full py-1 px-2 rounded bg-cyan-950 border border-cyan-400 text-white font-bold text-[10px] hover:bg-cyan-800 transition animate-pulse"
              >
                CLICK TO ENGAGE CHEMCAM TELESCOPE
              </button>
            )}
          </div>
        </Html>
      </group>
    </group>
  );
};

