import { create } from 'zustand';

export type MissionPhase =
  | 'BRIEFING'
  | 'EXPLORING'
  | 'LASER_TARGETING'
  | 'SCIENCE_UNLOCKED'
  | 'ANTENNA_ALIGN'
  | 'SOUL_TRANSFER_COMPLETE'
  | 'ORBITAL_WINDOW_MISSED';

export type CameraMode = 'THIRD_PERSON_DRONE' | 'CHEMCAM_TELESCOPE';
export type EraShader = '1967_ANALOG' | '1997_RETRO_16BIT' | '2012_MSL_DEFAULT';

export interface SpectralPeaks {
  H: number;  // Hydrogen (656nm)
  Si: number; // Silicon (288nm)
  Fe: number; // Iron (404nm)
  Mg: number; // Magnesium (518nm)
}

export interface MissionState {
  missionPhase: MissionPhase;
  roverPos: [number, number, number];
  roverRotation: number; // yaw
  roverPitch: number;
  roverRoll: number;
  roverSpeed: number;
  mroWindowSec: number;
  mmrtgCoreTempC: number;
  mmrtgCooldown: boolean;
  cooldownTimer: number;
  wheelIntegrityPct: number;
  laserPulsesHit: number;
  capacitorCharge: number; // 0 - 100%
  spectralPeaks: SpectralPeaks;
  antennaElevation: number; // 0 - 90 deg
  antennaAzimuth: number; // 0 - 360 deg
  cameraMode: CameraMode;
  eraShaderOverride: EraShader;
  isCodexOpen: boolean;
  distanceToTarget: number;
  discoveredMinerals: boolean;
  resetCounter: number;
  lastLaserFireTime: number;

  // Actions
  startMission: () => void;
  setMissionPhase: (phase: MissionPhase) => void;
  setRoverTransform: (
    pos: [number, number, number],
    rotation: number,
    pitch: number,
    roll: number,
    speed: number,
    distToTarget: number
  ) => void;
  tickClock: (dt: number) => void;
  damageWheel: (amount: number) => void;
  fireChemCamPulse: (isTargetHit?: boolean) => { hit: boolean; unlocked: boolean; overheated: boolean; isTest?: boolean };
  setAntennaAngles: (elev: number, azim: number) => void;
  setCameraMode: (mode: CameraMode) => void;
  setEraShaderOverride: (era: EraShader) => void;
  toggleCodex: () => void;
  resetMission: () => void;
}

const INITIAL_STATE = {
  missionPhase: 'BRIEFING' as MissionPhase,
  roverPos: [0, 0, 0] as [number, number, number],
  roverRotation: 0,
  roverPitch: 0,
  roverRoll: 0,
  roverSpeed: 0,
  mroWindowSec: 180.0,
  mmrtgCoreTempC: 165.0,
  mmrtgCooldown: false,
  cooldownTimer: 0,
  wheelIntegrityPct: 100.0,
  laserPulsesHit: 0,
  capacitorCharge: 100.0,
  spectralPeaks: { H: 0, Si: 0, Fe: 0, Mg: 0 },
  antennaElevation: 15.0, // Target: 58°
  antennaAzimuth: 140.0,  // Target: 214°
  cameraMode: 'THIRD_PERSON_DRONE' as CameraMode,
  eraShaderOverride: '2012_MSL_DEFAULT' as EraShader,
  isCodexOpen: false,
  distanceToTarget: 34.0,
  discoveredMinerals: false,
  lastLaserFireTime: 0,
};

