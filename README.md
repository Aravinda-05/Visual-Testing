# NASA JPL // Mars Curiosity (MSL) Visual Feasibility Sandbox
### Moebius Cel-Shaded 3D Simulation with Genuine NASA Mars Trek DEM & Historical Era Shaders

[![React 18](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r169-black?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![React Three Fiber](https://img.shields.io/badge/@react--three/fiber-8.17-blue)](https://docs.pmnd.rs/react-three-fiber/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

A real-time WebGL and React Three Fiber planetary simulation evaluating a hybrid **Moebius Cel-Shaded Art Style + Evolving Spaceflight Era Sensor Shaders** for a playable NASA Mars Curiosity Rover (**Node M-3B**) vertical slice set in Gale Crater / Yellowknife Bay.

---

## Technical Architecture Overview

```
+-----------------------------------------------------------------------------------------------+
|                                  FLIGHT DIRECTOR 2D HUD LAYER                                 |
|  - 2-Minute MRO Orbital Relay Countdown Timer (State Machine & Audio Cues)                    |
|  - Real-Time Telemetry Oscilloscope (60fps Canvas: MMRTG Temp, Capacitor, Wheel Integrity)   |
|  - Live LIBS Atomic Emission Spectrometer (H 656nm, Si 288nm, Fe 404nm, Mg 518nm)            |
|  - Antenna Gimbal Alignment Radar Interface (Dual-axis Azimuth / Elevation S-Band Lock)       |
+-----------------------------------------------------------------------------------------------+
                                                |
                                                v
+-----------------------------------------------------------------------------------------------+
|                     PICTURE-IN-PICTURE (PiP) HISTORICAL OPTICAL SENSOR FEED                   |
|  - Mast-Mounted Secondary PerspectiveCamera (fov=38) with Chassis Vibration Harmonics         |
|  - Dynamic Scissor / Viewport Sub-Rendering into 360x260px Docked HUD Window                  |
|  - Era Shaders: [1] 1967 Vidicon TV | [2] 1997 CCD Bumper Cam | [3] 2012 ChemCam Telescope   |
|  - Full Cross-DPR Zoom Parity (100%, 80%, 125%, 150% browser scalings)                        |
+-----------------------------------------------------------------------------------------------+
                                                |
                                                v
+-----------------------------------------------------------------------------------------------+
|                               THREE.JS / R3F PLANETARY WORLD                                  |
|  - Moebius Cel-Shading: 4-band DataTexture LUT + Inverted Hull Outlines (<Outlines />)        |
|  - Step 0B Pipeline: NASA Mars Trek .stl -> DEM Heightmap (256x256 relief + 14m elevation)    |
|  - Curiosity Kinematics: 6-wheel rocker-bogie, 4-wheel steering, suspension slope probes      |
|  - MMRTG Nuclear Thermal Dynamics (110W Pu-238, cooling curve, overheat lockouts at 225°C)   |
|  - Aluminum Wheel Punctures: High-speed basalt ventifact collisions cause drift & speed drops |
|  - ChemCam LIBS Laser: 1064nm pulsed mudstone vaporization with plasma sparks & chimes       |
|  - Cosmic Soul-Transfer Sequence: Ascending orbital particle beam to Mars Reconnaissance Orb. |
+-----------------------------------------------------------------------------------------------+
```

---

## Core Systems & Implementation Details

### 1. Step 0B: NASA Mars Trek `.stl` to DEM Heightmap Pipeline (`convert_stl_dem.py`)
To ensure topological accuracy, the terrain relief is extracted directly from genuine NASA orbital survey elevation models downloaded from **NASA Mars Trek**:
* **Binary/ASCII STL Ingestion**: `convert_stl_dem.py` parses `raw_assets/trekSTL.stl` (323,190 triangles, 969,570 vertices) using `numpy` and binary `struct`.
* **3D-Print Baseplate Stripping**: Automatically filters out flat 3D-printing pedestal vertices ($Z \le -21.7855\,\text{m}$), isolating 960,000 genuine Martian surface points.
* **Rasterization & Anti-Aliasing**: Projects $(X, Y)$ onto a $256 \times 256$ grid recording maximum elevation, fills interior voids via nearest-neighbor interpolation, and applies a $1\,\text{px}$ Gaussian blur (`PIL.ImageFilter.GaussianBlur`) to eliminate 8-bit quantization stepping.
* **Output Assets**:
  * `public/terrains/gale_crater_dem.png`: 8-bit normalized grayscale elevation heightmap.
  * `public/terrains/gale_crater_texture.png`: $1024 \times 1024$ hypsometric elevation texture with NASA contour lines.
  * `public/terrains/gale_crater_normal.png`: $1024 \times 1024$ surface relief tangent normal map.
* **Kinematics Synchronization (`terrainMath.ts`)**: The DEM height grid is pre-baked into `galeCraterDemData.ts` and sampled via bilinear interpolation in `getTerrainHeight(x, z)`. The origin touchdown site is normalized to $Y = 0.00\,\text{m}$, guaranteeing zero wheel floating between the visual mesh and the physics engine.

---

### 2. Curiosity Rover Physics & Engineering Kinematics (`CuriosityRover.tsx`)
* **6-Wheel Rocker-Bogie Suspension**: Probes ground heights at the front axle, rear axle, port wheels, and starboard wheels to calculate chassis pitch ($\theta$) and roll ($\phi$) dynamically across steep crater inclines.
* **4-Wheel Independent Steering**: Front wheels turn toward steering inputs, while rear wheels counter-steer at a 70% ratio (simulating NASA Curiosity / Perseverance steering kinematics) for tight turns and zero-radius pivot spins.
* **Nuclear Thermal Management (MMRTG)**:
  * Simulates Curiosity's Multi-Mission Radioisotope Thermoelectric Generator fueled by Plutonium-238 dioxide.
  * Continuously balances 110W baseline decay heat against radiative convective dissipation.
  * Core operating temperature: $180^\circ\text{C} - 240^\circ\text{C}$. High-gear boost driving generates excess heat; exceeding $225^\circ\text{C}$ activates automatic thermal throttling and locks out the drive motors until cooldown.
* **Thin Aluminum Wheel Grouser Integrity**:
  * Models Curiosity's actual historical wheel damage on sharp Martian ventifacts.
  * 12 jagged basaltic rock hazards are scattered across Yellowknife Bay. Colliding with rocks at speed ($>2.0\,\text{m/s}$) punctures the $0.75\,\text{mm}$ aluminum skin.
  * Wheel damage produces persistent lateral steering drift (pulling toward the damaged wheel) and reduces maximum speed by up to 55%.
* **Regolith Dust Trail (`DustTrail.tsx`)**: Emits low-poly cel-shaded Martian dust puffs behind the 6 wheels proportional to vehicle speed and turning angle.

---

### 3. ChemCam 1064nm Pulsed LIBS Laser & Science (`ScienceMechanics.tsx`)
* **Laser-Induced Breakdown Spectroscopy**: When Curiosity approaches within $7.0\,\text{meters}$ of the *John Klein* lacustrine mudstone outcrop, the mast targets the target rock spot.
* **Laser Pulse Vaporization**: Pressing `[SPACE]` fires a focused $1064\,\text{nm}$ pulsed beam, vaporizing a micro-spot on the rock and generating high-temperature glowing plasma sparks.
* **Atomic Emission Spectrometer**: Each successful laser pulse collects optical emission spectra, progressively identifying elemental markers:
  * **Hydrogen (H)** at $656\,\text{nm}$ (indicating hydrated clay minerals).
  * **Silicon (Si)** at $288\,\text{nm}$ (silicate mudstone matrix).
  * **Iron (Fe)** at $404\,\text{nm}$ (ferric oxides).
  * **Magnesium (Mg)** at $518\,\text{nm}$ (magnesium sulfates).
* **Audio Transients**: Web Audio API synthesized laser snap transients accompanied by resonant harmonic chimes upon unlocking each element.

---

### 4. Picture-in-Picture (PiP) Historical Optical Sensor (`OpticalSensorPiP.tsx`)
* **Mast-Mounted Secondary Camera**: Attaches a `THREE.PerspectiveCamera` (`fov={38}`) directly to Curiosity's Remote Sensing Mast (ChemCam head). The camera pans, pitches with the rover's chassis, and vibrates with driving engine harmonics.
* **Dual Viewport WebGL Scissor Pipeline**: Renders offscreen to an FBO, applies era post-processing shaders via a fullscreen quad, and blits into the docked $360 \times 260\,\text{px}$ HUD window via `renderer.setViewport` and `renderer.setScissor`.
* **Cross-DPR Parity**: Correctly computes CSS viewport offsets, ensuring perfect HUD alignment across $80\%$, $100\%$, $125\%$, and $150\%$ browser zoom levels on high-DPI displays.
* **Era-Reactive Sensor Presets**:
  * `[1] 1967 VIDICON TUBE`: Analog CRT curvature, 2-bit monochrome phosphor palette with $4 \times 4$ Bayer dithering, scanlines, and a 2-second ghosting wipe.
  * `[2] 1997 CCD BUMPER CAM`: Barrel distortion, $160 \times 120$ quantized pixel grid, 16-bit RGB565 color quantization, sensor noise, and green NASA telemetry brackets.
  * `[3] 2012 CHEMCAM LIBS TELESCOPE`: Thermal false-color highlights on mudstone targets, plasma flash bloom upon laser fire, telephoto vignette, and cyan fiducial crosshairs (`+`) with concentric rangefinder rings.

---

### 5. Flight Director 2D HUD & Telemetry Oscilloscope (`MissionHUD.tsx`)
* **2-Minute MRO Orbital Countdown**: Simulates the fleeting communications pass of the Mars Reconnaissance Orbiter flying overhead.
* **Four Mission Phases**:
  1. `EXPLORING`: Traverse Gale Crater, avoid tire-puncturing rocks, and navigate to Yellowknife Bay.
  2. `LASER_TARGETING`: Engage ChemCam telescope, acquire John Klein mudstone target, and fire 30 laser pulses to capture atomic spectra.
  3. `ANTENNA_ALIGN`: High-Gain Antenna (HGA) gimbal mini-game aligning azimuth ($0^\circ - 360^\circ$) and elevation ($0^\circ - 90^\circ$) to lock with the orbiter.
  4. `SOUL_TRANSFER_COMPLETE`: The camera pulls upward as a swirling particle beam ascends from Curiosity into space, uplinking its mission data before the relay window closes.
* **Real-Time Telemetry Oscilloscope**: A custom 60fps HTML5 Canvas oscilloscope displaying live rolling waveforms:
  * **MMRTG Core Temperature** (Amber curve: $180^\circ\text{C} - 240^\circ\text{C}$).
  * **ChemCam Capacitor Charge** (Cyan curve: $0\% - 100\%$).
  * **Aluminum Wheel Integrity** (Emerald curve: $0\% - 100\%$).

---

## User Controls & Hotkeys

| Input | Action | System / Effect |
| :--- | :--- | :--- |
| **`W` / `↑`** | **Forward Throttle** | Accelerates rover forward ($5.5\,\text{m/s}$ nominal) |
| **`S` / `↓`** | **Reverse Throttle** | Drives backward with reverse steering |
| **`A` / `←`** | **Steer Left** | Turns front wheels left; counter-steers rear wheels |
| **`D` / `→`** | **Steer Right** | Turns front wheels right; counter-steers rear wheels |
| **`Shift`** | **High-Gear Boost** | Boosts forward speed up to $9.5\,\text{m/s}$ (increases MMRTG heat) |
| **`Space`** | **Brake / ChemCam Fire** | In driving mode: hydraulic brake. In targeting mode: fires 1064nm laser |
| **`1`** | **1967 Vidicon Preset** | Switches PiP feed to analog 2-bit Vidicon phosphor tube |
| **`2`** | **1997 CCD Preset** | Switches PiP feed to 16-bit RGB565 Sojourner bumper cam |
| **`3`** | **2012 ChemCam Preset** | Switches PiP feed to modern ChemCam telescope with cyan reticle |
| **`C`** | **Toggle Telescope Zoom** | Switches between 3rd-person drone chase cam and ChemCam telescope |
| **`R`** | **Mission Reset** | Resets rover position, timer, spectrometer data, and wheel integrity |

---

## Project Structure

```
e:\Nasa\Visual\
├── index.html                           # HTML5 mount point with NASA JetBrains Mono typography
├── package.json                         # Dependencies and build scripts
├── tsconfig.json                        # Strict TypeScript compiler options
├── vite.config.ts                       # Vite bundler configuration
├── convert_stl_dem.py                   # Step 0B: Mars Trek STL to 256x256 DEM heightmap script
├── raw_assets/
│   └── trekSTL.stl                      # NASA Mars Trek Gale Crater 3D surface mesh
├── public/
│   ├── terrains/
│   │   ├── gale_crater_dem.png          # Normalized 8-bit DEM elevation heightmap
│   │   ├── gale_crater_texture.png      # 1024x1024 hypsometric elevation texture with contours
│   │   └── gale_crater_normal.png       # 1024x1024 surface relief tangent normal map
│   └── models/
│       └── curiosity.glb                # NASA Curiosity Rover 3D model
└── src/
    ├── main.tsx                         # React 18 DOM mount point
    ├── App.tsx                          # App orchestrator & layout container
    ├── index.css                        # Tailwind CSS styles & scanline animations
    ├── store/
    │   └── useMissionStore.ts           # Zustand store (kinematics, MMRTG, wheels, mission phases)
    ├── utils/
    │   ├── celShading.ts                # 4-band DataTexture LUT generator & material hierarchy traverser
    │   ├── terrainMath.ts               # Bilinear DEM height sampling & 4-point suspension kinematics
    │   ├── galeCraterDemData.ts         # Pre-baked 256x256 elevation array extracted from trekSTL.stl
    │   ├── soundEngine.ts               # Web Audio API synthesizer (drive humming, laser snaps, chimes)
    │   └── terrainSampler.ts            # Procedural fallback terrain generator
    └── components/
        ├── GaleCraterTerrain.tsx        # 160x160 Martian ground mesh displaced by DEM + rock hazards
        ├── CuriosityRover.tsx           # Rocker-bogie kinematics, MMRTG thermals, wheel damage
        ├── ScienceMechanics.tsx         # ChemCam 1064nm laser, plasma sparks, soul-transfer beam
        ├── OpticalSensorPiP.tsx         # Mast camera renderer & era post-processing PiP HUD window
        ├── MissionHUD.tsx               # Flight Director HUD, 60fps Oscilloscope, Spectrometer, MRO timer
        └── canvas/
            ├── RoverScene.tsx           # Primary 3D Canvas, Lighting, Camera Director, and Landing Pad
            ├── LightingAndAtmosphere.tsx# Sun lighting, ambient rim lights, and Martian atmospheric fog
            └── DustTrail.tsx            # Regolith particle dust trails behind wheels
```

---

## Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) v18.0.0 or higher
* Python 3.8+ with `numpy` and `Pillow` (for the optional Step 0B DEM bake pipeline)

### Installation & Local Development

```bash
# Clone the repository
git clone https://github.com/Aravinda-05/Visual-Testing.git
cd Visual-Testing

# Install dependencies
npm install

# Start local development server
npm run dev
```

The application will be running at `http://localhost:5173`.

### Running the Step 0B DEM Pipeline
To regenerate the DEM heightmap and textures from the raw Mars Trek `.stl` file:

```bash
python convert_stl_dem.py
```

### Production Build

```bash
npm run build
npm run preview
```

---

## Technical Stack & Libraries

* **Framework**: React 18 + Vite 5 + TypeScript 5
* **3D Graphics Engine**: Three.js (r169)
* **React 3D Ecosystem**: `@react-three/fiber` (v8) + `@react-three/drei` (v9)
* **State Management**: `zustand` (v5)
* **Audio Synthesis**: Native Web Audio API (procedural brown noise, square wave transients, pentatonic chimes)
* **Icons & UI**: `lucide-react`
* **Styling**: Tailwind CSS (v3) + Google Fonts (*JetBrains Mono*)

---

## License

MIT License. Designed for NASA JPL visual style feasibility and WebGL planetary simulation research.
