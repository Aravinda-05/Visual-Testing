# NASA JPL // Mars Visual Style Feasibility Sandbox
### Moebius Cel-Shaded + Evolving Era Post-Processing 3D Rendering Pipeline

[![React 18](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r169-black?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![React Three Fiber](https://img.shields.io/badge/@react--three/fiber-8.17-blue)](https://docs.pmnd.rs/react-three-fiber/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

A standalone WebGL & React Three Fiber graphics sandbox evaluating a hybrid **Moebius Cel-Shaded + Evolving Spaceflight Era Post-Processing** rendering pipeline for a 3D Martian planetary rover scene.

---

## Visual & Technical Overview

```
+-----------------------------------------------------------------------------------+
|                            HTML DOM / VECTOR OVERLAY                              |
|   - Mission HUD (Top Bar, SOL Counter, MET, Era Badges, 60fps)                   |
|   - Diegetic 3D Spatial UI (<Html distanceFactor={12}> with SVG Leader Lines)     |
|   * RAZOR-SHARP AT NATIVE DISPLAY RESOLUTION (Unaffected by Post-Processing)     |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        @REACT-THREE/POSTPROCESSING STACK                          |
|   - Dynamic Canvas DPR: 0.35 (1967) -> 0.50 (1976) -> 0.75 (1997) -> 1.25 (2021)   |
|   - <Pixelation granularity={...} />                                              |
|   - <Scanline density={...} opacity={0.35} /> (Overlay CRT raster)                |
|   - <ChromaticAberration offset={[dx, dy]} /> (Optical lens dispersion)           |
|   - <Vignette darkness={...} /> + <HueSaturation saturation={-1.0} /> (Monochrome)|
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                          THREE.JS WEBGL RENDER PASS                               |
|   - ToonModelLoader: 4-band DataTexture gradientMap (4x1 RedFormat, NearestFilter)|
|   - Inverted Hull Ink Lines: <Outlines color="#090D16" thickness={0.015} />       |
|   - PlanetarySurface: 200x200 plane with multi-octave non-indexed crater basin    |
|   - Faceted Normals: flatShading: true on Martian ochre (#C85A32)                 |
+-----------------------------------------------------------------------------------+
```

---

## Key Architectural Pillars

### 1. Procedural 4-Step Toon Quantization (`celShading.ts` & `ToonModelLoader.tsx`)
* **Mathematical LUT**: A singleton $4 \times 1$ `THREE.DataTexture` using `THREE.RedFormat` with `NearestFilter` acting as a stepped cel-shading `gradientMap`.
  * Band 1: `[0.00 – 0.25]` $\to$ Deep ink shadow (`40`)
  * Band 2: `[0.25 – 0.50]` $\to$ Core terminator shadow (`105`)
  * Band 3: `[0.50 – 0.75]` $\to$ Base diffuse illumination (`185`)
  * Band 4: `[0.75 – 1.00]` $\to$ Peak specular highlight (`255`)
* **Comic-Book Outlining**: Wrapped with `@react-three/drei` `<Outlines color="#090d16" thickness={0.015} />` for Moebius-style ink lines.
* **Compound Procedural Rover Fallback**: Built entirely from geometric primitives:
  * Warm Electronics Box (WEB) main chassis with gold foil Multi-Layer Insulation (MLI) undercarriage.
  * Three-section solar panel deck with angled port and starboard wings.
  * 6-wheel Rocker-Bogie mobility suspension with cleated wheels and hub caps.
  * Panoramic Mast Assembly (PMA) with stereo Mastcam-Z eyes and SuperCam laser spectrometer.
  * Articulated 5-DoF robotic sample arm with rotary coring drill turret.
  * High-Gain parabolic dish antenna (HGA) and UHF whip antenna.
* **Drop-in GLTF Support & Auto-Grounding**: Drop any custom GLB model into `/public/models/rover.glb`. It automatically traverses the hierarchy, replaces all materials with 4-band `MeshToonMaterial`, enables shadow casting/receiving, and computes the bounding box to seat the model flush on the ground.

### 2. Faceted Planetary Crater Basin (`PlanetarySurface.tsx` & `terrainGenerator.ts`)
* **200m $\times$ 200m Plane**: $128 \times 128$ segments rotated horizontally.
* **Multi-Octave Geology**: Deterministic trigonometric noise combining:
  * Central impact crater with elevated rim ($r \approx 26\text{m}$, elevation $+5.2\text{m}$) and stepped geological terraces.
  * Regional Martian dune waves (Octave 1, $\lambda \approx 90\text{m}$).
  * Rotated fractured bedrock ridges (Octave 2, $\theta \approx 35.5^\circ$).
  * Jagged scree and boulder ridges (Octave 3, fold noise).
  * Micro-chipping facets (Octave 4).
* **Guaranteed Regolith Grounding**: A leveled landing pad ($r \le 4.2\text{m}$, elevation $Y = 0.00\text{m}$) blended via a cubic Hermite smoothstep spline ($t^2(3 - 2t)$), ensuring the rover's wheels firmly contact the ground with zero daylight.
* **Sharp Geometric Facets**: Converted to a non-indexed `BufferGeometry` via `toNonIndexed()` with recomputed face normals, rendered with `flatShading: true` in Martian Ochre (`#C85A32`).

### 3. Era-Reactive Post-Processing Pipeline (`EraPostProcessing.tsx` & `era.ts`)
Driven reactively by a Leva dropdown with four historical spaceflight telemetry states:

| Era Preset | Target Telemetry | Pixel Granularity | Scanline Density | Chromatic Aberration | Color Grade Mode | Canvas DPR |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **`1967_SURVEYOR`** | Vidicon Analog TV Raster | 10 | 2.2 | `[0.004, 0.004]` | Monochrome Phosphor | **0.35** |
| **`1976_VIKING`** | Facsimile Photodiode Scanner | 6 | 1.4 | `[0.003, 0.001]` | Sepia / Kodachrome | **0.50** |
| **`1997_SOJOURNER`** | IMP Stereo CCD (16-bit) | 4 | 0.8 | `[0.001, 0.001]` | 16-bit Dithered Color | **0.75** |
| **`2021_MODERN`** | Mastcam-Z Multispectral Sensor | 0 (Off) | 0.0 (Off) | `[0, 0]` | Full HDR Cel-Shaded Bloom | **1.25** |

* **Hardware-Level DPR Scaling**: The GPU backbuffer itself is reactively downsampled/upsampled via `useThree((state) => state.setDpr(currentDpr))`.
* **Zero Scanline Artifacts in Modern Mode**: Modern digital sensors omit the scanline pass to preserve pristine cel-shading clarity, reserving scanlines strictly for vintage cathode ray / facsimile modes.

### 4. Diegetic 3D Spatial UI (`SpatialTelemetryTag.tsx`)
* Attached directly to the rover's 3D hierarchy:
  1. **Solar Array**: Photovoltaic voltage, solar flux, panel temperature, and dust deposition.
  2. **Mastcam & Turret**: Azimuth/elevation joint angles, spectrometer status, and torque sensor readouts.
* **Vector Crispness Proof**: Mounted via `@react-three/drei` `<Html center distanceFactor={12}>`. Because DOM elements render in the browser's 2D overlay layer above the WebGL `<canvas>`, text, borders, and animated SVG leader lines remain **100% sub-pixel sharp** regardless of whether the WebGL canvas is running at 10px pixelation or 0.35 DPR.

---

## Project Structure

```
e:\Nasa\Visual\
├── index.html                     # HTML5 shell with JetBrains Mono font link
├── package.json                   # Dependencies and npm scripts
├── tsconfig.json                  # Strict TypeScript compiler options
├── vite.config.ts                 # Vite bundler configuration
├── tailwind.config.js             # Tailwind CSS theme with NASA palette
├── postcss.config.js              # PostCSS plugins
├── .gitignore                     # Git ignore rules
├── public/
│   └── models/
│       └── README.md              # Drop-in directory for custom rover.glb
└── src/
    ├── main.tsx                   # React 18 DOM mount point
    ├── App.tsx                    # Top-level orchestrator & Leva cyber theme config
    ├── index.css                  # Tailwind styles & JetBrains Mono typography
    ├── types/
    │   └── era.ts                 # Era preset definitions and configuration types
    ├── utils/
    │   ├── celShading.ts          # 4x1 DataTexture generator & hierarchy traverser
    │   └── terrainGenerator.ts    # Multi-octave trigonometric crater displacement
    └── components/
        ├── canvas/
        │   ├── RoverScene.tsx             # Primary 3D Canvas, OrbitControls & Perf
        │   ├── ToonModelLoader.tsx        # GLTF loader + compound procedural rover fallback
        │   ├── PlanetarySurface.tsx       # 200x200 Faceted Martian ochre crater terrain
        │   ├── LightingAndAtmosphere.tsx  # Dynamic sun, rim lights, and era atmospheric fog
        │   └── SpatialTelemetryTag.tsx    # Sharp diegetic vector DOM tags with SVG leader lines
        ├── postprocessing/
        │   └── EraPostProcessing.tsx      # Era pipeline (Pixelation, Scanline, Chroma, Vignette)
        └── ui/
            └── HudOverlay.tsx             # NASA JPL Mission Control 2D HUD layer
```

---

## Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) v18.0.0 or higher
* npm or pnpm

### Installation

```bash
# Clone or navigate to the repository directory
cd e:/Nasa/Visual

# Install project dependencies
npm install

# Start the Vite local development server
npm run dev
```

The application will be running at `http://localhost:5173`.

### Production Build

```bash
# Type check and generate production bundle in /dist
npm run build

# Preview the production build locally
npm run preview
```

---

## User Controls & Driving Interaction

The rover is fully drivable across the 200m $\times$ 200m Martian crater terrain with real-time 6-wheel suspension conforming to slopes, dynamic steering knuckles, and animated tire rotation.

### Keyboard & Touch Drive Mappings

| Input | Action | Effect |
| :--- | :--- | :--- |
| **`W` / `Arrow Up`** | **Forward Throttle** | Accelerates forward up to $21\,\text{km/h}$ (or $38\,\text{km/h}$ on Boost) |
| **`S` / `Arrow Down`** | **Reverse Throttle** | Drives in reverse with rear wheel rotation |
| **`A` / `Arrow Left`** | **Steer Left** | Pivots front and rear steering knuckles into a banked left turn |
| **`D` / `Arrow Right`** | **Steer Right** | Pivots front and rear steering knuckles into a banked right turn |
| **`Shift`** | **High-Gear Boost** | Unlocks $38\,\text{km/h}$ exploration gear for climbing steep crater walls |
| **`Space`** | **Active Brake** | Applies hydraulic deceleration ($15\,\text{m/s}^2$) |
| **`R`** | **Re-center / Reset** | Teleports rover back to the leveled landing pad at $(0, 0)$ |
| **`C`** | **Toggle Camera Mode** | Toggles between **Chase Cam (Follow)** and **Free Orbit Camera** |
| **On-Screen D-Pad** | **Touch / Mouse Controls** | Click or touch the HUD D-Pad buttons at the bottom-right to drive |
| **Mouse Orbit & Zoom** | **OrbitControls** | In Orbit Cam mode, pan, zoom, or orbit around the moving rover |

---

## Kinematics & Suspension Engine

* **Terrain Elevation Conformation**: In every frame, the rover samples ground height $Y = \text{sampleMartianElevation}(x, z)$ so the wheels remain solidly planted on the surface with zero floating.
* **4-Point Slope Probing (Pitch & Roll)**: Probes $Y$ elevations at the front axle, rear axle, port wheels, and starboard wheels to calculate pitch ($\theta$) and roll ($\phi$), smoothly tilting the chassis over rocky crater terraces and dune slopes.
* **4-Wheel Independent Steering**: Front wheels turn in the direction of the turn, while rear wheels counter-steer at 70% angle (modeling NASA Curiosity / Perseverance rocker-bogie steering) to enable tight cornering and zero-radius pivot spins.
* **Regolith Dust Trail**: Emits low-poly cel-shaded Martian ochre dust puffs behind the wheels proportional to vehicle speed.
* **Live Diegetic Telemetry**: The two 3D spatial callouts directly reflect live driving telemetry: speed in $\text{km/h}$, motor load in Amperes, steering angle, inclinometer tilt degrees, and total distance traveled.

---

## Loading a Custom 3D Model

To test your own 3D rover model:
1. Export your 3D rover as a standard `.glb` file.
2. Place it in `public/models/rover.glb`.
3. In the Leva GUI, set **Model Source** to `Custom GLTF (/models/rover.glb)`.
4. The loader automatically:
   * Replaces all meshes with 4-band `MeshToonMaterial`.
   * Preserves diffuse maps and colors.
   * Calculates bounding boxes to ground the model at $Y = 0.00\text{m}$.
   * Applies comic ink outlines and shadow casting/receiving.

---

## Tech Stack & Libraries

* **Framework**: React 18 + Vite 5 + TypeScript 5
* **3D Engine**: Three.js (r169)
* **Canvas React Wrapper**: `@react-three/fiber` (v8)
* **Three Helpers**: `@react-three/drei` (v9)
* **Post-Processing**: `postprocessing` (v6) + `@react-three/postprocessing` (v2)
* **Debug GUI**: `leva` (v0.9)
* **Diagnostics**: `r3f-perf` (v7)
* **Icons**: `lucide-react`
* **Styling**: Tailwind CSS (v3) + Google Fonts (*JetBrains Mono*)

---

## License

MIT License. Designed for NASA JPL visual style feasibility and WebGL rendering research.