export const useMissionStore = create<MissionState>((set, get) => ({
  ...INITIAL_STATE,
  resetCounter: 0,

  startMission: () => {
    set({ missionPhase: 'EXPLORING' });
  },

  setMissionPhase: (phase: MissionPhase) => {
    set({ missionPhase: phase });
  },

  setRoverTransform: (pos, rotation, pitch, roll, speed, distToTarget) => {
    const { mmrtgCoreTempC, mmrtgCooldown } = get();
    // Driving uphill or high speed adds slight heat dissipation load
    let newTemp = mmrtgCoreTempC;
    if (!mmrtgCooldown && Math.abs(speed) > 0.5) {
      newTemp = Math.min(235, mmrtgCoreTempC + Math.abs(speed) * 0.012);
    } else {
      // Natural passive radiator cooling back toward 165°C
      newTemp = Math.max(165, mmrtgCoreTempC - 0.04);
    }

    set({
      roverPos: pos,
      roverRotation: rotation,
      roverPitch: pitch,
      roverRoll: roll,
      roverSpeed: speed,
      distanceToTarget: distToTarget,
      mmrtgCoreTempC: newTemp,
    });
  },

  tickClock: (dt: number) => {
    const state = get();
    if (state.missionPhase === 'SOUL_TRANSFER_COMPLETE') return;

    // Countdown MRO relay window
    let newWindow = Math.max(0, state.mroWindowSec - dt);
    let newPhase = state.missionPhase;
    if (newWindow <= 0) {
      newPhase = 'ORBITAL_WINDOW_MISSED';
    }

    // Handle MMRTG thermal lock cooldown
    let newCooldown = state.mmrtgCooldown;
    let newTimer = state.cooldownTimer;
    let newTemp = state.mmrtgCoreTempC;

    if (newCooldown) {
      newTimer -= dt;
      newTemp = Math.max(165, newTemp - 18 * dt);
      if (newTimer <= 0) {
        newCooldown = false;
        newTimer = 0;
      }
    } else if (newTemp >= 220) {
      // Trigger automatic 3-second thermal cooldown lock
      newCooldown = true;
      newTimer = 3.0;
    }

    // Passive capacitor recharge
    const newCap = Math.min(100, state.capacitorCharge + 12 * dt);

    set({
      mroWindowSec: newWindow,
      missionPhase: newPhase,
      mmrtgCooldown: newCooldown,
      cooldownTimer: newTimer,
      mmrtgCoreTempC: newTemp,
      capacitorCharge: newCap,
    });
  },

  damageWheel: (amount: number) => {
    const current = get().wheelIntegrityPct;
    const damaged = Math.max(15, current - amount);
    set({ wheelIntegrityPct: damaged });
  },

  fireChemCamPulse: (isTargetHit: boolean = true) => {
    const state = get();
    if (state.mmrtgCooldown) {
      return { hit: false, unlocked: false, overheated: true };
    }
    if (state.capacitorCharge < 6) {
      return { hit: false, unlocked: false, overheated: false };
    }

    const now = Date.now();

    // If firing at John Klein target rock
    if (isTargetHit) {
      const heatBurst = state.mmrtgCoreTempC + 2.8;
      const newHits = Math.min(30, state.laserPulsesHit + 1);
      const newCap = Math.max(0, state.capacitorCharge - 14);

      // Progressive emission spectra build-up
      // H (Clay moisture), Si (Silicates), Fe (Iron rust), Mg (Magnesium clays)
      const progress = newHits / 30.0;
      const newPeaks: SpectralPeaks = {
        H: Math.min(100, progress * 105 + (Math.random() * 4 - 2)),
        Si: Math.min(100, progress * 115 + (Math.random() * 4 - 2)),
        Fe: Math.min(100, progress * 95 + (Math.random() * 4 - 2)),
        Mg: Math.min(100, progress * 98 + (Math.random() * 4 - 2)),
      };

      const unlocked = newHits >= 30;

      set({
        mmrtgCoreTempC: heatBurst,
        laserPulsesHit: newHits,
        capacitorCharge: newCap,
        spectralPeaks: newPeaks,
        discoveredMinerals: unlocked,
        lastLaserFireTime: now,
        missionPhase: unlocked ? 'SCIENCE_UNLOCKED' : state.missionPhase,
      });

      return { hit: true, unlocked, overheated: heatBurst >= 220, isTest: false };
    } else {
      // Test blast into the ground or arbitrary rock
      const heatBurst = state.mmrtgCoreTempC + 1.2;
      const newCap = Math.max(0, state.capacitorCharge - 8);

      set({
        mmrtgCoreTempC: heatBurst,
        capacitorCharge: newCap,
        lastLaserFireTime: now,
      });

      return { hit: true, unlocked: false, overheated: heatBurst >= 220, isTest: true };
    }
  },

  setAntennaAngles: (elev: number, azim: number) => {
    const clampedElev = Math.max(0, Math.min(90, elev));
    const normalizedAzim = ((azim % 360) + 360) % 360;

    // Check target lock: Elevation 58°, Azimuth 214° (tolerance +/- 3°)
    const elevLocked = Math.abs(clampedElev - 58) <= 3.2;
    const azimLocked = Math.abs(normalizedAzim - 214) <= 3.5;

    const { missionPhase, discoveredMinerals } = get();
    let newPhase = missionPhase;

    if (discoveredMinerals && missionPhase === 'ANTENNA_ALIGN' && elevLocked && azimLocked) {
      newPhase = 'SOUL_TRANSFER_COMPLETE';
    }

    set({
      antennaElevation: clampedElev,
      antennaAzimuth: normalizedAzim,
      missionPhase: newPhase,
    });
  },

  setCameraMode: (mode: CameraMode) => {
    set({ cameraMode: mode });
  },

  setEraShaderOverride: (era: EraShader) => {
    set({ eraShaderOverride: era });
  },

  toggleCodex: () => {
    set((s) => ({ isCodexOpen: !s.isCodexOpen }));
  },

  resetMission: () => {
    const currentResetCounter = get().resetCounter;
    set({
      ...INITIAL_STATE,
      missionPhase: 'EXPLORING',
      resetCounter: currentResetCounter + 1,
      lastLaserFireTime: 0,
    });
  },
}));
