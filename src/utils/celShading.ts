import * as THREE from 'three';

/**
 * Creates a singleton 4x1 DataTexture for 4-band hard-edged Moebius Cel-Shading.
 * Values:
 *  - Step 1 (0-25% light): deep ink shadow (40)
 *  - Step 2 (25-50% light): mid core shadow (105)
 *  - Step 3 (50-75% light): illuminated surface (185)
 *  - Step 4 (75-100% light): peak specular highlight (255)
 */
let cachedGradientMap: THREE.DataTexture | null = null;

export function getFourStepGradientMap(): THREE.DataTexture {
  if (cachedGradientMap) return cachedGradientMap;

  // 4 discrete luminance steps
  const steps = new Uint8Array([40, 105, 185, 255]);
  
  // THREE.RedFormat is the modern standard for 1-channel textures in WebGL2
  const texture = new THREE.DataTexture(steps, 4, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  cachedGradientMap = texture;
  return texture;
}

/**
 * Traverses any Object3D hierarchy and converts all mesh materials to
 * THREE.MeshToonMaterial with the provided 4-band gradient map.
 * Preserves original diffuse colors, textures, and transparency.
 */
export function applyCelShadingToHierarchy(
  root: THREE.Object3D,
  gradientMap: THREE.Texture = getFourStepGradientMap()
): void {
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const sourceMat = Array.isArray(mesh.material)
        ? mesh.material[0]
        : mesh.material;

      if (!sourceMat) return;

      // Extract original properties if available
      let baseColor = new THREE.Color(0xd1d5db); // default neutral metal
      let baseMap: THREE.Texture | null = null;
      let opacity = 1.0;
      let transparent = false;
      let wireframe = false;

      if ('color' in sourceMat && sourceMat.color instanceof THREE.Color) {
        baseColor = sourceMat.color.clone();
      }
      if ('map' in sourceMat && (sourceMat as THREE.MeshStandardMaterial).map) {
        baseMap = (sourceMat as THREE.MeshStandardMaterial).map;
      }
      if ('opacity' in sourceMat) {
        opacity = sourceMat.opacity;
      }
      if ('transparent' in sourceMat) {
        transparent = sourceMat.transparent;
      }
      if ('wireframe' in sourceMat) {
        wireframe = (sourceMat as THREE.MeshBasicMaterial).wireframe;
      }

      // Construct high-contrast toon material
      const toonMat = new THREE.MeshToonMaterial({
        color: baseColor,
        map: baseMap,
        gradientMap: gradientMap,
        transparent: transparent,
        opacity: opacity,
        wireframe: wireframe,
      });

      mesh.material = toonMat;
    }
  });
}

