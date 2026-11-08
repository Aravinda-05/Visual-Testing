export type EraKey = '1967_SURVEYOR' | '1976_VIKING' | '1997_SOJOURNER' | '2021_MODERN';

export interface EraConfig {
  name: string;
  codename: string;
  missionDescription: string;
  targetResolution: string;
  colorSpace: string;
  dpr: number;
  pixelGranularity: number;
  scanlineDensity: number;
  chromaticAberration: [number, number];
  vignetteDarkness: number;
  vignetteOffset: number;
  colorGrade: 'monochrome' | 'sepia-kodachrome' | '16bit-dither' | 'modern-hdr';
  bloomIntensity: number;
  noiseIntensity: number;
}

export const ERA_PRESETS: Record<EraKey, EraConfig> = {
  '1967_SURVEYOR': {
    name: 'Surveyor 3 / 7 Era',
    codename: 'SURVEYOR_TV_VIDICON',
    missionDescription: 'Slow-scan Vidicon analog TV telemetry, lunar/early interplanetary analog raster.',
    targetResolution: '200 scan lines (B&W)',
    colorSpace: 'Monochrome Phosphor P4',
    dpr: 0.35,
    pixelGranularity: 10,
    scanlineDensity: 2.2,
    chromaticAberration: [0.004, 0.004],
    vignetteDarkness: 0.85,
    vignetteOffset: 0.15,
    colorGrade: 'monochrome',
    bloomIntensity: 0.4,
    noiseIntensity: 0.28,
  },
  '1976_VIKING': {
    name: 'Viking 1 / 2 Lander Era',
    codename: 'VIKING_FACSIMILE_SCANNER',
    missionDescription: 'Rotary mirror facsimile camera with 3-color silicon photodiode filters.',
    targetResolution: '512 x 512 early digital facsimile',
    colorSpace: 'Kodachrome / Ektachrome sepia bias',
    dpr: 0.5,
    pixelGranularity: 6,
    scanlineDensity: 1.4,
    chromaticAberration: [0.003, 0.001],
    vignetteDarkness: 0.7,
    vignetteOffset: 0.25,
    colorGrade: 'sepia-kodachrome',
    bloomIntensity: 0.25,
    noiseIntensity: 0.18,
  },
  '1997_SOJOURNER': {
    name: 'Mars Pathfinder / Sojourner Era',
    codename: 'IMP_STEREO_CCD',
    missionDescription: 'Imager for Mars Pathfinder (IMP) CCD array with 16-bit compressed RGB look.',
    targetResolution: '768 x 484 quantized pixels',
    colorSpace: '16-bit High Color (5-6-5 format)',
    dpr: 0.75,
    pixelGranularity: 4,
    scanlineDensity: 0.6,
    chromaticAberration: [0.001, 0.001],
    vignetteDarkness: 0.55,
    vignetteOffset: 0.35,
    colorGrade: '16bit-dither',
    bloomIntensity: 0.15,
    noiseIntensity: 0.08,
  },
  '2021_MODERN': {
    name: 'Perseverance / Mastcam-Z Era',
    codename: 'MASTCAM_Z_MULTISPECTRAL',
    missionDescription: 'High-definition zoom multispectral stereoscopic sensor with pristine edge clarity.',
    targetResolution: '4K Native Digital Sensor',
    colorSpace: 'Full Dynamic Range Rec.709 Moebius Cel-Shading',
    dpr: 1.25,
    pixelGranularity: 0,
    scanlineDensity: 0,
    chromaticAberration: [0, 0],
    vignetteDarkness: 0.35,
    vignetteOffset: 0.5,
    colorGrade: 'modern-hdr',
    bloomIntensity: 0.05,
    noiseIntensity: 0.02,
  },
};

