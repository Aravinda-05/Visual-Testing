import React, { useState } from 'react';
import { Html } from '@react-three/drei';

export interface TelemetryData {
  title: string;
  subsystemId: string;
  status: 'NOMINAL' | 'ACTIVE' | 'CALIBRATING' | 'WARNING';
  metrics: { label: string; value: string; unit?: string }[];
  leaderDirection?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

interface SpatialTelemetryTagProps {
  position: [number, number, number];
  data: TelemetryData;
  distanceFactor?: number;
  offset?: [number, number];
}

export const SpatialTelemetryTag: React.FC<SpatialTelemetryTagProps> = ({
  position,
  data,
  distanceFactor = 12,
  offset = [30, -50],
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // SVG Leader line path based on offset
  const [ox, oy] = offset;
  const elbowX = ox > 0 ? ox - 20 : ox + 20;

  return (
    <group position={position}>
      <Html
        center
        distanceFactor={distanceFactor}
        position={[0, 0, 0]}
        className="pointer-events-auto select-none"
        zIndexRange={[100, 0]}
      >
        <div className="relative font-mono text-[11px] leading-tight text-cyan-300">
          {/* SVG Vector Leader Line pointing directly to 3D joint [0,0] */}
          <svg
            className="absolute top-0 left-0 overflow-visible pointer-events-none"
            style={{ width: '1px', height: '1px' }}
          >
            {/* Origin Joint Reticle */}
            <circle cx="0" cy="0" r="3" fill="#00F0FF" />
            <circle
              cx="0"
              cy="0"
              r="7"
              fill="none"
              stroke="#00F0FF"
              strokeWidth="1"
              strokeDasharray="2,2"
              className="animate-spin"
              style={{ animationDuration: '4s' }}
            />

            {/* Angular Vector Leader Line */}
            <polyline
              points={`0,0 ${elbowX},${oy} ${ox},${oy}`}
              fill="none"
              stroke="#00F0FF"
              strokeWidth="1.2"
              strokeOpacity="0.85"
            />
          </svg>

          {/* Telemetry Card Box */}
          <div
            style={{
              transform: `translate(${ox}px, ${oy - 20}px)`,
            }}
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-56 rounded-sm bg-[#05070B]/92 border border-[#00F0FF] p-2.5 shadow-[0_0_20px_rgba(0,240,255,0.22)] backdrop-blur-md cursor-pointer transition-all duration-200 hover:border-cyan-200 hover:shadow-[0_0_25px_rgba(0,240,255,0.4)]"
          >
            {/* Header / Subsystem Bar */}
            <div className="flex items-center justify-between border-b border-cyan-500/40 pb-1 mb-1.5">
              <div className="flex items-center space-x-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-pulse" />
                <span className="font-bold tracking-widest text-white text-[10px]">
                  {data.subsystemId}
                </span>
              </div>
              <span
                className={`text-[9px] px-1 py-0.5 rounded uppercase font-bold tracking-wider ${
                  data.status === 'NOMINAL'
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                    : 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40'
                }`}
              >
                {data.status}
              </span>
            </div>

            {/* Subsystem Name */}
            <div className="text-[10px] text-cyan-100 font-semibold mb-1 tracking-tight">
              {data.title}
            </div>

            {/* Dynamic Telemetry Metrics */}
            {isExpanded && (
              <div className="space-y-1 mt-1.5 pt-1.5 border-t border-cyan-900/50">
                {data.metrics.map((metric, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400 font-medium">{metric.label}:</span>
                    <span className="text-[#00F0FF] font-bold">
                      {metric.value} {metric.unit && <span className="text-slate-400 text-[9px] font-normal">{metric.unit}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Corner Decorative Tech Marks */}
            <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-cyan-400 pointer-events-none" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-cyan-400 pointer-events-none" />
          </div>
        </div>
      </Html>
    </group>
  );
};

