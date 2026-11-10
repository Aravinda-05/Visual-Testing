import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useFBO } from '@react-three/drei';
import { useMissionStore } from '../store/useMissionStore';
import { JOHN_KLEIN_POS, getTerrainHeight } from '../utils/terrainMath';
import { Video, Target, Crosshair } from 'lucide-react';

const PIP_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const PIP_FRAGMENT_SHADER = `
uniform sampler2D tDiffuse;
uniform float uTime;
uniform int uEra; // 1 = 1967, 2 = 1997, 3 = 2012
uniform vec2 uResolution;
uniform float uLaserFlash;
uniform float uDistToTarget;
varying vec2 vUv;

// 4x4 Bayer Dithering Matrix
float getBayerValue(vec2 coord) {
  int x = int(mod(coord.x, 4.0));
  int y = int(mod(coord.y, 4.0));
  int idx = x + y * 4;
  
  if (idx == 0) return 0.0 / 16.0;
  if (idx == 1) return 8.0 / 16.0;
  if (idx == 2) return 2.0 / 16.0;
  if (idx == 3) return 10.0 / 16.0;
  if (idx == 4) return 12.0 / 16.0;
  if (idx == 5) return 4.0 / 16.0;
  if (idx == 6) return 14.0 / 16.0;
  if (idx == 7) return 6.0 / 16.0;
  if (idx == 8) return 3.0 / 16.0;
  if (idx == 9) return 11.0 / 16.0;
  if (idx == 10) return 1.0 / 16.0;
  if (idx == 11) return 9.0 / 16.0;
  if (idx == 12) return 15.0 / 16.0;
  if (idx == 13) return 7.0 / 16.0;
  if (idx == 14) return 13.0 / 16.0;
  return 5.0 / 16.0;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;

  // ==========================================
  // [1] 1967 VIDICON TUBE (Surveyor / Lunar Orbiter TV)
  // ==========================================
  if (uEra == 1) {
    // 1. Subtle CRT Barrel Curvature
    vec2 centered = uv - 0.5;
    float r2 = dot(centered, centered);
    vec2 crtUv = clamp(centered * (1.0 + 0.15 * r2) + 0.5, 0.0, 1.0);

    // 2. Slow 2-second Frame-Buffer Ghosting Refresh Wipe
    float sweep = fract(uTime / 2.0); // 0.0 to 1.0 every 2.0s
    float beamPos = 1.0 - sweep;
    float beamDiff = crtUv.y - beamPos;
    float beamLine = smoothstep(0.025, 0.0, abs(beamDiff)) * 0.45;
    
    // Ghost persistence: scanned region is brighter
    float ghost = (beamDiff > 0.0) ? 1.0 : 0.82;

    // Sample texture
    vec4 tex = texture2D(tDiffuse, crtUv);
    float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    
    // Fine scanlines
    float scanline = sin(crtUv.y * 520.0) * 0.10;
    lum = clamp(lum + scanline, 0.0, 1.0);

    // 3. 4x4 Bayer Dithering into 2-bit palette (4 discrete levels)
    float bayer = getBayerValue(gl_FragCoord.xy);
    float ditheredLum = lum + (bayer - 0.5) * 0.35;
    
    // Quantize to 2-bit (4 levels: 0.0, 0.33, 0.67, 1.0)
    float level = floor(ditheredLum * 3.0 + 0.5) / 3.0;
    level = clamp(level * ghost + beamLine, 0.0, 1.0);

    // P1/P4 Greenish-White Phosphor Palette
    vec3 phosphorColor = vec3(level * 0.88, level * 1.0, level * 0.82);
    // CRT glass vignette
    float vig = 1.0 - smoothstep(0.35, 0.85, r2) * 0.35;
    phosphorColor *= vig;

    gl_FragColor = vec4(phosphorColor, 1.0);
    return;
  }

  // ==========================================
  // [2] 1997 CCD BUMPER CAM (Sojourner Rover)
  // ==========================================
  if (uEra == 2) {
    // 1. Subtle Barrel Distortion
    vec2 centered = uv - 0.5;
    float dist = length(centered);
    float distortion = 1.0 + 0.18 * (dist * dist);
    vec2 fishUv = clamp(centered * distortion + 0.5, 0.0, 1.0);

    // 2. 160x120 Virtual Pixel Grid
    vec2 gridRes = vec2(160.0, 120.0);
    vec2 pixelUv = floor(fishUv * gridRes) / gridRes;

    vec4 tex = texture2D(tDiffuse, pixelUv);

    // 3. 16-bit RGB565 Color Quantization
    vec3 quantized;
    quantized.r = floor(tex.r * 31.0 + 0.5) / 31.0;
    quantized.g = floor(tex.g * 63.0 + 0.5) / 63.0;
    quantized.b = floor(tex.b * 31.0 + 0.5) / 31.0;

    // Slight sensor noise
    float noise = (hash(pixelUv + fract(uTime)) - 0.5) * 0.05;
    quantized = clamp(quantized + noise, 0.0, 1.0);

    // 4. Green Bounding-Box Telemetry Overlay
    vec2 screenPos = vUv;
    vec2 boxMin = vec2(0.24, 0.18);
    vec2 boxMax = vec2(0.76, 0.82);
    float lineThick = 0.009;
    float cornerLen = 0.08;

    bool isCorner = (
      (screenPos.x >= boxMin.x && screenPos.x <= boxMin.x + cornerLen && abs(screenPos.y - boxMin.y) < lineThick) ||
      (screenPos.y >= boxMin.y && screenPos.y <= boxMin.y + cornerLen && abs(screenPos.x - boxMin.x) < lineThick) ||
      (screenPos.x <= boxMax.x && screenPos.x >= boxMax.x - cornerLen && abs(screenPos.y - boxMin.y) < lineThick) ||
      (screenPos.y >= boxMin.y && screenPos.y <= boxMin.y + cornerLen && abs(screenPos.x - boxMax.x) < lineThick) ||
      (screenPos.x >= boxMin.x && screenPos.x <= boxMin.x + cornerLen && abs(screenPos.y - boxMax.y) < lineThick) ||
      (screenPos.y <= boxMax.y && screenPos.y >= boxMax.y - cornerLen && abs(screenPos.x - boxMin.x) < lineThick) ||
      (screenPos.x <= boxMax.x && screenPos.x >= boxMax.x - cornerLen && abs(screenPos.y - boxMax.y) < lineThick) ||
      (screenPos.y <= boxMax.y && screenPos.y >= boxMax.y - cornerLen && abs(screenPos.x - boxMax.x) < lineThick)
    );

    vec3 finalColor = quantized;
    if (isCorner) {
      finalColor = vec3(0.0, 1.0, 0.35); // Vibrant NASA green telemetry brackets
    }

    gl_FragColor = vec4(finalColor, 1.0);
    return;
  }

  // ==========================================
  // [3] 2012 CHEMCAM LIBS TELESCOPE (Curiosity MSL)
  // ==========================================
  {
    // Live feed fills the full 360x260 sensor area (zero black letterboxing)
    vec4 tex = texture2D(tDiffuse, uv);

    // 1. Thermal / Mineral False-Color Highlights on mudstone target
    float warmFactor = clamp((tex.r - tex.b) * 1.6, 0.0, 1.0);
    vec3 falseColor = mix(tex.rgb, vec3(tex.r * 1.35, tex.g * 0.92, tex.b * 1.45), warmFactor * 0.45);

    // 2. Bright Plasma Flash whenever [SPACE] fires 1064nm laser
    vec3 flash = vec3(1.0, 0.4, 0.8) * uLaserFlash * 2.8;
    vec3 insideColor = clamp(falseColor + flash, 0.0, 1.0);

    // 3. Subtle Telephoto Vignette (slight corner falloff, no black cutoff)
    vec2 centered = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    float dist = length(centered);
    float vignette = 1.0 - smoothstep(0.45, 0.85, dist) * 0.35;
    insideColor *= vignette;

    // 4. Baked Fiducial Crosshairs (+) and calibration tick marks
    float centerDist = length(uv - 0.5);
    vec2 diff = abs(uv - 0.5);
    float crossX = step(diff.x, 0.0025) * step(diff.y, 0.32);
    float crossY = step(diff.y, 0.0035) * step(diff.x, 0.32);
    float centerGap = step(0.02, centerDist);
    float crosshair = max(crossX, crossY) * centerGap;

    // Small rangefinder circles
    float ring1 = smoothstep(0.003, 0.0, abs(centerDist - 0.08));
    float ring2 = smoothstep(0.003, 0.0, abs(centerDist - 0.22));

    // Outer circular reticle guide ring
    float outerRing = smoothstep(0.0035, 0.0, abs(dist - 0.44));

    if (crosshair > 0.5 || ring1 > 0.5 || ring2 > 0.5 || outerRing > 0.5) {
      insideColor = mix(insideColor, vec3(0.0, 0.94, 1.0), 0.92); // Cyan reticle
    }

    gl_FragColor = vec4(insideColor, 1.0);
    return;
  }
}
`;

