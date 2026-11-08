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
  Sepia,
  Bloom,
  Noise,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useControls, folder } from 'leva';
import { ERA_PRESETS, EraKey } from '../../types/era';

interface EraPostProcessingProps {
  onEraChange?: (era: EraKey) => void;
}

export const EraPostProcessing: React.FC<EraPostProcessingProps> = ({ onEraChange }) => {
  const setDpr = useThree((state) => state.setDpr);

  // Leva Controls for Era preset selection and fine-grain graphics tuning
  const [controls, set] = useControls(() => ({
    'Era Preset': {
      value: '2021_MODERN' as EraKey,
      options: [
        '1967_SURVEYOR',
        '1976_VIKING',
        '1997_SOJOURNER',
        '2021_MODERN',
      ] as EraKey[],
      onChange: (val: EraKey) => {
        if (onEraChange) onEraChange(val);
        const p = ERA_PRESETS[val];
        // Synchronize Leva sliders to preset definition
        set({
          pixelGranularity: p.pixelGranularity,
          scanlineDensity: p.scanlineDensity,
          chromaticAberrationX: p.chromaticAberration[0],
          chromaticAberrationY: p.chromaticAberration[1],
          canvasDpr: p.dpr,
          monochrome: p.colorGrade === 'monochrome',
          sepiaTint: p.colorGrade === 'sepia-kodachrome',
          vignetteDarkness: p.vignetteDarkness,
          vignetteOffset: p.vignetteOffset,
        });
      },
    },
    'Post-Processing Overrides': folder(
      {
        enablePostProcessing: { value: true, label: 'Enable Pipeline' },
        canvasDpr: {
          value: ERA_PRESETS['2021_MODERN'].dpr,
          min: 0.25,
          max: 2.0,
          step: 0.05,
          label: 'Canvas DPR',
        },
        pixelGranularity: {
          value: ERA_PRESETS['2021_MODERN'].pixelGranularity,
          min: 0,
          max: 16,
          step: 1,
          label: 'Pixel Granularity',
        },
        scanlineDensity: {
          value: ERA_PRESETS['2021_MODERN'].scanlineDensity,
          min: 0,
          max: 3.0,
          step: 0.05,
          label: 'Scanline Density',
        },
        chromaticAberrationX: {
          value: ERA_PRESETS['2021_MODERN'].chromaticAberration[0],
          min: 0,
          max: 0.015,
          step: 0.0005,
          label: 'Chroma Offset X',
        },
        chromaticAberrationY: {
          value: ERA_PRESETS['2021_MODERN'].chromaticAberration[1],
          min: 0,
          max: 0.015,
          step: 0.0005,
          label: 'Chroma Offset Y',
        },
        monochrome: {
          value: false,
          label: 'Monochrome Filter',
        },
        sepiaTint: {
          value: false,
          label: 'Sepia/Kodachrome Tint',
        },
        vignetteDarkness: {
          value: 0.35,
          min: 0.0,
          max: 1.0,
          step: 0.05,
          label: 'Vignette Darkness',
        },
        vignetteOffset: {
          value: 0.5,
          min: 0.0,
          max: 1.0,
          step: 0.05,
          label: 'Vignette Offset',
        },
        filmNoise: {
          value: true,
          label: 'Analog Film Noise',
        },
      },
      { collapsed: true }
    ),
  }));

  // Reactive hardware resolution downscale / upscale
  useEffect(() => {
    setDpr(controls.canvasDpr);
  }, [controls.canvasDpr, setDpr]);

  // Vector2 offset for chromatic aberration
  const chromaOffset = useMemo(
    () =>
      new THREE.Vector2(
        controls.chromaticAberrationX,
        controls.chromaticAberrationY
      ),
    [controls.chromaticAberrationX, controls.chromaticAberrationY]
  );

  if (!controls.enablePostProcessing) {
    return null;
  }

  const hasChroma =
    controls.chromaticAberrationX > 0 || controls.chromaticAberrationY > 0;
  const hasPixelation = controls.pixelGranularity > 0;
  const hasScanline = controls.scanlineDensity > 0.1;

  // Build strictly typed list of JSX.Element effects for EffectComposer
  const effectElements: JSX.Element[] = [];

  // 1. Pixelation pass for retro resolution emulation
  if (hasPixelation) {
    effectElements.push(
      <Pixelation key="pixel" granularity={controls.pixelGranularity} />
    );
  }

  // 2. CRT / Vidicon scanline raster effect
  if (hasScanline) {
    effectElements.push(
      <Scanline
        key="scanline"
        blendFunction={BlendFunction.OVERLAY}
        density={controls.scanlineDensity}
        opacity={controls.scanlineDensity > 1.0 ? 0.35 : 0.18}
      />
    );
  }

  // 3. Optical lens dispersion / chromatic aberration
  if (hasChroma) {
    effectElements.push(
      <ChromaticAberration
        key="chroma"
        blendFunction={BlendFunction.NORMAL}
        offset={chromaOffset}
        radialModulation={false}
        modulationOffset={0.15}
      />
    );
  }

  // 4. Optical Vignetting for analog telemetry camera enclosure
  effectElements.push(
    <Vignette
      key="vignette"
      offset={controls.vignetteOffset}
      darkness={controls.vignetteDarkness}
      blendFunction={BlendFunction.NORMAL}
    />
  );

  // 5. Era Color Toning (Monochrome for Surveyor, Sepia for Viking)
  if (controls.monochrome) {
    effectElements.push(
      <HueSaturation
        key="monochrome"
        blendFunction={BlendFunction.NORMAL}
        saturation={-1.0}
      />
    );
  } else if (controls.sepiaTint) {
    effectElements.push(
      <Sepia
        key="sepia"
        intensity={0.65}
        blendFunction={BlendFunction.NORMAL}
      />
    );
  }

  // 6. Subtle analog sensor noise
  if (controls.filmNoise && controls.pixelGranularity > 0) {
    effectElements.push(
      <Noise
        key="noise"
        opacity={controls.pixelGranularity > 6 ? 0.35 : 0.12}
        blendFunction={BlendFunction.OVERLAY}
      />
    );
  }

  // 7. HDR Bloom for Modern 2021 Cel-Shaded glow
  if (controls.pixelGranularity === 0) {
    effectElements.push(
      <Bloom
        key="bloom"
        luminanceThreshold={0.7}
        luminanceSmoothing={0.3}
        intensity={0.4}
      />
    );
  }

  return (
    <EffectComposer
      enableNormalPass={false}
      multisampling={controls.pixelGranularity > 0 ? 0 : 4}
    >
      {effectElements}
    </EffectComposer>
  );
};
