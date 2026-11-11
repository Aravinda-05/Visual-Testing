/**
 * useApolloMissionStore.ts - Dedicated Zustand Store for Level 1: Apollo 11 Lunar Module (Eagle)
 *
 * Manages:
 * 1. View & Transition State: ORBITAL_GLOBE -> SOUL_TRANSFER_DESCENT -> SURFACE_SANDBOX -> SOUL_TRANSFER_ASCENT.
 * 2. Remote MESA Westinghouse TV Camera and Laser Ranging Unit pan/tilt angles ([W/A/S/D]).
 * 3. 3-Site Scientific Triangulation: Footpad Bearing, West Crater Basalt, and LRRR Laser Lock.
 * 4. Historical Fault Puzzle: Electrostatic lunar dust cleaning ([F]) + Prism tray alignment ([Q/E]).
 * 5. 6 NASA Apollo LM Hardware Hotspots and Ladder Plaque bonus easter egg.
 */

import { create } from 'zustand';
import { soundEngine } from '../utils/soundEngine';

export type ApolloViewMode =
  | 'ORBITAL_GLOBE'
  | 'SOUL_TRANSFER_DESCENT'
  | 'SURFACE_SANDBOX'
  | 'SOUL_TRANSFER_ASCENT';

export type ApolloCameraMode = 'THIRD_PERSON_HERO' | 'FREE_ORBIT' | 'MESA_TV_CAM';

export type ApolloInstrument =
  | 'WESTINGHOUSE_TV'
  | 'LRRR_LASER_ARRAY'
  | 'PSEP_SEISMOMETER'
  | 'SBAND_DISH';

export interface ApolloMissionState {
  // View & Transition State
  viewMode: ApolloViewMode;
  cameraMode: ApolloCameraMode;
  selectedPinId: string | null;
  cursorCoords: { lat: number; lon: number } | null;
  descentProgress: number; // 0 to 1 during transition beam
  isBriefingOpen: boolean;

  // Stationary Lander Camera & Remote Instrument Pan/Tilt Controls
  cameraAzimuthDeg: number;   // -180° to +180°
  cameraElevationDeg: number; // -35° to +45°
  activeInstrument: ApolloInstrument;

  // Historical Fault & LRRR Puzzle State
  lrrrDustCleaned: boolean;
  lrrrTiltOffsetDeg: number;  // Manual prism tilt offset; target 0.0° (+/- 3.0°)
  lrrrPhotonReturnPct: number; // 12% initially, up to 100% when cleaned and locked
  earthLaserLocked: boolean;
  earthLaserRoundTripSec: number; // 2.56 seconds round-trip light time

  // Triangulation & Discovery State
  completedSites: Record<'SITE_1_REGOLITH' | 'SITE_2_EJECTA' | 'SITE_3_LRRR_LOCK', boolean>;
  discoveredHotspots: string[];
  selectedHotspotId: string | null;
  bonusPlaqueScanned: boolean;
  sBandAligned: boolean;
  sBandAzimuthDeg: number;
  sBandElevationDeg: number;

  // XP, Buddy Hint & Progression
  codexXp: number;
  buddyHintStep: 1 | 2;
  levelComplete: boolean;

  // Actions
  setViewMode: (mode: ApolloViewMode) => void;
  setCameraMode: (mode: ApolloCameraMode) => void;
  cycleCameraMode: () => void;
  setSelectedPinId: (id: string | null) => void;
  setCursorCoords: (coords: { lat: number; lon: number } | null) => void;
  panCamera: (dAzimuth: number, dElevation: number) => void;
  setCameraAngles: (azimuth: number, elevation: number) => void;
  setActiveInstrument: (inst: ApolloInstrument) => void;
  cleanLrrrDust: () => void;
  adjustLrrrTilt: (delta: number) => void;
  completeSite: (site: 'SITE_1_REGOLITH' | 'SITE_2_EJECTA' | 'SITE_3_LRRR_LOCK') => void;
  discoverHotspot: (id: string) => void;
  setSelectedHotspotId: (id: string | null) => void;
  scanBonusPlaque: () => void;
  alignSBandDish: (azimuth?: number, elevation?: number) => boolean;
  initiateSoulTransferDescent: () => void;
  completeLevelAndAscend: () => void;
  setBriefingOpen: (open: boolean) => void;
  resetApolloMission: () => void;
}

