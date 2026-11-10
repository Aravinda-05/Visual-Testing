import React, { useRef, useEffect } from 'react';
import { useMissionStore } from '../store/useMissionStore';
import { soundEngine } from '../utils/soundEngine';
import { OpticalSensorPiP } from './OpticalSensorPiP';
import { HotspotInspectionCard } from './RoverHotspots';
import { CURIOSITY_HOTSPOTS } from '../data/curiosityHotspots';
import {
  Radio,
  Clock,
  Gauge,
  Zap,
  Target,
  Camera,
  Layers,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Signal,
  X,
  Cpu,
} from 'lucide-react';

export const MissionHUD: React.FC = () => {
  const missionPhase = useMissionStore((s) => s.missionPhase);
  const mroWindowSec = useMissionStore((s) => s.mroWindowSec);
  const mmrtgCoreTempC = useMissionStore((s) => s.mmrtgCoreTempC);
  const mmrtgCooldown = useMissionStore((s) => s.mmrtgCooldown);
  const cooldownTimer = useMissionStore((s) => s.cooldownTimer);
  const wheelIntegrityPct = useMissionStore((s) => s.wheelIntegrityPct);
  const laserPulsesHit = useMissionStore((s) => s.laserPulsesHit);
  const capacitorCharge = useMissionStore((s) => s.capacitorCharge);
  const spectralPeaks = useMissionStore((s) => s.spectralPeaks);
  const antennaElevation = useMissionStore((s) => s.antennaElevation);
  const antennaAzimuth = useMissionStore((s) => s.antennaAzimuth);
  const cameraMode = useMissionStore((s) => s.cameraMode);
  const eraShader = useMissionStore((s) => s.eraShaderOverride);
  const isCodexOpen = useMissionStore((s) => s.isCodexOpen);
  const distanceToTarget = useMissionStore((s) => s.distanceToTarget);
  const roverSpeed = useMissionStore((s) => s.roverSpeed);
  const discoveredHotspots = useMissionStore((s) => s.discoveredHotspots);
  const setSelectedHotspotId = useMissionStore((s) => s.setSelectedHotspotId);

  const startMission = useMissionStore((s) => s.startMission);
  const setCameraMode = useMissionStore((s) => s.setCameraMode);
  const cycleCameraMode = useMissionStore((s) => s.cycleCameraMode);
  const setEraShaderOverride = useMissionStore((s) => s.setEraShaderOverride);
  const setAntennaAngles = useMissionStore((s) => s.setAntennaAngles);
  const toggleCodex = useMissionStore((s) => s.toggleCodex);
  const resetMission = useMissionStore((s) => s.resetMission);
  const setMissionPhase = useMissionStore((s) => s.setMissionPhase);
  const fireChemCamPulse = useMissionStore((s) => s.fireChemCamPulse);

  // Oscilloscope canvas reference
  const oscCanvasRef = useRef<HTMLCanvasElement>(null);
  const oscHistoryRef = useRef<{ temp: number; cap: number; wheel: number }[]>([]);

  // Format MRO relay countdown MM:SS
  const mins = Math.floor(mroWindowSec / 60);
  const secs = Math.floor(mroWindowSec % 60);
  const mroFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  // Antenna target alignment checks: Elevation 58°, Azimuth 214° (+/- 3°)
  const elevLocked = Math.abs(antennaElevation - 58) <= 3.2;
  const azimLocked = Math.abs(antennaAzimuth - 214) <= 3.5;
  const antennaLocked = elevLocked && azimLocked;

  // Render HTML5 Oscilloscope at 30Hz
  useEffect(() => {
    let animId: number;
    const canvas = oscCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderOsc = () => {
      // Record current metrics
      oscHistoryRef.current.push({
        temp: mmrtgCoreTempC,
        cap: capacitorCharge,
        wheel: wheelIntegrityPct,
      });
      if (oscHistoryRef.current.length > 70) {
        oscHistoryRef.current.shift();
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Grid background
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      const history = oscHistoryRef.current;
      const stepX = canvas.width / 70;

      // Draw MMRTG Core Temp line (Amber/Red, scale 150°C - 240°C)
      ctx.beginPath();
      ctx.strokeStyle = mmrtgCoreTempC > 210 ? '#EF4444' : '#F59E0B';
      ctx.lineWidth = 1.5;
      history.forEach((pt, i) => {
        const norm = (pt.temp - 150) / 90; // 0 to 1
        const y = canvas.height - norm * (canvas.height - 4);
        const x = i * stepX;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Draw Wheel Integrity line (Emerald/Cyan, scale 0 - 100%)
      ctx.beginPath();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.2;
      history.forEach((pt, i) => {
        const norm = pt.wheel / 100;
        const y = canvas.height - norm * (canvas.height - 4);
        const x = i * stepX;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      animId = requestAnimationFrame(renderOsc);
    };

    animId = requestAnimationFrame(renderOsc);
    return () => cancelAnimationFrame(animId);
  }, [mmrtgCoreTempC, capacitorCharge, wheelIntegrityPct]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between font-mono select-none overflow-hidden text-slate-100">
      {/* 1. TOP VISOR BAR */}
      <header className="p-3 flex justify-between items-start gap-4">
        {/* Top-Left: Active Node & Era Shaders */}
        <div className="pointer-events-auto bg-[#05070B]/90 border border-cyan-500/40 rounded p-2.5 shadow-[0_4px_24px_rgba(0,0,0,0.8)] backdrop-blur-md max-w-sm">
          <div className="flex items-center space-x-2 pb-1 mb-1.5 border-b border-cyan-500/30">
            <Radio className="w-4 h-4 text-[#00F0FF] animate-pulse" />
            <span className="font-extrabold text-xs tracking-widest text-[#00F0FF]">
              NODE M-3B // CURIOSITY (MSL)
            </span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 border border-cyan-400 text-cyan-200">
              GALE CRATER
            </span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950/80 border border-emerald-400 text-emerald-300 font-bold">
              MARS TREK DEM
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-300 mb-1.5">
            <span className="text-slate-400">ERA TESTER:</span>
            <button
              onClick={() => setEraShaderOverride('1967_ANALOG')}
              className={`px-1.5 py-0.5 rounded border ${
                eraShader === '1967_ANALOG'
                  ? 'bg-cyan-500 text-black border-white font-bold'
                  : 'bg-black/50 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              [1] 1967
            </button>
            <button
              onClick={() => setEraShaderOverride('1997_RETRO_16BIT')}
              className={`px-1.5 py-0.5 rounded border ${
                eraShader === '1997_RETRO_16BIT'
                  ? 'bg-cyan-500 text-black border-white font-bold'
                  : 'bg-black/50 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              [2] 1997
            </button>
            <button
              onClick={() => setEraShaderOverride('2012_MSL_DEFAULT')}
              className={`px-1.5 py-0.5 rounded border ${
                eraShader === '2012_MSL_DEFAULT'
                  ? 'bg-cyan-500 text-black border-white font-bold'
                  : 'bg-black/50 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              [3] 2012 HD
            </button>
          </div>

          {/* Camera POV Switcher (Follow 3rd Person vs Free Roam Orbit) */}
          <div className="flex items-center gap-1.5 my-1.5 pt-1.5 border-t border-slate-800">
            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">POV:</span>
            <div className="flex items-center rounded bg-black/60 border border-slate-800 p-0.5 gap-1">
              <button
                onClick={() => {
                  setCameraMode('THIRD_PERSON_DRONE');
                  soundEngine.playUiBlip();
                }}
                className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all ${
                  cameraMode === 'THIRD_PERSON_DRONE'
                    ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                FOLLOW (3RD)
              </button>
              <button
                onClick={() => {
                  setCameraMode('FREE_ORBIT');
                  soundEngine.playUiBlip();
                }}
                className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all ${
                  cameraMode === 'FREE_ORBIT'
                    ? 'bg-amber-400 text-black shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                FREE ROAM
              </button>
            </div>
            <button
              onClick={() => {
                cycleCameraMode();
                soundEngine.playUiBlip();
              }}
              className="text-[8px] text-slate-400 hover:text-cyan-300 ml-auto transition-colors"
              title="Press [C] to cycle Camera POV"
            >
              [C]
            </button>
          </div>

          <div className="flex items-center justify-between text-[9px] text-slate-400">
            <button
              onClick={toggleCodex}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <span>[TAB] CODEX</span>
              <span className={`px-1.5 py-0.2 rounded font-bold ${
                discoveredHotspots.length === 6
                  ? 'bg-emerald-950 border border-emerald-400 text-emerald-300'
                  : 'bg-cyan-950 border border-cyan-400/80 text-cyan-300'
              }`}>
                HW: {discoveredHotspots.length}/6
              </span>
            </button>
          </div>
        </div>

        {/* Top-Right Column: Mission Directive, Spectrum & Live Optical Telemetry PiP */}
        <div className="flex flex-col items-end gap-2.5 pointer-events-auto">
          {/* Directive Card */}
          <div className="bg-[#05070B]/90 border border-cyan-500/40 rounded p-2.5 shadow-[0_4px_24px_rgba(0,0,0,0.8)] backdrop-blur-md w-[360px]">
            <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-cyan-500/30">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                {missionPhase.replace('_', ' ')}
              </span>
              {/* MRO Countdown */}
              <div className="flex items-center space-x-1 text-[11px] font-bold">
                <Clock className={`w-3.5 h-3.5 ${mroWindowSec < 25 ? 'text-red-400 animate-ping' : 'text-cyan-400'}`} />
                <span className="text-slate-400">MRO RELAY:</span>
                <span className={`font-mono ${mroWindowSec < 25 ? 'text-red-400 font-extrabold' : 'text-[#00F0FF]'}`}>
                  {mroFormatted}
                </span>
              </div>
            </div>

            {/* Current Directive Instructions */}
            <div className="text-[10px] text-slate-200 leading-tight mb-2">
              {missionPhase === 'EXPLORING' && (
                <span>Drive to the <strong>John Klein mudstone outcrop</strong> ({distanceToTarget.toFixed(1)}m away). Stop within 7m.</span>
              )}
              {missionPhase === 'LASER_TARGETING' && (
                <span>Fire <strong>ChemCam 1064nm Laser</strong> ([SPACE] or Click). Vaporize rock spot to capture LIBS spectra.</span>
              )}
              {missionPhase === 'SCIENCE_UNLOCKED' && (
                <span className="text-emerald-400 font-bold">
                  Smectite Clays Confirmed! Fresh water ancient lake discovered! Press [NEXT] to align antenna.
                </span>
              )}
              {missionPhase === 'ANTENNA_ALIGN' && (
                <span>Align High-Gain Antenna to <strong>Az: 214°, El: 58°</strong> before the MRO orbiter passes overhead!</span>
              )}
              {missionPhase === 'SOUL_TRANSFER_COMPLETE' && (
                <span className="text-[#00F0FF] font-bold">
                  SOUL-TRANSFER COMPLETE! Data beamed to orbit. Curiosity Codex Unlocked.
                </span>
              )}
              {missionPhase === 'ORBITAL_WINDOW_MISSED' && (
                <span className="text-red-400 font-bold">
                  MRO RELAY WINDOW CLOSED! Press Reset [R] to retry mission.
                </span>
              )}
            </div>

            {/* Live Atomic Emission Spectrometer Chart */}
            <div className="bg-black/60 rounded p-1.5 border border-cyan-950">
              <div className="flex justify-between text-[8.5px] text-slate-400 mb-1">
                <span>LIBS EMISSION SPECTRA</span>
                <span className="text-cyan-300 font-bold">{laserPulsesHit} / 30 PULSES</span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center text-[8px]">
                <div>
                  <div className="text-red-400 font-bold">H 656nm</div>
                  <div className="h-7 bg-slate-900 rounded overflow-hidden flex items-end">
                    <div className="w-full bg-red-500 transition-all duration-100" style={{ height: `${spectralPeaks.H}%` }} />
                  </div>
                </div>
                <div>
                  <div className="text-blue-400 font-bold">Si 288nm</div>
                  <div className="h-7 bg-slate-900 rounded overflow-hidden flex items-end">
                    <div className="w-full bg-blue-400 transition-all duration-100" style={{ height: `${spectralPeaks.Si}%` }} />
                  </div>
                </div>
                <div>
                  <div className="text-amber-400 font-bold">Fe 404nm</div>
                  <div className="h-7 bg-slate-900 rounded overflow-hidden flex items-end">
                    <div className="w-full bg-amber-400 transition-all duration-100" style={{ height: `${spectralPeaks.Fe}%` }} />
                  </div>
                </div>
                <div>
                  <div className="text-emerald-400 font-bold">Mg 518nm</div>
                  <div className="h-7 bg-slate-900 rounded overflow-hidden flex items-end">
                    <div className="w-full bg-emerald-400 transition-all duration-100" style={{ height: `${spectralPeaks.Mg}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Docked Live Optical Telemetry Feed (PiP) */}
          <OpticalSensorPiP />
        </div>
      </header>

      {/* 2. CHEMCAM TELESCOPE OVERLAY (Engaged when cameraMode === 'CHEMCAM_TELESCOPE') */}
      {cameraMode === 'CHEMCAM_TELESCOPE' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Target Reticle Crosshairs */}
          <div className="relative w-64 h-64 border border-[#00F0FF]/40 rounded-full flex items-center justify-center pointer-events-auto cursor-crosshair">
            <div className="absolute w-48 h-48 border border-dashed border-cyan-400/30 rounded-full animate-spin" style={{ animationDuration: '20s' }} />
            <div className="w-3 h-3 bg-red-500/70 rounded-full animate-ping" />
            <div className="absolute -top-6 text-[10px] font-bold text-red-400 bg-black/70 px-2 py-0.5 rounded border border-red-500/40">
              CLICK OR [SPACE] TO PULSE 1064nm LASER
            </div>
          </div>
        </div>
      )}

      {/* 3. ANTENNA ALIGNMENT GIMBAL INTERFACE (Active in ANTENNA_ALIGN phase) */}
      {missionPhase === 'ANTENNA_ALIGN' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto bg-[#05070B]/95 border-2 border-cyan-400 rounded-lg p-4 shadow-[0_0_35px_rgba(0,240,255,0.4)] backdrop-blur-lg w-96 text-center">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-cyan-500/40">
            <span className="font-extrabold text-xs text-[#00F0FF] flex items-center gap-1.5">
              <Signal className="w-4 h-4 text-cyan-300" />
              HIGH-GAIN ANTENNA GIMBAL
            </span>
            <span className="text-[10px] text-amber-300 font-bold">MRO ORBITAL UPLINK</span>
          </div>

          <div className="text-[10px] text-slate-300 mb-3 text-left">
            Align Curiosity's hexagonal reflector dish toward the overhead MRO orbiter. Target: <strong className="text-white">Azimuth 214°</strong>, <strong className="text-white">Elevation 58°</strong>.
          </div>

          <div className="space-y-3 mb-4 text-[10px]">
            {/* Azimuth Slider */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">AZIMUTH (0°–360°):</span>
                <span className={`font-bold ${azimLocked ? 'text-emerald-400' : 'text-[#00F0FF]'}`}>
                  {antennaAzimuth.toFixed(0)}° {azimLocked && '✓ (LOCKED)'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={antennaAzimuth}
                onChange={(e) => {
                  setAntennaAngles(antennaElevation, parseFloat(e.target.value));
                  soundEngine.playAntennaClick();
                }}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Elevation Slider */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">ELEVATION (0°–90°):</span>
                <span className={`font-bold ${elevLocked ? 'text-emerald-400' : 'text-[#00F0FF]'}`}>
                  {antennaElevation.toFixed(0)}° {elevLocked && '✓ (LOCKED)'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                value={antennaElevation}
                onChange={(e) => {
                  setAntennaAngles(parseFloat(e.target.value), antennaAzimuth);
                  soundEngine.playAntennaClick();
                }}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          <div className="p-2 rounded bg-cyan-950/80 border border-cyan-500/40 text-[10px]">
            {antennaLocked ? (
              <div className="text-emerald-400 font-bold flex items-center justify-center gap-1.5 animate-pulse">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ORBITAL CARRIER LOCKED // SOUL-TRANSFER BEAM ENGAGED!
              </div>
            ) : (
              <div className="text-amber-300">
                ALIGNING DISH... Adjust Azimuth & Elevation to achieve lock.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. BOTTOM BAR: Oscilloscope & Telemetry Strip */}
      <footer className="p-3 flex flex-wrap justify-between items-end gap-3">
        {/* Bottom-Left: Live Oscilloscope (MMRTG Temp, Cap, Wheel) */}
        <div className="pointer-events-auto bg-[#05070B]/90 border border-cyan-500/40 rounded p-2.5 shadow-[0_4px_24px_rgba(0,0,0,0.8)] backdrop-blur-md">
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-cyan-500/30 text-[9.5px]">
            <span className="font-bold text-cyan-300">TELEMETRY OSCILLOSCOPE</span>
            <span className="text-slate-400">CH1: MMRTG | CH2: WHEEL</span>
          </div>

          <canvas ref={oscCanvasRef} width={220} height={46} className="bg-black/60 rounded border border-cyan-950 mb-1.5" />

          <div className="grid grid-cols-3 gap-2 text-[9px]">
            <div>
              <span className="text-slate-400 block">MMRTG TEMP:</span>
              <strong className={mmrtgCoreTempC > 210 ? 'text-red-400 animate-pulse' : 'text-amber-400'}>
                {mmrtgCoreTempC.toFixed(1)}°C
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block">CAPACITOR:</span>
              <strong className="text-cyan-300">{capacitorCharge.toFixed(0)}%</strong>
            </div>
            <div>
              <span className="text-slate-400 block">AL WHEEL:</span>
              <strong className={wheelIntegrityPct < 60 ? 'text-red-400' : 'text-emerald-400'}>
                {wheelIntegrityPct.toFixed(0)}%
              </strong>
            </div>
          </div>

          {/* Overheat Warning Banner */}
          {mmrtgCooldown && (
            <div className="mt-1.5 p-1 bg-red-950/80 border border-red-500 text-red-300 text-[8.5px] font-bold rounded flex items-center justify-between animate-pulse">
              <span>THERMAL SHIFT LOCKOUT:</span>
              <span>COOLDOWN {cooldownTimer.toFixed(1)}s</span>
            </div>
          )}
        </div>

        {/* Bottom-Center: Action Prompts */}
        <div className="pointer-events-auto flex items-center gap-2">
          {missionPhase === 'SCIENCE_UNLOCKED' && (
            <button
              onClick={() => {
                setCameraMode('THIRD_PERSON_DRONE');
                setMissionPhase('ANTENNA_ALIGN');
              }}
              className="px-4 py-2 rounded bg-emerald-600 text-white font-bold text-xs border border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:bg-emerald-500 transition animate-bounce"
            >
              ADVANCE TO ANTENNA ALIGNMENT →
            </button>
          )}

          {cameraMode === 'CHEMCAM_TELESCOPE' && (
            <button
              onClick={() => setCameraMode('THIRD_PERSON_DRONE')}
              className="px-3 py-1.5 rounded bg-slate-800 text-slate-200 font-bold text-xs border border-slate-600 hover:bg-slate-700 transition"
            >
              EXIT TELESCOPE [C]
            </button>
          )}
        </div>

        {/* Bottom-Right: Controls Cheat Sheet & Reset */}
        <div className="pointer-events-auto bg-[#05070B]/90 border border-cyan-500/40 rounded p-2 text-[9.5px] text-slate-300 shadow-[0_4px_24px_rgba(0,0,0,0.8)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-cyan-300 font-bold mb-0.5">CONTROLS:</div>
              <div className="text-slate-400">
                [WASD / Arrows] Drive • [C] Camera POV • [Shift] Boost • [Space] ChemCam • [R] Reset
              </div>
            </div>
            <button
              onClick={resetMission}
              className="p-1.5 rounded border border-slate-700 bg-slate-900 text-slate-400 hover:text-cyan-300 hover:border-cyan-400 transition"
              title="Reset Mission Slice"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </footer>

      {/* 5. BRIEFING MODAL (Active at mission start) */}
      {missionPhase === 'BRIEFING' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto p-4">
          <div className="bg-[#05070B] border-2 border-[#00F0FF] rounded-lg p-6 max-w-lg shadow-[0_0_40px_rgba(0,240,255,0.3)] font-mono">
            <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-cyan-500/40">
              <Sparkles className="w-5 h-5 text-[#00F0FF]" />
              <h2 className="text-base font-extrabold text-[#00F0FF] uppercase tracking-wider">
                Echoes in the Regolith // Node M-3B
              </h2>
            </div>

            <div className="text-xs text-slate-300 space-y-2.5 mb-5 leading-relaxed">
              <p>
                <strong>LOCATION:</strong> Gale Crater / Yellowknife Bay, Mars (Sol 1428).
              </p>
              <p>
                You are piloting <strong>Curiosity (Mars Science Laboratory)</strong>. Unlike earlier solar-powered rovers, Curiosity is powered by a <strong>Multi-Mission Radioisotope Thermoelectric Generator (MMRTG)</strong> fueled by decaying Plutonium-238.
              </p>
              <p>
                <strong>DIRECTIVE:</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-200">
                <li>Drive across the mudstone basin to target <strong>"John Klein"</strong> outcrop.</li>
                <li>Avoid sharp basalt ventifacts that puncture thin aluminum wheels.</li>
                <li>Fire the <strong>ChemCam 1064nm Laser</strong> to vaporize rock into plasma and record ancient clay spectra.</li>
                <li>Align the High-Gain Antenna before the <strong>Mars Reconnaissance Orbiter (MRO)</strong> passes overhead to execute the <strong>Soul-Transfer</strong>.</li>
              </ol>
            </div>

            <button
              onClick={startMission}
              className="w-full py-2.5 rounded bg-[#00F0FF] text-black font-extrabold text-xs tracking-wider uppercase hover:bg-cyan-300 transition shadow-[0_0_20px_rgba(0,240,255,0.5)]"
            >
              INITIALIZE CURIOSITY SYSTEMS →
            </button>
          </div>
        </div>
      )}

      {/* 6. CODEX ARCHIVE DRAWER (Opened on Soul-Transfer or TAB) */}
      {isCodexOpen && (
        <div className="absolute inset-y-0 right-0 w-96 bg-[#05070B]/98 border-l-2 border-[#00F0FF] p-5 pointer-events-auto overflow-y-auto shadow-[-10px_0_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-cyan-500/40">
            <div className="flex items-center space-x-2 font-bold text-sm text-[#00F0FF]">
              <BookOpen className="w-4 h-4" />
              <span>CURIOSITY CODEX ARCHIVE</span>
            </div>
            <button onClick={toggleCodex} className="p-1 rounded text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Hardware Scanned Codex Progress Card */}
          <div className="bg-cyan-950/40 border border-cyan-400/50 rounded p-3 mb-4 shadow-[0_0_15px_rgba(0,240,255,0.15)]">
            <div className="flex items-center justify-between text-xs font-mono font-bold mb-2">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Cpu className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>HARDWARE SCANNED</span>
              </span>
              <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                discoveredHotspots.length === 6
                  ? 'bg-emerald-500 text-black shadow-[0_0_8px_#10B981]'
                  : 'bg-amber-950 border border-amber-400 text-amber-300'
              }`}>
                {discoveredHotspots.length} / 6
              </span>
            </div>

            {/* 6-segment Progress Bar */}
            <div className="grid grid-cols-6 gap-1 h-2 bg-slate-900 rounded overflow-hidden mb-3 p-0.5 border border-slate-700">
              {CURIOSITY_HOTSPOTS.map((s) => {
                const isDiscovered = discoveredHotspots.includes(s.id);
                return (
                  <div
                    key={s.id}
                    className={`h-full rounded-sm transition-all duration-300 ${
                      isDiscovered
                        ? 'bg-gradient-to-r from-amber-400 to-emerald-400 shadow-[0_0_4px_#10B981]'
                        : 'bg-slate-800'
                    }`}
                  />
                );
              })}
            </div>

            {/* Subsystem Quick List / Jump Links */}
            <div className="grid grid-cols-2 gap-1.5 text-[9.5px] font-mono">
              {CURIOSITY_HOTSPOTS.map((s) => {
                const isDiscovered = discoveredHotspots.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedHotspotId(s.id);
                      toggleCodex();
                      soundEngine.playHotspotSelect();
                    }}
                    className={`flex items-center justify-between p-1.5 rounded border text-left transition-colors ${
                      isDiscovered
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 hover:bg-emerald-900/50'
                        : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:border-cyan-400/60 hover:text-white'
                    }`}
                  >
                    <span className="truncate pr-1">{s.shortName}</span>
                    {isDiscovered ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <span className="text-[8px] text-amber-400/80 font-bold flex-shrink-0">+</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] text-slate-300 space-y-4 leading-relaxed font-sans">
            <div>
              <h3 className="font-mono text-xs font-bold text-amber-300 mb-1">
                1. WHY NASA ABANDONED SOLAR PANELS FOR MMRTG
              </h3>
              <p className="text-slate-400 text-[10.5px]">
                Spirit and Opportunity were frequently immobilized by Martian dust storms coating their solar cells. Curiosity replaced solar panels with an MMRTG (Plutonium-238 dioxide), generating continuous 110W electrical power and thermal heat to operate through harsh polar winters and global dust storms for over 12+ years.
              </p>
            </div>

            <div>
              <h3 className="font-mono text-xs font-bold text-cyan-300 mb-1">
                2. THE SEVEN MINUTES OF TERROR & SKY CRANE
              </h3>
              <p className="text-slate-400 text-[10.5px]">
                At 900 kg, Curiosity was too heavy for airbags. NASA engineered a rocket-powered Sky Crane descent stage that hovered above the Martian surface and gently winched Curiosity down on nylon tethers directly onto its six wheels before cutting the cords and flying away.
              </p>
            </div>

            <div>
              <h3 className="font-mono text-xs font-bold text-emerald-400 mb-1">
                3. THE ALUMINUM WHEEL PUNCTURE CRISIS
              </h3>
              <p className="text-slate-400 text-[10.5px]">
                To save weight, Curiosity's 50cm wheels were machined from single blocks of aluminum with skins only 0.75mm thick. Rigid cemented ventifacts in Gale Crater tore gash punctures in the grousers. NASA JPL engineers uploaded new wheel-slip traction software and drove in reverse to preserve the wheels as Curiosity climbs Mount Sharp today.
              </p>
            </div>

            <div>
              <h3 className="font-mono text-xs font-bold text-purple-300 mb-1">
                4. THE HISTORIC YELLOWKNIFE BAY DISCOVERY
              </h3>
              <p className="text-slate-400 text-[10.5px]">
                ChemCam's laser and the CheMin XRD confirmed that John Klein was composed of smectite clay minerals formed in neutral-pH, low-salinity freshwater. This proved definitively that Mars was once a habitable planet with calm freshwater lakes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 7. Interactive 3D Hardware Hotspot Cassette-Futurism Inspection Card & SVG Connector */}
      <HotspotInspectionCard />
    </div>
  );
};