/**
 * 3D Engine Component (Rendered inside <Canvas>)
 * Attaches a secondary camera to Curiosity's Remote Sensing Mast (ChemCam head),
 * captures live feed to an FBO, and draws it with era shaders into the docked PiP viewport.
 */
export const MastCameraRenderer: React.FC = () => {
  const roverPos = useMissionStore((s) => s.roverPos);
  const roverRotation = useMissionStore((s) => s.roverRotation);
  const roverRoll = useMissionStore((s) => s.roverRoll);
  const roverSpeed = useMissionStore((s) => s.roverSpeed);
  const era = useMissionStore((s) => s.eraShaderOverride);
  const distanceToTarget = useMissionStore((s) => s.distanceToTarget);
  const missionPhase = useMissionStore((s) => s.missionPhase);
  const lastLaserFireTime = useMissionStore((s) => s.lastLaserFireTime);

  // 360x260 Offscreen Render Target for Mast Feed
  const fbo = useFBO(360, 260, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
  });

  // Secondary Perspective Camera attached to Remote Sensing Mast (ChemCam)
  const mastCamera = useMemo(() => {
    return new THREE.PerspectiveCamera(38, 360 / 260, 0.1, 500);
  }, []);

  // Orthographic Camera & Fullscreen Quad for Shader Post-Processing
  const orthoCamera = useMemo(() => {
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    cam.position.set(0, 0, 1);
    cam.lookAt(0, 0, 0);
    return cam;
  }, []);

  const pipMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: PIP_VERTEX_SHADER,
      fragmentShader: PIP_FRAGMENT_SHADER,
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uEra: { value: 3 },
        uResolution: { value: new THREE.Vector2(360, 260) },
        uLaserFlash: { value: 0 },
        uDistToTarget: { value: 34.0 },
      },
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, []);

  const pipScene = useMemo(() => {
    const s = new THREE.Scene();
    const geo = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geo, pipMaterial);
    mesh.position.set(0, 0, 0);
    s.add(mesh);
    return s;
  }, [pipMaterial]);

  // Target spot on John Klein mudstone
  const targetSpot = useMemo(() => {
    const y = getTerrainHeight(JOHN_KLEIN_POS[0], JOHN_KLEIN_POS[1]) + 0.95;
    return new THREE.Vector3(JOHN_KLEIN_POS[0] + 0.2, y, JOHN_KLEIN_POS[1] - 0.1);
  }, []);

  const pipFrameCounter = useRef(0);

  useFrame((state) => {
    const { gl, scene, camera, size } = state;
    const time = state.clock.getElapsedTime();
    const canvas = gl.domElement;
    const canvasRect = canvas.getBoundingClientRect();
    pipFrameCounter.current++;

    // Locate Docked DOM Container early
    const pipElement = document.getElementById('optical-sensor-pip-viewport');
    const isPipActive = !!pipElement && canvasRect.width > 0 && canvasRect.height > 0;

    // 1. Calculate Remote Sensing Mast World Position
    const yaw = roverRotation;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    // Mast base is [0.42, 0, 0.85] on rover chassis
    const mastBaseX = roverPos[0] + rightX * 0.42 + fwdX * 0.85;
    const mastBaseZ = roverPos[2] + rightZ * 0.42 + fwdZ * 0.85;

    // Subtle mast vibration when rover is driving
    const isMoving = Math.abs(roverSpeed) > 0.1;
    const vibAmount = isMoving ? Math.min(1.0, Math.abs(roverSpeed) / 4.0) : 0;
    const vibX = Math.sin(time * 26) * 0.005 * vibAmount;
    const vibY = Math.cos(time * 34) * 0.007 * vibAmount;
    const vibZ = Math.sin(time * 30) * 0.005 * vibAmount;

    // Camera sits right at the ChemCam lens aperture (height 2.45m, pushed forward 0.28m so it never clips rover body)
    const camX = mastBaseX + fwdX * 0.28 + vibX;
    const camY = roverPos[1] + 2.45 + vibY;
    const camZ = mastBaseZ + fwdZ * 0.28 + vibZ;

    mastCamera.position.set(camX, camY, camZ);

    // 2. Orient Mast Camera: Aim directly at John Klein when in range, or forward down at terrain
    const isTargetMode = distanceToTarget <= 7.0 || missionPhase === 'LASER_TARGETING';
    if (isTargetMode) {
      mastCamera.lookAt(targetSpot);
    } else {
      // Look forward along rover heading tilted down to capture terrain ahead
      const lookDist = 14.0;
      const lookX = camX + fwdX * lookDist;
      const lookY = camY - 2.0;
      const lookZ = camZ + fwdZ * lookDist;
      mastCamera.lookAt(new THREE.Vector3(lookX, lookY, lookZ));
    }

    // Roll synchronization
    mastCamera.rotation.z += roverRoll * 0.4;
    mastCamera.updateMatrixWorld();

    // 3. Render Mast Camera into FBO (Optimized: throttled to every 2nd frame when visible, 30fps feed saves 50% draw calls)
    if (isPipActive && pipFrameCounter.current % 2 === 0) {
      gl.setRenderTarget(fbo);
      gl.clear();
      gl.render(scene, mastCamera);
      gl.setRenderTarget(null);
    }

    // 4. Render Main 3D Canvas (Crisp Moebius Cel-Shading)
    gl.setViewport(0, 0, size.width, size.height);
    gl.setScissorTest(false);
    gl.render(scene, camera);

    // 5. Render PiP Quad with Era Shaders
    if (pipElement && canvasRect.width > 0 && canvasRect.height > 0) {
      const rect = pipElement.getBoundingClientRect();

      // Three.js setViewport and setScissor expect CSS pixel coordinates
      // and automatically multiply by pixelRatio internally.
      const pipX = Math.round(rect.left - canvasRect.left);
      const pipY = Math.round(canvasRect.bottom - rect.bottom);
      const pipW = Math.round(rect.width);
      const pipH = Math.round(rect.height);

      if (pipW > 0 && pipH > 0) {
        // Plasma Flash decay calculation
        const elapsedFlash = (Date.now() - lastLaserFireTime) / 1000;
        const flash = Math.max(0, 1.0 - elapsedFlash * 4.5);

        // Map era preset to shader integer
        const eraInt = era === '1967_ANALOG' ? 1 : era === '1997_RETRO_16BIT' ? 2 : 3;

        // Update shader uniforms
        pipMaterial.uniforms.tDiffuse.value = fbo.texture;
        pipMaterial.uniforms.uTime.value = time;
        pipMaterial.uniforms.uEra.value = eraInt;
        pipMaterial.uniforms.uLaserFlash.value = flash;
        pipMaterial.uniforms.uDistToTarget.value = distanceToTarget;
        pipMaterial.uniforms.uResolution.value.set(rect.width, rect.height);

        gl.setScissorTest(true);
        gl.setViewport(pipX, pipY, pipW, pipH);
        gl.setScissor(pipX, pipY, pipW, pipH);

        gl.render(pipScene, orthoCamera);

        gl.setScissorTest(false);
        gl.setViewport(0, 0, size.width, size.height);
      }
    }
  }, 1);

  return null;
};

