import React, { useState, useEffect } from 'react';
import { ERA_PRESETS, EraKey } from '../../types/era';
import { RoverDriveInput, RoverDriveState, CameraFollowMode } from '../../types/drive';
import {
  Layers,
  Radio,
  Clock,
  Compass,
  Cpu,
  Gauge,
  Zap,
  RotateCcw,
  Camera,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Shield,
} from 'lucide-react';

interface HudOverlayProps {
  currentEra: EraKey;
  onSelectEra: (era: EraKey) => void;
  telemetry: RoverDriveState;
  activeInputs: RoverDriveInput;
  setVirtualInput: (key: keyof RoverDriveInput, value: boolean) => void;
  cameraMode: CameraFollowMode;
  onToggleCameraMode: () => void;
  isCustomModelLoaded?: boolean;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  currentEra,
  onSelectEra,
  telemetry,
  activeInputs,
  setVirtualInput,
  cameraMode,
  onToggleCameraMode,
  isCustomModelLoaded = false,
}) => {
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [solNumber] = useState(1428);
  const eraConfig = ERA_PRESETS[currentEra];

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const hrs = String(Math.floor(diff / 3600)).padStart(2, '0');
      const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const secs = String(diff % 60).padStart(2, '0');
      setElapsedTime(`${hrs}:${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const speedKmh = (Math.abs(telemetry.speed) * 3.6).toFixed(1);
  const speedMs = Math.abs(telemetry.speed).toFixed(2);
  const pitchDeg = (telemetry.pitch * (180 / Math.PI)).toFixed(1);
  const rollDeg = (telemetry.roll * (180 / Math.PI)).toFixed(1);

  // Heading calculation (0 to 360 degrees)
  let headingDeg = (telemetry.yaw * (180 / Math.PI)) % 360;
  if (headingDeg < 0) headingDeg += 360;
  const headingFormatted = String(Math.floor(headingDeg)).padStart(3, '0');

  // Speed bar percentage (0 to 10.5 m/s)
  const speedPercent = Math.min(100, Math.floor((Math.abs(telemetry.speed) / 10.5) * 100));

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-4 font-mono select-none overflow-hidden">
      {/* 1. TOP BAR: Mission Telemetry Header */}
      <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-cyan-500/40 bg-[#05070B]/88 px-3.5 py-2 backdrop-blur-md rounded-t shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
        <div className="flex items-center space-x-2.5 pointer-events-auto">
          {/* NASA Vector Badge */}
          <div className="flex items-center space-x-1.5 bg-cyan-950/80 px-2 py-0.5 border border-cyan-500/60 rounded">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="font-bold text-[11px] tracking-widest text-[#00F0FF]">
              NASA // JPL-CALTECH
            </span>
          </div>

          <div className="h-3.5 w-px bg-cyan-500/30" />

          <h1 className="text-[11px] sm:text-xs font-bold tracking-wider text-slate-100 uppercase">
            Mars Rover Mobility Feasibility Sandbox
          </h1>
        </div>

        {/* Live Mission Clock & Sol counter */}
        <div className="flex items-center space-x-3.5 text-[10px] text-slate-300">
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span className="text-slate-400">MET:</span>
            <span className="font-bold text-cyan-300">{elapsedTime}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Compass className="w-3 h-3 text-amber-400" />
            <span className="text-slate-400">SOL:</span>
            <span className="font-bold text-amber-300">{solNumber}</span>
          </div>
          <div className="hidden md:flex items-center space-x-1">
            <Cpu className="w-3 h-3 text-emerald-400" />
            <span className="text-slate-400">MOBILITY:</span>
            <span className="font-bold text-emerald-400">
              {Math.abs(telemetry.speed) > 0.1 ? 'DRIVING' : 'STANDBY'}
            </span>
          </div>

          {/* Camera Mode Toggle Button */}
          <button
            onClick={onToggleCameraMode}
            className="pointer-events-auto flex items-center space-x-1 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/60 text-[#00F0FF] hover:bg-cyan-900 transition text-[10px]"
          >
            <Camera className="w-3 h-3" />
            <span className="font-bold">
              {cameraMode === 'CHASE' ? 'CHASE CAM' : 'ORBIT CAM'}
            </span>
          </button>
        </div>
      </header>

      {/* 2. MIDDLE SECTION: Instrumentation & Quick Controls */}
      <div className="flex justify-between items-start my-auto w-full">
        {/* Left Card: Rover Flight Dynamics & Speedometer */}
        <div className="pointer-events-auto w-72 rounded bg-[#05070B]/88 p-3 border border-cyan-500/40 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          {/* Header */}
          <div className="flex items-center justify-between pb-1 mb-2 border-b border-cyan-500/30 text-[10px] uppercase font-bold text-cyan-300 tracking-wider">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              Drive Subsystem
            </span>
            <span
              className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                telemetry.isBoosting
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/40'
              }`}
            >
              {telemetry.isBoosting ? 'BOOST GEAR' : 'NOMINAL'}
            </span>
          </div>

          {/* Speedometer Primary Gauge */}
          <div className="bg-black/40 rounded p-2 border border-cyan-900/50 mb-2">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[9px] text-slate-400">GROUND VELOCITY:</span>
              <div className="text-right">
                <span className="text-xl font-extrabold text-[#00F0FF] tracking-tight">
                  {speedKmh}
                </span>
                <span className="text-[10px] text-cyan-300 ml-1">km/h</span>
                <span className="text-[9px] text-slate-400 ml-1.5">({speedMs} m/s)</span>
              </div>
            </div>

            {/* Dynamic Speed Bar */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  telemetry.isBoosting ? 'bg-amber-400' : 'bg-[#00F0FF]'
                }`}
                style={{ width: `${speedPercent}%` }}
              />
            </div>
          </div>

          {/* Attitude / Inclinometer / Heading Readouts */}
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-400">HEADING (AZ):</span>
              <span className="text-amber-300 font-bold">{headingFormatted}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">PITCH (SLOPE):</span>
              <span className="text-cyan-200 font-bold">{pitchDeg}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ROLL (CAMBER):</span>
              <span className="text-cyan-200 font-bold">{rollDeg}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">STEERING YAW:</span>
              <span className="text-cyan-200 font-bold">
                {(telemetry.steerAngle * (180 / Math.PI)).toFixed(0)}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ODOMETER:</span>
              <span className="text-emerald-300 font-bold">
                {telemetry.odometer.toFixed(1)} m
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">COORDINATES:</span>
              <span className="text-slate-300 font-bold text-[9px]">
                X:{telemetry.x.toFixed(1)} Z:{telemetry.z.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Era Selector Buttons */}
        <div className="pointer-events-auto hidden sm:flex flex-col space-y-1.5 bg-[#05070B]/88 p-2.5 rounded border border-cyan-500/40 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.5)] max-w-xs">
          <div className="text-[10px] font-bold text-cyan-300 tracking-wider uppercase border-b border-cyan-500/30 pb-1 mb-0.5 flex items-center justify-between">
            <span>Mission Era Presets</span>
            <span className="text-[9px] text-slate-400 font-normal">Leva Sync</span>
          </div>

          {(Object.keys(ERA_PRESETS) as EraKey[]).map((eraKey) => {
            const preset = ERA_PRESETS[eraKey];
            const isActive = currentEra === eraKey;
            return (
              <button
                key={eraKey}
                onClick={() => onSelectEra(eraKey)}
                className={`text-left p-1.5 rounded transition-all duration-150 border text-[10px] ${
                  isActive
                    ? 'bg-cyan-900/60 border-[#00F0FF] text-white shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                    : 'bg-black/40 border-slate-700/60 text-slate-400 hover:border-cyan-500/60 hover:text-cyan-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{preset.name}</span>
                  <span
                    className={`text-[8px] px-1 py-0.2 rounded font-mono ${
                      isActive
                        ? 'bg-cyan-400 text-black font-bold'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    DPR {preset.dpr}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. BOTTOM CONTROLS & ON-SCREEN TOUCH/CLICK D-PAD */}
      <footer className="mt-auto border-t border-cyan-500/40 bg-[#05070B]/92 p-2.5 sm:p-3 backdrop-blur-md rounded-b shadow-[0_-4px_20px_rgba(0,0,0,0.6)]">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Keybind hints and Telemetry Status */}
          <div className="text-[10px] text-slate-300 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[#00F0FF] font-bold">DRIVE CONTROLS:</span>
              <span className="text-slate-400">
                [W/S] Throttle • [A/D] Steer • [Shift] Boost • [Space] Brake • [R] Reset Pad • [C] Camera
              </span>
            </div>
            <div className="text-[9px] text-slate-400 flex items-center gap-3">
              <span>ACTIVE PRESET: <strong className="text-white">{eraConfig.name}</strong></span>
              <span>DPR: <strong className="text-amber-300">{eraConfig.dpr}x</strong></span>
              <span>INVERTED INK LINES: <strong className="text-cyan-300">#090D16</strong></span>
            </div>
          </div>

          {/* Interactive D-Pad (Touch & Clickable) */}
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Boost button */}
            <button
              onMouseDown={() => setVirtualInput('boost', true)}
              onMouseUp={() => setVirtualInput('boost', false)}
              onTouchStart={() => setVirtualInput('boost', true)}
              onTouchEnd={() => setVirtualInput('boost', false)}
              className={`px-2 py-1.5 rounded border text-[9px] font-bold flex items-center gap-1 transition-all ${
                activeInputs.boost
                  ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-400 hover:text-amber-300'
              }`}
            >
              <Zap className="w-3 h-3" />
              BOOST
            </button>

            {/* D-Pad Buttons */}
            <div className="grid grid-cols-3 gap-1">
              <div />
              <button
                onMouseDown={() => setVirtualInput('forward', true)}
                onMouseUp={() => setVirtualInput('forward', false)}
                onTouchStart={() => setVirtualInput('forward', true)}
                onTouchEnd={() => setVirtualInput('forward', false)}
                className={`w-8 h-8 rounded border flex items-center justify-center transition-all ${
                  activeInputs.forward
                    ? 'bg-[#00F0FF] text-black border-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.6)]'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-300'
                }`}
                title="Drive Forward (W / Up)"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <div />

              <button
                onMouseDown={() => setVirtualInput('left', true)}
                onMouseUp={() => setVirtualInput('left', false)}
                onTouchStart={() => setVirtualInput('left', true)}
                onTouchEnd={() => setVirtualInput('left', false)}
                className={`w-8 h-8 rounded border flex items-center justify-center transition-all ${
                  activeInputs.left
                    ? 'bg-[#00F0FF] text-black border-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.6)]'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-300'
                }`}
                title="Steer Left (A / Left)"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <button
                onMouseDown={() => setVirtualInput('backward', true)}
                onMouseUp={() => setVirtualInput('backward', false)}
                onTouchStart={() => setVirtualInput('backward', true)}
                onTouchEnd={() => setVirtualInput('backward', false)}
                className={`w-8 h-8 rounded border flex items-center justify-center transition-all ${
                  activeInputs.backward
                    ? 'bg-[#00F0FF] text-black border-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.6)]'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-300'
                }`}
                title="Drive Reverse (S / Down)"
              >
                <ArrowDown className="w-4 h-4" />
              </button>

              <button
                onMouseDown={() => setVirtualInput('right', true)}
                onMouseUp={() => setVirtualInput('right', false)}
                onTouchStart={() => setVirtualInput('right', true)}
                onTouchEnd={() => setVirtualInput('right', false)}
                className={`w-8 h-8 rounded border flex items-center justify-center transition-all ${
                  activeInputs.right
                    ? 'bg-[#00F0FF] text-black border-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.6)]'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-300'
                }`}
                title="Steer Right (D / Right)"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Reset to Landing Pad button */}
            <button
              onClick={() => {
                setVirtualInput('reset', true);
                setTimeout(() => setVirtualInput('reset', false), 150);
              }}
              className="p-2 rounded border border-slate-700 bg-slate-900 text-slate-400 hover:border-cyan-400 hover:text-cyan-300 transition"
              title="Reset Rover to Central Landing Pad (R)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
