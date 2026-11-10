import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useMissionStore } from '../store/useMissionStore';
import { CURIOSITY_HOTSPOTS, CuriosityHotspot } from '../data/curiosityHotspots';
import { soundEngine } from '../utils/soundEngine';
import {
  Plus,
  X,
  Check,
  Lightbulb,
  Radio,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';

/**
 * Individual 3D Hotspot Pin rendered in Rover local coordinate space.
 * Features:
 * - Idle: 24px circular glowing ring with radar ping ripple and [+] icon.
 * - Hover: Smoothly glides open into a compact pill badge with audio blip.
 * - Active: Vibrant amber glow and links to the Cassette-Futurism Info Card.
 */
interface HotspotPinProps {
  spot: CuriosityHotspot;
  isSelected: boolean;
  isDiscovered: boolean;
  onSelect: (id: string) => void;
}

const HotspotPin: React.FC<HotspotPinProps> = ({
  spot,
  isSelected,
  isDiscovered,
  onSelect,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const pinRef = useRef<THREE.Group>(null);
  const [pinPos, setPinPos] = useState<[number, number, number]>(spot.pos);

  // Dynamically attach pin directly to the actual 3D hardware mesh node in curiosity.glb
  useFrame(() => {
    if (!pinRef.current?.parent) return;
    const roverRoot = pinRef.current.parent;

    let targetObj = roverRoot.getObjectByName(spot.nodeName);
    if (!targetObj && spot.fallbackNodeNames) {
      for (const name of spot.fallbackNodeNames) {
        targetObj = roverRoot.getObjectByName(name);
        if (targetObj) break;
      }
    }

    if (targetObj) {
      const worldPos = new THREE.Vector3();
      targetObj.getWorldPosition(worldPos);
      worldPos.y += spot.heightOffset || 0.10;

      const localPos = roverRoot.worldToLocal(worldPos);

      if (
        Math.abs(localPos.x - pinPos[0]) > 0.005 ||
        Math.abs(localPos.y - pinPos[1]) > 0.005 ||
        Math.abs(localPos.z - pinPos[2]) > 0.005
      ) {
        setPinPos([localPos.x, localPos.y, localPos.z]);
      }
    }
  });

  const handleMouseEnter = () => {
    setIsHovered(true);
    soundEngine.playUiBlip();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(spot.id);
    soundEngine.playHotspotSelect();
  };

  return (
    <group ref={pinRef}>
      <Html
        position={pinPos}
        center
        distanceFactor={6}
        occlude
        className="pointer-events-auto select-none"
      >
        <div
          id={`rover-hotspot-pin-${spot.id}`}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`group relative flex items-center h-6 cursor-pointer rounded-full font-mono transition-all duration-200 ease-out shadow-lg ${
            isSelected
              ? 'w-auto px-2.5 bg-amber-950/95 border-2 border-[#FFB800] text-amber-300 shadow-[0_0_18px_rgba(255,184,0,0.85)]'
              : isHovered
              ? 'w-auto px-2.5 bg-[#05070B]/95 border-2 border-cyan-300 text-cyan-200 shadow-[0_0_16px_rgba(0,240,255,0.8)]'
              : 'w-6 justify-center bg-[#05070B]/90 border-2 border-[#00F0FF] text-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.65)]'
          }`}
        >
          {/* Pulsing Radar Ripple Ring (Idle & Active) */}
          {!isHovered && (
            <span
              className={`absolute -inset-1 rounded-full border animate-ping pointer-events-none ${
                isSelected ? 'border-amber-400 opacity-80' : 'border-[#00F0FF] opacity-60'
              }`}
              style={{ animationDuration: isSelected ? '1.4s' : '2.2s' }}
            />
          )}

          {/* Center Icon: Plus or Discovered Checkmark */}
          <div className="flex items-center justify-center flex-shrink-0">
            {isSelected ? (
              <Plus className="w-3.5 h-3.5 rotate-45 text-[#FFB800] transition-transform duration-200" />
            ) : isDiscovered && !isHovered ? (
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
            ) : (
              <Plus className="w-3.5 h-3.5 group-hover:rotate-45 transition-transform duration-200" />
            )}
          </div>

          {/* Gliding Title Pill on Hover or Active Selection */}
          {(isHovered || isSelected) && (
            <span className="ml-1.5 whitespace-nowrap text-[9px] font-bold tracking-wider uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] animate-fadeIn">
              {spot.shortName}
            </span>
          )}

          {/* Discovered Subtle Indicator Bead */}
          {isDiscovered && !isSelected && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 border border-black shadow-[0_0_4px_#10B981]" />
          )}
        </div>
      </Html>
    </group>
  );
};

/**
 * 3D Hotspot Collection placed inside the Curiosity Rover root group.
 */
export const RoverHotspots: React.FC = () => {
  const selectedHotspotId = useMissionStore((s) => s.selectedHotspotId);
  const setSelectedHotspotId = useMissionStore((s) => s.setSelectedHotspotId);
  const discoveredHotspots = useMissionStore((s) => s.discoveredHotspots);

  return (
    <group name="CuriosityHardwareHotspots">
      {CURIOSITY_HOTSPOTS.map((spot) => (
        <HotspotPin
          key={spot.id}
          spot={spot}
          isSelected={selectedHotspotId === spot.id}
          isDiscovered={discoveredHotspots.includes(spot.id)}
          onSelect={(id) => setSelectedHotspotId(id)}
        />
      ))}
    </group>
  );
};

/**
 * Cassette-Futurism Hardware Inspection HUD Card & SVG Connector Line.
 * Mounts in 2D Screen Space directly over the viewport.
 */
export const HotspotInspectionCard: React.FC = () => {
  const selectedHotspotId = useMissionStore((s) => s.selectedHotspotId);
  const setSelectedHotspotId = useMissionStore((s) => s.setSelectedHotspotId);
  const discoveredHotspots = useMissionStore((s) => s.discoveredHotspots);

  // Live telemetry for contextual overlay
  const mmrtgCoreTempC = useMissionStore((s) => s.mmrtgCoreTempC);
  const laserPulsesHit = useMissionStore((s) => s.laserPulsesHit);
  const wheelIntegrityPct = useMissionStore((s) => s.wheelIntegrityPct);

  // SVG Line tracking state
  const [lineCoords, setLineCoords] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    visible: boolean;
  } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  const activeSpot = CURIOSITY_HOTSPOTS.find((s) => s.id === selectedHotspotId) || null;
  const activeIndex = CURIOSITY_HOTSPOTS.findIndex((s) => s.id === selectedHotspotId);

  // Keyboard navigation & dismissal: [ESC] closes, [ArrowLeft] / [ArrowRight] cycles
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedHotspotId(null);
      } else if (e.key === 'ArrowRight' && selectedHotspotId) {
        const nextIndex = (activeIndex + 1) % CURIOSITY_HOTSPOTS.length;
        setSelectedHotspotId(CURIOSITY_HOTSPOTS[nextIndex].id);
        soundEngine.playUiBlip();
      } else if (e.key === 'ArrowLeft' && selectedHotspotId) {
        const prevIndex = (activeIndex - 1 + CURIOSITY_HOTSPOTS.length) % CURIOSITY_HOTSPOTS.length;
        setSelectedHotspotId(CURIOSITY_HOTSPOTS[prevIndex].id);
        soundEngine.playUiBlip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedHotspotId, activeIndex, setSelectedHotspotId]);

  // Click outside / empty canvas space dismisses the active card
  useEffect(() => {
    if (!selectedHotspotId) return;

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      if (cardRef.current && cardRef.current.contains(e.target as Node)) {
        return;
      }
      const targetElement = e.target as HTMLElement;
      if (targetElement && targetElement.closest && targetElement.closest('[id^="rover-hotspot-pin-"]')) {
        return;
      }
      setSelectedHotspotId(null);
    };

    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handlePointerDown);
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [selectedHotspotId, setSelectedHotspotId]);

  // Real-time tracking of pin coordinates to draw crisp cassette-futurism SVG connector
  useEffect(() => {
    if (!selectedHotspotId) {
      setLineCoords(null);
      return;
    }

    let animId: number;
    const updateLine = () => {
      const pinElem = document.getElementById(`rover-hotspot-pin-${selectedHotspotId}`);
      const cardElem = cardRef.current;

      if (pinElem && cardElem) {
        const pinRect = pinElem.getBoundingClientRect();
        const cardRect = cardElem.getBoundingClientRect();

        // Pin center coordinates
        const pX = pinRect.left + pinRect.width / 2;
        const pY = pinRect.top + pinRect.height / 2;

        // Card anchor point: top-right corner of card
        const cX = cardRect.right;
        const cY = cardRect.top + 28;

        // Verify if pin is genuinely visible on screen and not occluded or hidden by Drei
        let isVisible = true;

        // 1. Collapsed bounding box (occluded / display: none) or corner fallback
        if (pinRect.width < 1 || pinRect.height < 1 || (pX <= 6 && pY <= 6)) {
          isVisible = false;
        }

        // 2. Element layout check (not attached to visible layout tree)
        if (pinElem.offsetParent === null) {
          isVisible = false;
        }

        // 3. Computed visibility & opacity across parent DOM hierarchy (Drei sets opacity: 0 on occlusion)
        if (isVisible) {
          let curr: HTMLElement | null = pinElem;
          while (curr && curr !== document.body) {
            const style = window.getComputedStyle(curr);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              parseFloat(style.opacity || '1') < 0.1
            ) {
              isVisible = false;
              break;
            }
            curr = curr.parentElement;
          }
        }

        // 4. Viewport boundaries check (must be within active viewport)
        if (
          isVisible &&
          (pX < 10 || pX > window.innerWidth - 10 || pY < 10 || pY > window.innerHeight - 10)
        ) {
          isVisible = false;
        }

        setLineCoords({
          x1: cX,
          y1: cY,
          x2: pX,
          y2: pY,
          visible: isVisible,
        });
      }

      animId = requestAnimationFrame(updateLine);
    };

    animId = requestAnimationFrame(updateLine);
    return () => cancelAnimationFrame(animId);
  }, [selectedHotspotId]);

  if (!activeSpot) return null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prevIndex = (activeIndex - 1 + CURIOSITY_HOTSPOTS.length) % CURIOSITY_HOTSPOTS.length;
    setSelectedHotspotId(CURIOSITY_HOTSPOTS[prevIndex].id);
    soundEngine.playUiBlip();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIndex = (activeIndex + 1) % CURIOSITY_HOTSPOTS.length;
    setSelectedHotspotId(CURIOSITY_HOTSPOTS[nextIndex].id);
    soundEngine.playUiBlip();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedHotspotId(null);
  };

  // Optional contextual live telemetry readout for active spot
  const getLiveTelemetryBadge = () => {
    if (activeSpot.id === 'mmrtg') {
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-400 text-amber-300 font-mono font-bold">
          CORE TEMP: {mmrtgCoreTempC.toFixed(1)}°C
        </span>
      );
    }
    if (activeSpot.id === 'chemcam') {
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-400 text-cyan-300 font-mono font-bold">
          PULSES: {laserPulsesHit} / 30
        </span>
      );
    }
    if (activeSpot.id === 'wheels') {
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-400 text-emerald-300 font-mono font-bold">
          INTEGRITY: {wheelIntegrityPct.toFixed(1)}%
        </span>
      );
    }
    return null;
  };

  return (
    <>
      {/* 1. Fullscreen SVG Circuit Connector Line */}
      {lineCoords && lineCoords.visible && (
        <svg className="fixed inset-0 pointer-events-none z-20 w-full h-full overflow-visible">
          <defs>
            <linearGradient id="hotspotLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFB800" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#00F0FF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#00F0FF" stopOpacity="1" />
            </linearGradient>
            <filter id="hotspotGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Stepped Circuit Path with Chamfer Angle */}
          {(() => {
            const { x1, y1, x2, y2 } = lineCoords;
            const midX = x1 + Math.max(30, (x2 - x1) * 0.45);

            return (
              <g filter="url(#hotspotGlow)">
                {/* Glow underlay */}
                <path
                  d={`M ${x1} ${y1} L ${midX} ${y1} L ${x2} ${y2}`}
                  fill="none"
                  stroke="#FFB800"
                  strokeWidth="3.5"
                  strokeOpacity="0.35"
                />
                {/* Sharp Dashed Cassette Trace */}
                <path
                  d={`M ${x1} ${y1} L ${midX} ${y1} L ${x2} ${y2}`}
                  fill="none"
                  stroke="url(#hotspotLineGrad)"
                  strokeWidth="1.8"
                  strokeDasharray="5 3"
                />

                {/* Card Anchor Diamond */}
                <circle cx={x1} cy={y1} r="3.5" fill="#FFB800" stroke="#05070B" strokeWidth="1" />

                {/* Target Pin Outer Crosshair Ring */}
                <circle
                  cx={x2}
                  cy={y2}
                  r="14"
                  fill="none"
                  stroke="#FFB800"
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                  className="animate-spin"
                  style={{ transformOrigin: `${x2}px ${y2}px`, animationDuration: '8s' }}
                />
              </g>
            );
          })()}
        </svg>
      )}

      {/* 2. Docked Cassette-Futurism Info Card */}
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-auto fixed bottom-6 left-6 z-30 w-[385px] max-w-[calc(100vw-3rem)] font-mono select-none"
      >
        <div className="relative rounded-lg bg-[#05070B]/96 border-2 border-amber-400/90 p-4 shadow-[0_0_35px_rgba(255,184,0,0.3)] backdrop-blur-xl text-slate-100 overflow-hidden">
          {/* Subtle Top Glowing Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-cyan-400 to-amber-400" />

          {/* Corner Framing Brackets */}
          <div className="absolute top-1.5 left-1.5 w-2 h-2 border-t-2 border-l-2 border-amber-400/80 pointer-events-none" />
          <div className="absolute top-1.5 right-1.5 w-2 h-2 border-t-2 border-r-2 border-amber-400/80 pointer-events-none" />
          <div className="absolute bottom-1.5 left-1.5 w-2 h-2 border-b-2 border-l-2 border-amber-400/80 pointer-events-none" />
          <div className="absolute bottom-1.5 right-1.5 w-2 h-2 border-b-2 border-r-2 border-amber-400/80 pointer-events-none" />

          {/* 1. Header Bar: Subsystem Tag & Close Button */}
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-amber-400/30 text-[10px]">
            <div className="flex items-center space-x-1.5 font-bold text-amber-300">
              <Cpu className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>NASA MSL // SUBSYSTEM DIAGNOSTIC</span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/70 border border-amber-400/60 text-amber-300 font-bold">
                SCANNED {discoveredHotspots.length}/6
              </span>
              <button
                onClick={handleClose}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                title="Close [ESC]"
              >
                <X className="w-4 h-4 text-amber-300" />
              </button>
            </div>
          </div>

          {/* 2. Component Title & Spec Badges */}
          <div className="mb-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold text-amber-300 tracking-wide uppercase">
                  {activeSpot.title}
                </h2>
                <div className="text-[10px] text-cyan-300 font-semibold mt-0.5">
                  {activeSpot.component}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[9px] px-2 py-0.5 rounded bg-black/60 border border-amber-400/80 text-amber-200 font-bold shadow-[0_0_8px_rgba(255,184,0,0.25)]">
                {activeSpot.specBadge}
              </span>
              {getLiveTelemetryBadge()}
            </div>
          </div>

          {/* 3. 2-Sentence Kid-Friendly Explanation */}
          <div className="text-[11px] text-slate-200 leading-relaxed font-sans mb-3 bg-slate-950/50 p-2.5 rounded border border-slate-800">
            {activeSpot.explanation}
          </div>

          {/* 4. High-Contrast "Fun Fact" Callout Box */}
          <div className="bg-cyan-950/40 border border-cyan-400/40 p-2.5 rounded text-cyan-200 text-[10.5px] leading-snug mb-3 shadow-[inset_0_0_12px_rgba(0,240,255,0.1)]">
            <div className="flex items-center space-x-1 font-bold text-cyan-300 text-[10px] mb-1 uppercase tracking-wider">
              <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
              <span>FUN FACT</span>
            </div>
            <div className="font-sans text-cyan-100 text-[10.5px]">
              {activeSpot.funFact}
            </div>
          </div>

          {/* 5. Footer: Hotspot Stepper & Navigation Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px]">
            {/* 6 Hotspot Progress Dots */}
            <div className="flex items-center space-x-1.5">
              {CURIOSITY_HOTSPOTS.map((s, idx) => {
                const isCur = s.id === activeSpot.id;
                const isDisc = discoveredHotspots.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedHotspotId(s.id);
                      soundEngine.playUiBlip();
                    }}
                    className={`w-3.5 h-2 rounded transition-all ${
                      isCur
                        ? 'bg-amber-400 shadow-[0_0_6px_#FFB800]'
                        : isDisc
                        ? 'bg-emerald-400/80'
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                    title={s.title}
                  />
                );
              })}
            </div>

            {/* Stepper Buttons */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={handlePrev}
                className="px-2 py-0.5 rounded bg-black/60 border border-slate-700 hover:border-amber-400 hover:text-white text-slate-300 flex items-center gap-1 font-bold transition-colors"
                title="Previous Hotspot [←]"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>PREV</span>
              </button>
              <button
                onClick={handleNext}
                className="px-2 py-0.5 rounded bg-black/60 border border-slate-700 hover:border-amber-400 hover:text-white text-slate-300 flex items-center gap-1 font-bold transition-colors"
                title="Next Hotspot [→]"
              >
                <span>NEXT</span>
                <ChevronRight className="w-3 h-3" />
              </button>
              <button
                onClick={handleClose}
                className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-400 text-amber-300 hover:bg-amber-900 font-bold transition-colors"
                title="Dismiss [ESC]"
              >
                CLOSE [ESC]
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
