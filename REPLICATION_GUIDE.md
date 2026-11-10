# Autonomous Planetary Sandbox Replication Playbook
### Step-by-Step Architecture Guide for AI Agents and Developers
**Build Any Planetary Rover / Vehicle Simulation with Any Map & Model in Three.js / React Three Fiber**

---

## Executive Summary & Purpose

This document provides a complete, deterministic, step-by-step engineering blueprint to build and replicate a high-performance, web-based planetary exploration vertical slice. 

By following this playbook, an autonomous AI agent or software engineer can swap in **any 3D vehicle model** (e.g., Perseverance, Curiosity, Apollo Lunar Roving Vehicle, Dragonfly, or custom sci-fi rover) and **any planetary terrain** (e.g., Gale Crater, Jezero Crater, Moon South Pole, Olympus Mons) with guaranteed:
1. **Zero wheel clipping and zero floating** on complex topographical relief.
2. **Rock-solid camera tracking** with zero rubberbanding or distance-stretching.
3. **Dual-mode camera system** (Tactical 3rd-person follow + 360° Free Roam Orbit + mouse-wheel zooming).
4. **Interactive 3D Subsystem Hotspot Codex** with occlusion handling (no broken connector lines).
5. **Stable 60 FPS performance** by eliminating React re-render thrashing and multi-pass overdraw.

```
+---------------------------------------------------------------------------------------------------+
|                                     PIPELINE ARCHITECTURE                                         |
|                                                                                                   |
|  [NASA Trek STL / DEM]                                    [3D Model (GLTF / GLB)]                 |
|            |                                                         |                            |
|            v                                                         v                            |
|  convert_stl_dem.py (Baseplate strip, 256x256 grid)        Draco Decoded Mesh Hierarchy           |
|            |                                                         |                            |
|            +------------+------------+                               v                            |
|            |                         |                     Wheelbase & Trackwidth Alignment       |
|            v                         v                     (Origin at ground contact & center)    |
|   galeCraterDemData.ts     PlaneGeometry (96x96)                     |                            |
|   getTerrainHeight(x, z)   receiveShadow only                        v                            |
|            |                         |                     Cel-Shading Traversal (4-band LUT)     |
|            +------------+------------+                               |                            |
|                         |                                            |                            |
|                         v                                            v                            |
|        ===========================================================================                |
|                               60 FPS PHYSICAL SIMULATION LOOP                                    |
|         - 4/6-Wheel Terrain Probes -> Inverted Pitch Angle (-atan2) & Roll                        |
|         - Chassis Center Height = Arithmetic Mean of Contact Points                               |
|         - Live Kinematics Stored on Scene Graph (CuriosityRoverRoot.userData)                     |
|         - Zustand HUD State Throttled to 10 Hz (Zero React Re-render Thrashing)                   |
|        ===========================================================================                |
|                         |                                            |                            |
|                         v                                            v                            |
|        [Direct Scene Camera Director]              [Interactive 3D Subsystem Pins]                |
|        - Rigid Horizontal Translation Locking       - Dynamic Node Binding                        |
|        - Elevated 32° Downward Pitch Angle          - Multi-Stage DOM Occlusion Guard             |
|        - Mouse-Wheel Zoom (6m - 35m)                - Docked Cassette-Futurism HUD Card           |
+---------------------------------------------------------------------------------------------------+
```

---

## Phase 1: Terrain Pipeline (NASA Trek STL / DEM to WebGL Heightmap)

