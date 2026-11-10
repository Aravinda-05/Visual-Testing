import React, { useRef } from 'react';
import * as THREE from 'three';
import { EraKey } from '../../types/era';

interface LightingAndAtmosphereProps {
  eraKey: EraKey;
  sunIntensity?: number;
}

export const LightingAndAtmosphere: React.FC<LightingAndAtmosphereProps> = ({
  eraKey,
  sunIntensity = 2.4,
}) => {
  const dirLightRef = useRef<THREE.DirectionalLight>(null);

  // Era-specific atmospheric fog and sky tint
  const getAtmosphereConfig = () => {
    switch (eraKey) {
      case '1967_SURVEYOR':
        return {
          fogColor: '#121212',
          fogNear: 35,
          fogFar: 140,
          sunColor: '#FFFFFF',
          ambientColor: '#282828',
          ambientIntensity: 0.8,
        };
      case '1976_VIKING':
        return {
          fogColor: '#8C482A',
          fogNear: 30,
          fogFar: 150,
          sunColor: '#FFD79E',
          ambientColor: '#4A2111',
          ambientIntensity: 0.9,
        };
      case '1997_SOJOURNER':
        return {
          fogColor: '#B45309',
          fogNear: 35,
          fogFar: 160,
          sunColor: '#FEF3C7',
          ambientColor: '#78350F',
          ambientIntensity: 1.0,
        };
      case '2021_MODERN':
      default:
        return {
          fogColor: '#B44922',
          fogNear: 40,
          fogFar: 180,
          sunColor: '#FFF8EB',
          ambientColor: '#6B2C16',
          ambientIntensity: 1.1,
        };
    }
  };

  const config = getAtmosphereConfig();

  return (
    <>
      {/* Dynamic atmospheric distance fog */}
      <fog attach="fog" args={[config.fogColor, config.fogNear, config.fogFar]} />
      <color attach="background" args={[config.fogColor]} />

      {/* Ambient fill for soft shadow detail */}
      <ambientLight color={config.ambientColor} intensity={config.ambientIntensity} />

      {/* Primary directional sun creating hard Moebius shadow terminator lines */}
      <directionalLight
        ref={dirLightRef}
        color={config.sunColor}
        intensity={sunIntensity}
        position={[25, 32, 22]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={120}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0004}
      />

      {/* Secondary rim light for comic-book outline pop */}
      <directionalLight
        position={[-22, 12, -25]}
        intensity={0.65}
        color="#7DD3FC"
      />
    </>
  );
};