/**
 * Optical Sensor PiP HUD Component (Rendered into Flight Director DOM UI)
 * Sits inside the right-hand column directly beneath the Directive Card.
 */
export const OpticalSensorPiP: React.FC = () => {
  const [isMinimized, setIsMinimized] = React.useState(false);
  const era = useMissionStore((s) => s.eraShaderOverride);
  const setEraShaderOverride = useMissionStore((s) => s.setEraShaderOverride);
  const distanceToTarget = useMissionStore((s) => s.distanceToTarget);
  const laserPulsesHit = useMissionStore((s) => s.laserPulsesHit);
  const cameraMode = useMissionStore((s) => s.cameraMode);
  const setCameraMode = useMissionStore((s) => s.setCameraMode);

  return (
    <div className="pointer-events-auto flex flex-col font-mono select-none">
      {/* Outer Telemetry Container: NO background on outer container so the canvas shines through the viewport! */}
      <div className="relative w-[360px] border border-cyan-400/50 rounded-lg shadow-[0_0_25px_rgba(0,240,255,0.25)] overflow-hidden bg-transparent">
        {/* 1. Header Bar: Solid background */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#05070B]/95 backdrop-blur-md border-b border-cyan-500/40 text-[10px]">
          <div className="flex items-center gap-1.5 font-bold text-cyan-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <Video className="w-3.5 h-3.5 text-cyan-400" />
            <span>LIVE OPTICAL TELEMETRY FEED</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-amber-300 font-bold">28° FOV // 1064nm</span>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-slate-400 hover:text-white px-1 font-bold text-xs"
              title={isMinimized ? 'Expand Feed' : 'Minimize Feed'}
            >
              {isMinimized ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* 2. Era Selector Buttons Strip: Solid background */}
            <div className="flex items-center justify-between px-2.5 py-1 bg-[#05070B]/95 backdrop-blur-md border-b border-cyan-500/20 text-[9.5px]">
              <span className="text-slate-400 font-bold">OPTICAL SENSOR:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEraShaderOverride('1967_ANALOG')}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
                    era === '1967_ANALOG'
                      ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(0,240,255,0.6)]'
                      : 'bg-slate-900 text-slate-300 border border-slate-700 hover:text-white'
                  }`}
                >
                  [1] 1967 VIDICON
                </button>
                <button
                  onClick={() => setEraShaderOverride('1997_RETRO_16BIT')}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
                    era === '1997_RETRO_16BIT'
                      ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(0,240,255,0.6)]'
                      : 'bg-slate-900 text-slate-300 border border-slate-700 hover:text-white'
                  }`}
                >
                  [2] 1997 CCD
                </button>
                <button
                  onClick={() => setEraShaderOverride('2012_MSL_DEFAULT')}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
                    era === '2012_MSL_DEFAULT'
                      ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(0,240,255,0.6)]'
                      : 'bg-slate-900 text-slate-300 border border-slate-700 hover:text-white'
                  }`}
                >
                  [3] 2012 CHEMCAM
                </button>
              </div>
            </div>

            {/* 3. The 360x260 100% Transparent WebGL Viewport Docking Area */}
            <div className="relative w-[360px] h-[260px] bg-transparent">
              {/* Target alignment rect tracked by Three.js WebGL Scissor/Viewport */}
              <div
                id="optical-sensor-pip-viewport"
                className="w-full h-full bg-transparent"
              />

              {/* Diegetic Camera Metadata Stamp Overlay */}
              <div className="absolute top-2 left-2 text-[9px] text-cyan-300 font-mono pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                <div>MAST-CAM // NODE M-3B</div>
                <div>STATUS: {distanceToTarget <= 7.0 ? 'TARGET ACQUIRED' : 'SCANNING REGOLITH'}</div>
              </div>

              <div className="absolute top-2 right-2 text-[9px] text-amber-300 font-mono pointer-events-none text-right drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                <div>GALE CRATER // LIBS</div>
                <div>PULSES: {laserPulsesHit}/30</div>
              </div>

              {/* Interactive Toggle for Telescope Zoom Mode */}
              <button
                onClick={() => setCameraMode(cameraMode === 'CHEMCAM_TELESCOPE' ? 'THIRD_PERSON_DRONE' : 'CHEMCAM_TELESCOPE')}
                className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 border border-cyan-400/60 text-[9px] text-cyan-200 hover:bg-cyan-950 font-bold flex items-center gap-1 shadow-md"
              >
                <Crosshair className="w-3 h-3 text-cyan-400" />
                <span>{cameraMode === 'CHEMCAM_TELESCOPE' ? 'EXIT ZOOM' : 'FULL ZOOM'}</span>
              </button>
            </div>

            {/* 4. Bottom Telemetry Bar: Solid background */}
            <div className="px-3 py-1.5 bg-[#05070B]/95 backdrop-blur-md border-t border-cyan-500/30 text-[9.5px] flex items-center justify-between text-slate-300">
              <div className="flex items-center gap-1">
                <Target className="w-3 h-3 text-cyan-400" />
                <span>JOHN KLEIN:</span>
                <strong className={distanceToTarget <= 7.0 ? 'text-emerald-400 font-bold' : 'text-amber-300'}>
                  {distanceToTarget.toFixed(1)}m
                </strong>
              </div>
              <span className="text-[9px] text-slate-400">HOTKEYS [1][2][3] | [SPACE] FIRE</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