### 1.1 Acquiring Topographical Data
Genuine planetary elevation data can be obtained from:
* **NASA Mars Trek**: [trek.nasa.gov/mars](https://trek.nasa.gov/mars/) (Select region $\to$ Tools $\to$ 3D Print $\to$ Download `.stl`).
* **NASA Moon Trek**: [trek.nasa.gov/moon](https://trek.nasa.gov/moon/) (Apollo landing sites, Shackleton Crater).
* **USGS Astrogeology**: High-resolution HiRISE / MOLA Digital Elevation Models (GeoTIFF / DEM).

Save the raw file as `./raw_assets/trekSTL.stl` (or workspace root).

### 1.2 Automated Python Extraction Pipeline (`convert_stl_dem.py`)
Standard 3D-printing STL files from NASA Trek contain a **thick rectangular pedestal/baseplate** that must be stripped so only the natural planetary surface remains.

The extraction script performs four critical operations:
1. **Parses Binary / ASCII STL:** Reads triangles using `numpy` and `struct`.
2. **Filters the Baseplate:** Measures the minimum $Z$ and strips out all vertices where $z \le z_{\min} + \epsilon$ (flat pedestal).
3. **Rasterizes onto a 2D Grid:** Projects $(X, Y)$ onto a $256 \times 256$ grid recording maximum elevation, fills interior voids using nearest-neighbor interpolation, and applies a $1\,\text{px}$ Gaussian blur (`PIL.ImageFilter.GaussianBlur(radius=1)`) to remove 8-bit quantization stair-stepping.
4. **Outputs Grayscale DEM and Normal Map:**
   * `public/terrains/dem.png`: 8-bit grayscale normalized heightmap.
   * `public/terrains/normal.png`: Tangent-space normal map computed from Sobel gradient operators ($\Delta x, \Delta y$).
   * `src/utils/galeCraterDemData.ts`: A compressed, base64-encoded `Uint8Array` of the $256 \times 256$ elevation grid so height sampling can run synchronously in the browser with **0ms fetch delay**.

#### Reference Python Script:
```python
import struct, numpy as np
from PIL import Image, ImageFilter

def convert_stl_to_dem(stl_path, dem_out_png, grid_size=256, elevation_range_m=14.0):
    with open(stl_path, 'rb') as f:
        header = f.read(80)
        tri_count = struct.unpack('<I', f.read(4))[0]
        # Read 50 bytes per triangle: 12 normal + 36 vertices + 2 attr
        raw = np.frombuffer(f.read(tri_count * 50), dtype=np.uint8)
        
    records = raw.reshape(-1, 50)[:, 12:48].copy()
    vertices = np.frombuffer(records.tobytes(), dtype=np.float32).reshape(-1, 3)
    
    # Strip baseplate (lowest 5% Z)
    z_min, z_max = vertices[:, 2].min(), vertices[:, 2].max()
    terrain_verts = vertices[vertices[:, 2] > (z_min + 0.05 * (z_max - z_min))]
    
    # Grid rasterization
    xs, ys, zs = terrain_verts[:, 0], terrain_verts[:, 1], terrain_verts[:, 2]
    u = np.clip(((xs - xs.min()) / (xs.max() - xs.min()) * (grid_size - 1)).astype(int), 0, grid_size - 1)
    v = np.clip(((ys - ys.min()) / (ys.max() - ys.min()) * (grid_size - 1)).astype(int), 0, grid_size - 1)
    
    grid = np.full((grid_size, grid_size), -np.inf)
    for i in range(len(zs)):
        if zs[i] > grid[v[i], u[i]]:
            grid[v[i], u[i]] = zs[i]
            
    # Void fill and 0-255 normalization
    valid = np.isfinite(grid)
    grid[~valid] = np.mean(grid[valid])
    norm = ((grid - grid.min()) / (grid.max() - grid.min()) * 255.0).astype(np.uint8)
    
    img = Image.fromarray(norm).filter(ImageFilter.GaussianBlur(radius=1.0))
    img.save(dem_out_png)
```

### 1.3 Kinematic Height Sampler (`terrainMath.ts`)
Both visual 3D plane vertices and vehicle physics **must sample the exact same mathematical elevation function**:

```typescript
export function getTerrainHeight(x: number, z: number, bounds = 200.0): number {
  // 1. World coordinates [-bounds/2, bounds/2] -> UV [0, 1]
  const u = (x + bounds / 2) / bounds;
  const v = (z + bounds / 2) / bounds;
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;

  // 2. Bilinear interpolation across baked 256x256 grid
  const fx = u * 255, fy = v * 255;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, 255), y1 = Math.min(y0 + 1, 255);
  const dx = fx - x0, dy = fy - y0;

  const v00 = demGrid[y0 * 256 + x0];
  const v10 = demGrid[y0 * 256 + x1];
  const v01 = demGrid[y1 * 256 + x0];
  const v11 = demGrid[y1 * 256 + x1];

  const rawByte = (v00 * (1 - dx) + v10 * dx) * (1 - dy) + (v01 * (1 - dx) + v11 * dx) * dy;

  // 3. Normalize origin touchdown point (u=0.5, v=0.5) to exactly Y = 0.00m
  const originByte = 171.0; 
  const verticalScaleMeters = 14.0;
  return ((rawByte - originByte) / 255.0) * verticalScaleMeters;
}
```

### 1.4 Terrain Mesh Rendering & GPU Optimization
* **Avoid `toNonIndexed()` with High Subdivisions:** If using flat shading, keep subdivisions reasonable ($96 \times 96$ quads = $\approx 18,000$ triangles).
* **Crucial Shadow Rule:** Set `<mesh receiveShadow geometry={terrainGeo} material={terrainMat} />`. **NEVER** set `castShadow={true}` on planetary ground meshes! Doing so forces the GPU to rasterize 60,000+ ground vertices into the shadow map on every frame.

---

## Phase 2: 3D Vehicle Model Ingestion & Alignment

When loading any GLTF/GLB vehicle model into Three.js, you cannot rely on its default origin because 3D artists frequently place the pivot at the cockpit, bounding box center, or ground pedestal. Furthermore, robotic arms and tall mast cameras skew the global bounding box center forward or upward.

### 2.1 The Wheelbase Bounding Box Alignment Formula
To guarantee that pitch, roll, and elevation calculations match the 3D model, the model must be centered **by its wheels**, not by its entire geometry:

```typescript
function GLTFVehicleModel() {
  const { scene } = useGLTF('/models/rover.glb');

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    applyCelShadingToHierarchy(clone);

    // 1. Identify all wheel assembly nodes
    const wheelNames = ['wheel_01_L', 'wheel_02_L', 'wheel_03_L', 'wheel_01_R', 'wheel_02_R', 'wheel_03_R'];
    const wheelsBox = new THREE.Box3();
    let hasWheels = false;

    wheelNames.forEach((name) => {
      const w = clone.getObjectByName(name);
      if (w) {
        w.updateWorldMatrix(true, true);
        wheelsBox.union(new THREE.Box3().setFromObject(w));
        hasWheels = true;
      }
    });

    if (hasWheels && !wheelsBox.isEmpty()) {
      const wheelCenter = new THREE.Vector3();
      wheelsBox.getCenter(wheelCenter);

      // Center clone so that:
      // X = 0: exact lateral trackwidth centerline
      // Y = 0: exact ground contact point (bottom of lowest wheel)
      // Z = 0: exact longitudinal wheelbase midpoint
      clone.position.x = -wheelCenter.x;
      clone.position.y = -wheelsBox.min.y;
      clone.position.z = -wheelCenter.z;
    }
    return clone;
  }, [scene]);

  return <primitive object={clonedScene} castShadow receiveShadow />;
}
```

### 2.2 Cel-Shading & Graphic Novel Shaders (`celShading.ts`)
To apply Moebius / comic-book styling to any GLTF hierarchy:
1. Create a $4 \times 1$ `THREE.DataTexture` containing 4 discrete byte values `[40, 105, 185, 255]`.
2. Traverse the GLTF hierarchy and convert standard PBR materials to `THREE.MeshToonMaterial({ gradientMap, map: originalTexture, color: originalColor })`.

---

## Phase 3: Real-Time Vehicle Physics & Suspension Kinematics

### 3.1 4-Corner / 6-Wheel Terrain Probes
In `CuriosityRover.tsx` (or your vehicle component), define the half-wheelbase ($L/2$) and half-trackwidth ($W/2$):

```typescript
const halfWheelbase = 1.10;  // Half distance from front axle to rear axle
const halfTrackwidth = 1.05; // Half distance from left wheels to right wheels

// Forward and Right vectors from live Yaw heading
const fwdX = Math.sin(yaw.current);
const fwdZ = Math.cos(yaw.current);
const rightX = Math.cos(yaw.current);
const rightZ = -Math.sin(yaw.current);

// 4 Outer Corner Elevation Probes
const yFL = getTerrainHeight(pos.x + fwdX * halfWheelbase - rightX * halfTrackwidth, pos.z + fwdZ * halfWheelbase - rightZ * halfTrackwidth);
const yFR = getTerrainHeight(pos.x + fwdX * halfWheelbase + rightX * halfTrackwidth, pos.z + fwdZ * halfWheelbase + rightZ * halfTrackwidth);
const yRL = getTerrainHeight(pos.x - fwdX * halfWheelbase - rightX * halfTrackwidth, pos.z - fwdZ * halfWheelbase - rightZ * halfTrackwidth);
const yRR = getTerrainHeight(pos.x - fwdX * halfWheelbase + rightX * halfTrackwidth, pos.z - fwdZ * halfWheelbase + rightZ * halfTrackwidth);
```

### 3.2 The Critical Pitch & Roll Sign Rules
> [!CAUTION]
> In Three.js's right-handed `'YXZ'` Euler space:
> * Rotating by **positive pitch around the X-axis tilts the front ($+Z$) DOWN**.
> * When driving uphill, $y_{\text{front}} > y_{\text{rear}}$, which requires the front to tilt **UP**.
> * Therefore, pitch **MUST USE A NEGATIVE SIGN**:
>   $$\text{targetPitch} = -\text{atan2}(y_{\text{front}} - y_{\text{rear}}, 2 \times \text{halfWheelbase})$$
> * A positive roll tilts the right side ($+X$) **UP**:
>   $$\text{targetRoll} = \text{atan2}(y_{\text{right}} - y_{\text{left}}, 2 \times \text{halfTrackwidth})$$

### 3.3 Zero-Floating Ground Contact Formula
> [!IMPORTANT]
> Never add artificial offsets like `max(yFL, yFR, yRL, yRR) + pitchDrop`! When an object is rotated around its wheelbase midpoint $(Z=0)$, the front rotates up by $\sin(\theta) \times L/2$ and the rear rotates down by $\sin(\theta) \times L/2$.
> 
> The chassis center height is simply the **arithmetic mean of the contact points**:
> $$\text{targetY} = \frac{y_{\text{FL}} + y_{\text{FR}} + y_{\text{RL}} + y_{\text{RR}}}{4}$$

```typescript
const yFront = (yFL + yFR) * 0.5;
const yRear = (yRL + yRR) * 0.5;
const yLeft = (yFL + yRL) * 0.5;
const yRight = (yFR + yRR) * 0.5;

const targetPitch = -Math.atan2(yFront - yRear, halfWheelbase * 2);
const targetRoll = Math.atan2(yRight - yLeft, halfTrackwidth * 2);

pitch.current = THREE.MathUtils.damp(pitch.current, targetPitch, 9.0, dt);
roll.current = THREE.MathUtils.damp(roll.current, targetRoll, 9.0, dt);

const targetY = (yFL + yFR + yRL + yRR) * 0.25;
pos.current.y = THREE.MathUtils.damp(pos.current.y, targetY, 15.0, dt);

// Apply directly to Three.js Object3D
roverGroupRef.current.position.set(pos.current.x, pos.current.y, pos.current.z);
roverGroupRef.current.rotation.set(pitch.current, yaw.current, roll.current, 'YXZ');
```

---

## Phase 4: Camera System & Performance Architecture

### 4.1 Eliminating Camera Rubberbanding
**The Bug:** In React Three Fiber, reading vehicle position via React state (`useMissionStore((s) => s.roverPos)`) inside `CameraDirector` causes severe rubberbanding. React batches and throttles component renders asynchronously, so the vehicle mesh moves ahead for several frames while the camera reads stale state. When React flushes, the camera violently snaps forward.

**The Solution (Direct Scene Graph Tracking):**
1. Name the vehicle root group `<group ref={roverGroupRef} name="CuriosityRoverRoot">`.
2. Inside `CameraDirector`'s `useFrame`, read the live transform directly from the scene graph:
```typescript
const roverObj = state.scene.getObjectByName('CuriosityRoverRoot');
if (!roverObj) return;
const rPos = roverObj.position;
const rYaw = roverObj.rotation.y;
```
3. **Rigid Translation Anchoring:** Lock the camera's horizontal offset directly to the vehicle's translation. Smooth **only** the yaw orientation (turning around corners) and vertical bumps:
```typescript
// Smooth yaw orientation with shortest-arc wrapping
let diff = (rYaw - cameraYaw.current) % (Math.PI * 2);
if (diff < -Math.PI) diff += Math.PI * 2;
if (diff > Math.PI) diff -= Math.PI * 2;
cameraYaw.current += diff * Math.min(1.0, 5.0 * dt);

// Direct translation anchoring (Zero distance stretching!)
const dist = followDistance.current; // e.g. 16.0m
const chaseHeight = dist * 0.48 + 2.4; // elevated 32° tactical downward view

const camFwdX = Math.sin(cameraYaw.current);
const camFwdZ = Math.cos(cameraYaw.current);

const targetCamX = rPos.x - camFwdX * dist;
const targetCamZ = rPos.z - camFwdZ * dist;

camY.current = THREE.MathUtils.damp(camY.current, rPos.y + chaseHeight, 10.0, dt);
camera.position.set(targetCamX, camY.current, targetCamZ);
camera.lookAt(rPos.x, rPos.y + 0.8, rPos.z);
```

### 4.2 Seamless Free Roam Orbit Integration
When switching to `FREE_ORBIT` mode:
* Enable Drei `<OrbitControls ref={controlsRef} enabled={cameraMode === 'FREE_ORBIT'} enableDamping={false} />`.
* In `useFrame`, track the delta movement of the rover:
```typescript
if (cameraMode === 'FREE_ORBIT') {
  const deltaX = rPos.x - prevRoverPos.current.x;
  const deltaY = rPos.y - prevRoverPos.current.y;
  const deltaZ = rPos.z - prevRoverPos.current.z;

  camera.position.x += deltaX;
  camera.position.y += deltaY;
  camera.position.z += deltaZ;

  if (controlsRef.current) {
    controlsRef.current.target.set(rPos.x, rPos.y + 0.9, rPos.z);
    controlsRef.current.update();
  }
  prevRoverPos.current.copy(rPos);
  return;
}
```

### 4.3 Mouse-Wheel Zoom Across All Camera Modes
Attach a window `wheel` listener inside `CameraDirector`:
```typescript
useEffect(() => {
  const handleWheel = (e: WheelEvent) => {
    if (useMissionStore.getState().cameraMode === 'THIRD_PERSON_DRONE') {
      const delta = e.deltaY * 0.008;
      followDistance.current = THREE.MathUtils.clamp(followDistance.current + delta, 6.0, 35.0);
    }
  };
  window.addEventListener('wheel', handleWheel, { passive: true });
  return () => window.removeEventListener('wheel', handleWheel);
}, []);
```

---

## Phase 5: Interactive 3D Subsystem Hotspot Inspection

### 5.1 Hotspot Configuration Data (`src/data/curiosityHotspots.ts`)
Define hardware subsystems with their target mesh node names in the GLTF model:
```typescript
export interface SubsystemHotspot {
  id: string;
  title: string;
  nodeName: string;            // Exact node name in GLTF hierarchy
  fallbackNodeNames?: string[];
  heightOffset?: number;
  specs: { label: string; value: string }[];
  description: string;
  funFact: string;
}
```

### 5.2 Dynamic 3D Pin Binding
Pins render inside the vehicle group and bind to live mesh world positions:
```typescript
useFrame(() => {
  if (!pinRef.current?.parent) return;
  const roverRoot = pinRef.current.parent;
  const targetObj = roverRoot.getObjectByName(spot.nodeName);
  if (targetObj) {
    const worldPos = new THREE.Vector3();
    targetObj.getWorldPosition(worldPos);
    worldPos.y += spot.heightOffset || 0.10;
    const localPos = roverRoot.worldToLocal(worldPos);
    setPinPos([localPos.x, localPos.y, localPos.z]);
  }
});
```

### 5.3 Fixing the "Top-Left Screen Snap" Occlusion Bug
**The Bug:** When a hotspot rotates behind the vehicle, `@react-three/drei`'s `<Html occlude>` sets `display: none` or `opacity: 0`. Calling `getBoundingClientRect()` on an element with `display: none` returns `(0, 0)`. The SVG circuit line draws from the docked card directly to `(0, 0)` in the top-left corner.

**The Solution:** In the `requestAnimationFrame` line tracker, inspect visibility before setting line coordinates:
```typescript
const isCollapsed = pinRect.width < 1 || pinRect.height < 1 || (pX <= 6 && pY <= 6);
const isDetached = pinElem.offsetParent === null;
let isStyleHidden = false;

let curr: HTMLElement | null = pinElem;
while (curr && curr !== document.body) {
  const style = window.getComputedStyle(curr);
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') < 0.1) {
    isStyleHidden = true;
    break;
  }
  curr = curr.parentElement;
}

const isVisible = !isCollapsed && !isDetached && !isStyleHidden &&
  pX >= 10 && pX <= window.innerWidth - 10 &&
  pY >= 10 && pY <= window.innerHeight - 10;

setLineCoords({ x1: cX, y1: cY, x2: pX, y2: pY, visible: isVisible });
```

---

## Phase 6: Secondary Sensor Picture-in-Picture (PiP)

### 6.1 Mast-Mounted Secondary PerspectiveCamera
Create a secondary camera in Three.js mounted to the vehicle's sensor mast:
```typescript
const mastCamera = useMemo(() => new THREE.PerspectiveCamera(38, 360 / 260, 0.1, 500), []);
const fbo = useFBO(360, 260, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
```

### 6.2 Viewport & Scissor Telemetry Sub-Rendering
Inside `useFrame`:
1. **Throttle FBO Render:** Render the secondary camera every 2nd or 3rd frame (`if (frame % 2 === 0)`). This cuts off-screen scene draw calls by 50%.
2. **Take Over Render Priority (`useFrame(..., 1)`):** Prevent R3F from executing a redundant main-camera render.
3. **Scissor to DOM element:**
```typescript
const rect = pipDomElement.getBoundingClientRect();
gl.setScissorTest(true);
gl.setViewport(rect.left, canvasRect.bottom - rect.bottom, rect.width, rect.height);
gl.setScissor(rect.left, canvasRect.bottom - rect.bottom, rect.width, rect.height);
gl.render(pipPostProcessingScene, orthoCamera);
gl.setScissorTest(false);
```

---

## Phase 7: The 60 FPS Performance Checklist

If frame rate drops below 50–60 FPS on any hardware, check these five root causes:

| Bottleneck | Cause | Immediate Fix |
| :--- | :--- | :--- |
| **High-DPI 4K Overdraw** | Canvas defaults to 4K resolution on Retina / laptops. | Add `dpr={[1, 1.5]}` to `<Canvas>`. |
| **Shadow Depth Map Overdraw** | Ground terrain set to `castShadow={true}`. | Remove `castShadow` from terrain; set shadow map to $1024 \times 1024$. |
| **React Re-Render Storm** | Calling Zustand `set()` at 60 fps inside `useFrame`. | Attach kinematics to `mesh.userData` and throttle Zustand dispatches to 10 Hz ($100\,\text{ms}$). |
| **Redundant Render Passes** | Multiple cameras rendering the full scene every frame. | Throttle off-screen PiP FBO to alternate frames; pass priority `1` to `useFrame`. |
| **OrbitControls Damping Lag** | `enableDamping={true}` with low damping factor. | Set `enableDamping={false}` when dynamically tracking a moving target. |

---

## Phase 8: AI Agent Execution Checklist for a New Model & Map

When instructed to apply this sandbox to a **new rover** (e.g. `perseverance.glb`) and a **new map** (e.g. `jezero_crater.stl`):

1. **Step 1 (Terrain):** Run `python convert_stl_dem.py` on the new `.stl` file to bake `public/terrains/dem.png` and update `terrainMath.ts`.
2. **Step 2 (Wheel Identification):** Run a script to list node names in the new `.glb`:
   ```bash
   node -e "const fs = require('fs'); const gltf = JSON.parse(fs.readFileSync('model.gltf')); console.log(gltf.nodes.map(n => n.name));"
   ```
3. **Step 3 (Wheelbase Centering):** In `VehicleModel.tsx`, replace `wheelNames` with the new wheel node names so `wheelsBox` centers the model at $(0, 0, 0)$ with $Y=0$ at the bottom of the tires.
4. **Step 4 (Measure Dimensions):** Measure `halfWheelbase` and `halfTrackwidth` from `wheelsBox` and update the probe offsets in the vehicle kinematics component.
5. **Step 5 (Hotspots):** Update `subsystemHotspots.ts` with node names corresponding to the new model's instruments (e.g., PIXL, SHERLOC, SuperCam).
6. **Step 6 (Verify Build):** Run `npm run build` (`tsc && vite build`) to ensure 0 TypeScript compilation errors.

