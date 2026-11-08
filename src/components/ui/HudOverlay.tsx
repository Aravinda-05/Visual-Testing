import React, { useState, useEffect } from 'react';
import { ERA_PRESETS, EraKey } from '../../types/era';
import {
  Activity,
  Layers,
  Monitor,
  Eye,
  Radio,
  Clock,
  Compass,
  Cpu,
  ShieldAlert,
} from 'lucide-react';

interface HudOverlayProps {
  currentEra: EraKey;
  onSelectEra: (era: EraKey) => void;
  drawCalls?: number;
  fps?: number;
  isCustomModelLoaded?: boolean;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  currentEra,
  onSelectEra,
  drawCalls = 0,
  fps = 60,
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

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 font-mono select-none overflow-hidden">
      {/* TOP BAR: Mission Telemetry Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/40 bg-[#05070B]/85 px-4 py-2.5 backdrop-blur-md rounded-t shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
        <div className="flex items-center space-x-3 pointer-events-auto">
          {/* NASA Meatball / Vector Badge */}
          <div className="flex items-center space-x-2 bg-cyan-950/80 px-2.5 py-1 border border-cyan-500/60 rounded">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="font-bold text-xs tracking-widest text-[#00F0FF]">
              NASA // JPL-CALTECH
            </span>
          </div>

          <div className="h-4 w-px bg-cyan-500/30" />

          <h1 className="text-xs sm:text-sm font-bold tracking-wider text-slate-100 uppercase">
            Moebius Cel-Shading + Era Post-Processing Sandbox
          </h1>
        </div>

        {/* Live Mission Clock & Sol counter */}
        <div className="flex items-center space-x-4 text-[11px] text-slate-300">
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">MET:</span>
            <span className="font-bold text-cyan-300">{elapsedTime}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">SOL:</span>
            <span className="font-bold text-amber-300">{solNumber}</span>
          </div>
          <div className="hidden md:flex items-center space-x-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">STATUS:</span>
            <span className="font-bold text-emerald-400">LINK OPTIMAL</span>
          </div>
        </div>
      </header>

      {/* CENTER HUD RETICLE (Cinematic crosshairs) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="w-64 h-64 border border-cyan-500/30 rounded-full flex items-center justify-center">
          <div className="w-48 h-48 border border-dashed border-cyan-400/20 rounded-full" />
          <div className="w-2 h-2 bg-cyan-400 rounded-full absolute" />
        </div>
      </div>

      {/* MIDDLE SECTION: Left Side Telemetry Card & Pipeline Diagnostics */}
      <div className="flex justify-between items-start my-auto w-full">
        {/* Left Card: Pipeline Architecture Status */}
        <div className="pointer-events-auto hidden sm:block w-72 rounded bg-[#05070B]/85 p-3 border border-cyan-500/40 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-cyan-500/30 text-[10px] uppercase font-bold text-cyan-300 tracking-wider">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Rendering Pipeline
            </span>
            <span className="text-emerald-400">ACTIVE</span>
          </div>

          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Cel Gradient LUT:</span>
              <span className="text-cyan-200 font-bold">4x1 DataTexture</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Quantization Bands:</span>
              <span className="text-amber-400 font-bold">4 Discrete Steps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ink Contour Lines:</span>
              <span className="text-cyan-200 font-bold">&lt;Outlines /&gt; #090D16</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Terrain Geometry:</span>
              <span className="text-cyan-200 font-bold">200x200 (128x128 Seg)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Shading Model:</span>
              <span className="text-amber-300 font-bold">Faceted Toon (Martian)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Active Rover Mesh:</span>
              <span className="text-emerald-300 font-bold">
                {isCustomModelLoaded ? 'GLTF Custom Model' : 'Procedural Compound'}
              </span>
            </div>
          </div>

          {/* Diegetic Proof Notice */}
          <div className="mt-3 p-1.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-[9px] text-cyan-300 leading-relaxed">
            <span className="font-bold text-white block mb-0.5">
              DIEGETIC DOM OVERLAY PROOF:
            </span>
            Vector spatial telemetry tags render in crisp 2D DOM layer above the
            downsampled WebGL canvas post-processing pass.
          </div>
        </div>

        {/* Right Side: Quick Era Selector Buttons */}
        <div className="pointer-events-auto flex flex-col space-y-2 bg-[#05070B]/85 p-3 rounded border border-cyan-500/40 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.5)] max-w-xs">
          <div className="text-[10px] font-bold text-cyan-300 tracking-wider uppercase border-b border-cyan-500/30 pb-1 mb-1 flex items-center justify-between">
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
                className={`text-left p-2 rounded transition-all duration-150 border text-[11px] ${
                  isActive
                    ? 'bg-cyan-900/60 border-[#00F0FF] text-white shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                    : 'bg-black/40 border-slate-700/60 text-slate-400 hover:border-cyan-500/60 hover:text-cyan-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{preset.name}</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                      isActive
                        ? 'bg-cyan-400 text-black font-bold'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    DPR {preset.dpr}
                  </span>
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5 font-sans truncate">
                  {preset.codename}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* BOTTOM FOOTER: Active Era Metrics Strip */}
      <footer className="mt-auto border-t border-cyan-500/40 bg-[#05070B]/90 px-4 py-2.5 backdrop-blur-md rounded-b shadow-[0_-4px_20px_rgba(0,0,0,0.6)]">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-[10px]">
          <div>
            <div className="text-slate-500 uppercase text-[9px]">Active Era Preset</div>
            <div className="font-bold text-[#00F0FF] truncate">{eraConfig.name}</div>
          </div>
          <div>
            <div className="text-slate-500 uppercase text-[9px]">Canvas DPR</div>
            <div className="font-bold text-amber-300">{eraConfig.dpr}x Native</div>
          </div>
          <div>
            <div className="text-slate-500 uppercase text-[9px]">Pixel Granularity</div>
            <div className="font-bold text-slate-200">
              {eraConfig.pixelGranularity === 0 ? 'DISABLED (HDR)' : `${eraConfig.pixelGranularity}px Cells`}
            </div>
          </div>
          <div>
            <div className="text-slate-500 uppercase text-[9px]">Scanline Density</div>
            <div className="font-bold text-slate-200">{eraConfig.scanlineDensity}</div>
          </div>
          <div>
            <div className="text-slate-500 uppercase text-[9px]">Chroma Aberration</div>
            <div className="font-bold text-cyan-300">
              [{eraConfig.chromaticAberration[0]}, {eraConfig.chromaticAberration[1]}]
            </div>
          </div>
          <div>
            <div className="text-slate-500 uppercase text-[9px]">Color Space Mode</div>
            <div className="font-bold text-emerald-400 truncate uppercase">
              {eraConfig.colorGrade}
            </div>
          </div>
        </div>

        {/* Navigation / Interaction instructions hint */}
        <div className="mt-2 pt-1.5 border-t border-cyan-900/40 flex justify-between items-center text-[9px] text-slate-400">
          <span>
            [Left Mouse]: Orbit Camera • [Right Mouse]: Pan • [Scroll]: Zoom •
            [Click Callout]: Toggle Telemetry
          </span>
          <span className="hidden sm:inline text-cyan-400/80">
            Drop custom model at /public/models/rover.glb to replace compound rover
          </span>
        </div>
      </footer>
    </div>
  );
};