const INITIAL_STATE = {
  viewMode: 'SURFACE_SANDBOX' as ApolloViewMode,
  cameraMode: 'THIRD_PERSON_HERO' as ApolloCameraMode,
  selectedPinId: 'APOLLO_11',
  cursorCoords: { lat: 0.6741, lon: 23.473 },
  descentProgress: 0.0,
  isBriefingOpen: false,

  // Start aimed slightly downward toward Site 1 (Footpad)
  cameraAzimuthDeg: -35.0,
  cameraElevationDeg: -18.0,
  activeInstrument: 'WESTINGHOUSE_TV' as ApolloInstrument,

  lrrrDustCleaned: false,
  lrrrTiltOffsetDeg: -12.5,
  lrrrPhotonReturnPct: 12.0,
  earthLaserLocked: false,
  earthLaserRoundTripSec: 2.56,

  completedSites: {
    SITE_1_REGOLITH: false,
    SITE_2_EJECTA: false,
    SITE_3_LRRR_LOCK: false,
  },
  discoveredHotspots: [] as string[],
  selectedHotspotId: null as string | null,
  bonusPlaqueScanned: false,
  sBandAligned: false,
  sBandAzimuthDeg: 0.0,
  sBandElevationDeg: 42.0,

  codexXp: 0,
  buddyHintStep: 1 as 1 | 2,
  levelComplete: false,
};

