import * as THREE from 'three';

/**
 * Deterministic multi-octave trigonometric noise function simulating Martian crater geology,
 * scree slopes, and impact ridges.
 *
 * Guarantees a perfectly leveled, flat landing pad (elevation = 0.00) in the central zone
 * (radius < 4.2m) so the planetary rover's 6 wheels touch down firmly with ZERO floating.
 */
export function sampleMartianElevation(x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z);
  const padRadius = 4.2;
  const blendRadius = 9.0;
  const craterRadius = 26.0;
  const rimWidth = 12.0;

  // 1. Crater Rim: Elevated crest surrounding the basin at r ~ 26m
  const delta = dist - craterRadius;
  const rimElevation = 5.2 * Math.exp(-Math.pow(delta / (rimWidth * 0.7), 2));

  // Geological terrace steps around crater lip
  const terrace = Math.sin(delta * 0.45) * 0.35 * Math.exp(-Math.abs(delta) * 0.08);

  // 2. Large Scale Martian Dune Waves (Octave 1)
  const wave1 =
    Math.sin(x * 0.035 + z * 0.02) *
    Math.cos(z * 0.03 - x * 0.015) *
    2.8;

  // 3. Medium Ridges & Fractured Bedrock (Octave 2, rotated coordinate frame)
  const angle = 0.62;
  const rx = x * Math.cos(angle) - z * Math.sin(angle);
  const rz = x * Math.sin(angle) + z * Math.cos(angle);
  const wave2 =
    Math.sin(rx * 0.08) *
    Math.cos(rz * 0.07) *
    1.2;

  // 4. Rocky Scree & Boulders (Octave 3, absolute fold noise)
  const sharpRock =
    Math.abs(Math.sin(x * 0.18 + z * 0.14)) *
    Math.cos(z * 0.16 - x * 0.12) *
    0.65;

  // 5. High-Frequency Micro-Chipping for Crisp Faceting (Octave 4)
  const microFacet =
    (Math.sin(x * 0.42) * Math.cos(z * 0.38) +
      Math.sin(x * 0.7 - z * 0.5)) *
    0.22;

  // 6. Smooth Landing Pad Blend:
  // Exactly 0.00 within padRadius (under rover chassis and wheels),
  // smoothly ramping up using cubic Hermite smoothstep towards the natural Martian geology.
  let padWeight = 1.0;
  if (dist <= padRadius) {
    padWeight = 0.0;
  } else if (dist < blendRadius) {
    const t = (dist - padRadius) / (blendRadius - padRadius);
    padWeight = t * t * (3 - 2 * t);
  }

  const naturalTerrain =
    rimElevation + terrace + wave1 + wave2 + sharpRock + microFacet;

  return naturalTerrain * padWeight;
}

/**
 * Procedurally displaces a PlaneGeometry in-place to construct the faceted Martian basin,
 * then converts it to a non-indexed BufferGeometry so every facet has crisp face normals.
 */
export function generateFacetedMarsTerrain(baseGeo: THREE.PlaneGeometry): THREE.BufferGeometry {
  const posAttr = baseGeo.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < posAttr.count; i++) {
    vertex.fromBufferAttribute(posAttr, i);

    // PlaneGeometry in local coordinates has X and Y; Z is displacement
    // In three.js, when rotated by -Math.PI / 2, local Y maps to -world Z, and local Z maps to +world Y
    const worldX = vertex.x;
    const worldZ = -vertex.y;

    const elevation = sampleMartianElevation(worldX, worldZ);
    posAttr.setZ(i, elevation);
  }

  posAttr.needsUpdate = true;

  // Convert to non-indexed geometry so each triangle facet has unique vertices and distinct face normals
  const facetedGeo = baseGeo.toNonIndexed();
  facetedGeo.computeVertexNormals();
  return facetedGeo;
}
