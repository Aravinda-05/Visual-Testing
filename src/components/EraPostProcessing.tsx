import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import {
  EffectComposer,
  Pixelation,
  Scanline,
  ChromaticAberration,
  Vignette,
  HueSaturation,
  Noise,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useMissionStore } from '../store/useMissionStore';

export const EraPostProcessing: React.FC = () => {
  const setDpr = useThree((state) => state.setDpr);
  const era = useMissionStore((s) => s.eraShaderOverride);

  // Era Base Configuration
  const eraConfig = useMemo(() => {
    switch (era) {
      case '1967_ANALOG':
        return {
          dpr: Math.max(0.65, window.devicePixelRatio * 0.65),
          pixelGranularity: 3,
          scanlineDensity: 1.2,
          chromaOffset: [0.0018, 0.0018] as [number, number],
          monochrome: true,
          noiseOpacity: 0.18,
          vignetteDarkness: 0.65,
        };
      case '1997_RETRO_16BIT':
        return {
          dpr: Math.max(0.85, window.devicePixelRatio * 0.85),
          pixelGranularity: 2,
          scanlineDensity: 0.45,
          chromaOffset: [0.001, 0.0008] as [number, number],
          monochrome: false,
          noiseOpacity: 0.06,
          vignetteDarkness: 0.45,
        };
      case '2012_MSL_DEFAULT':
      default:
        // Razor-sharp HD Cel-Shaded color without blur, scanlines, or chromatic distortion
        return {
          dpr: Math.min(window.devicePixelRatio, 2.0),
          pixelGranularity: 0,
          scanlineDensity: 0,
          chromaOffset: [0, 0] as [number, number],
          monochrome: false,
          noiseOpacity: 0,
          vignetteDarkness: 0.28,
        };
    }
  }, [era]);

  // Apply crisp resolution scaling
  useEffect(() => {
    setDpr(eraConfig.dpr);
  }, [eraConfig.dpr, setDpr]);

  const chromaVec = useMemo(() => {
    return new THREE.Vector2(eraConfig.chromaOffset[0], eraConfig.chromaOffset[1]);
  }, [eraConfig.chromaOffset]);

  const hasPixelation = eraConfig.pixelGranularity > 0;
  const hasScanline = eraConfig.scanlineDensity > 0.1;
  const hasChroma = eraConfig.chromaOffset[0] > 0 || eraConfig.chromaOffset[1] > 0;

  const effectElements: JSX.Element[] = [];

  // 1. Pixelation Pass (Only in retro 1967/1997 modes)
  if (hasPixelation) {
    effectElements.push(
      <Pixelation key="pixel" granularity={eraConfig.pixelGranularity} />
    );
  }

  // 2. Scanline Pass (Only in retro 1967/1997 modes)
  if (hasScanline) {
    effectElements.push(
      <Scanline
        key="scanline"
        blendFunction={BlendFunction.OVERLAY}
        density={eraConfig.scanlineDensity}
        opacity={0.15}
      />
    );
  }

  // 3. Chromatic Aberration Pass (Only in retro 1967/1997 modes)
  if (hasChroma) {
    effectElements.push(
      <ChromaticAberration
        key="chroma"
        blendFunction={BlendFunction.NORMAL}
        offset={chromaVec}
        radialModulation={false}
        modulationOffset={0.15}
      />
    );
  }

  // 4. Optical Vignette (Subtle cinematic edge framing)
  effectElements.push(
    <Vignette
      key="vignette"
      offset={0.45}
      darkness={eraConfig.vignetteDarkness}
      blendFunction={BlendFunction.NORMAL}
    />
  );

  // 5. 1967 Surveyor Monochrome Filter (Only in 1967 mode)
  if (eraConfig.monochrome) {
    effectElements.push(
      <HueSaturation
        key="monochrome"
        blendFunction={BlendFunction.NORMAL}
        saturation={-1.0}
      />
    );
  }

  // 6. Analog Static Noise (Only in retro modes)
  if (eraConfig.noiseOpacity > 0.01) {
    effectElements.push(
      <Noise
        key="noise"
        opacity={eraConfig.noiseOpacity}
        blendFunction={BlendFunction.OVERLAY}
      />
    );
  }

  return (
    <EffectComposer
      enableNormalPass={false}
      multisampling={hasPixelation ? 0 : 4}
    >
      {effectElements}
    </EffectComposer>
  );
};