export const useApolloMissionStore = create<ApolloMissionState>((set, get) => ({
  ...INITIAL_STATE,

  setViewMode: (mode) => set({ viewMode: mode }),

  setCameraMode: (mode) => {
    soundEngine.playUiBlip();
    set({ cameraMode: mode });
  },

  cycleCameraMode: () => {
    soundEngine.playUiBlip();
    const modes: ApolloCameraMode[] = ['THIRD_PERSON_HERO', 'FREE_ORBIT', 'MESA_TV_CAM'];
    const curIdx = modes.indexOf(get().cameraMode);
    const nextMode = modes[(curIdx + 1) % modes.length];
    set({ cameraMode: nextMode });
  },

  setSelectedPinId: (id) => set({ selectedPinId: id }),

  setCursorCoords: (coords) => set({ cursorCoords: coords }),

  setBriefingOpen: (open) => set({ isBriefingOpen: open }),

  panCamera: (dAzimuth, dElevation) => {
    const curAz = get().cameraAzimuthDeg;
    const curEl = get().cameraElevationDeg;

    let newAz = curAz + dAzimuth;
    // Wrap azimuth to [-180, +180]
    while (newAz < -180) newAz += 360;
    while (newAz > 180) newAz -= 360;

    // Clamp elevation between -35° (looking down at footpads) and +45° (looking up at Earth/sky)
    const newEl = Math.max(-35, Math.min(45, curEl + dElevation));

    set({ cameraAzimuthDeg: newAz, cameraElevationDeg: newEl });
  },

  setCameraAngles: (azimuth, elevation) => {
    let az = azimuth;
    while (az < -180) az += 360;
    while (az > 180) az -= 360;
    const el = Math.max(-35, Math.min(45, elevation));
    set({ cameraAzimuthDeg: az, cameraElevationDeg: el });
  },

  setActiveInstrument: (inst) => {
    soundEngine.playUiBlip();
    set({ activeInstrument: inst });
  },

  cleanLrrrDust: () => {
    const { lrrrDustCleaned, lrrrTiltOffsetDeg } = get();
    if (lrrrDustCleaned) return;

    soundEngine.playDrillFeedback();
    const aligned = Math.abs(lrrrTiltOffsetDeg) <= 3.0;
    const returnPct = aligned ? 100.0 : 68.0;

    set({
      lrrrDustCleaned: true,
      lrrrPhotonReturnPct: returnPct,
      earthLaserLocked: aligned,
      buddyHintStep: aligned ? 2 : 1,
    });

    if (aligned) {
      get().completeSite('SITE_3_LRRR_LOCK');
    }
  },

  adjustLrrrTilt: (delta) => {
    const { lrrrTiltOffsetDeg, lrrrDustCleaned } = get();
    const newTilt = Math.max(-30, Math.min(30, lrrrTiltOffsetDeg + delta));
    const aligned = Math.abs(newTilt) <= 3.0;

    let returnPct = 12.0;
    if (lrrrDustCleaned) {
      returnPct = aligned ? 100.0 : Math.max(25, 95 - Math.abs(newTilt) * 3.5);
    } else {
      returnPct = Math.max(8, 22 - Math.abs(newTilt) * 0.8);
    }

    const locked = lrrrDustCleaned && aligned;

    set({
      lrrrTiltOffsetDeg: Math.round(newTilt * 10) / 10,
      lrrrPhotonReturnPct: Math.round(returnPct),
      earthLaserLocked: locked,
    });

    if (locked && !get().completedSites.SITE_3_LRRR_LOCK) {
      get().completeSite('SITE_3_LRRR_LOCK');
    }
  },

  completeSite: (site) => {
    const cur = get().completedSites;
    if (cur[site]) return;

    soundEngine.playDiscoveryFanfare();
    const xpAwards: Record<string, number> = {
      SITE_1_REGOLITH: 150,
      SITE_2_EJECTA: 200,
      SITE_3_LRRR_LOCK: 300,
    };

    const updated = { ...cur, [site]: true };
    const allDone = updated.SITE_1_REGOLITH && updated.SITE_2_EJECTA && updated.SITE_3_LRRR_LOCK;

    set((state) => ({
      completedSites: updated,
      codexXp: state.codexXp + (xpAwards[site] || 100),
      buddyHintStep: 2,
    }));

    if (allDone) {
      soundEngine.playTargetAcquired();
    }
  },

  discoverHotspot: (id) => {
    const cur = get().discoveredHotspots;
    if (cur.includes(id)) return;

    soundEngine.playHotspotSelect();
    set((state) => ({
      discoveredHotspots: [...cur, id],
      codexXp: state.codexXp + 50,
    }));
  },

  setSelectedHotspotId: (id) => {
    if (id) {
      soundEngine.playUiBlip();
      get().discoverHotspot(id);
    }
    set({ selectedHotspotId: id });
  },

  scanBonusPlaque: () => {
    if (get().bonusPlaqueScanned) return;
    soundEngine.playDiscoveryFanfare();
    set((state) => ({
      bonusPlaqueScanned: true,
      codexXp: state.codexXp + 250,
    }));
  },

  alignSBandDish: (azimuth = 0.0, elevation = 42.0) => {
    const azAligned = Math.abs(azimuth - 0.0) <= 5.0;
    const elAligned = Math.abs(elevation - 42.0) <= 5.0;

    if (azAligned && elAligned) {
      soundEngine.playTargetAcquired();
      set({
        sBandAligned: true,
        sBandAzimuthDeg: azimuth,
        sBandElevationDeg: elevation,
      });
      return true;
    }
    return false;
  },

  initiateSoulTransferDescent: () => {
    soundEngine.playDeployBeep();
    set({
      viewMode: 'SOUL_TRANSFER_DESCENT',
      descentProgress: 0.0,
      isBriefingOpen: false,
    });
  },

  completeLevelAndAscend: () => {
    soundEngine.playAscendChime();
    set({
      levelComplete: true,
      viewMode: 'SOUL_TRANSFER_ASCENT',
    });
  },

  resetApolloMission: () => {
    set({ ...INITIAL_STATE });
  },
}));

