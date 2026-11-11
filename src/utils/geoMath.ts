/**
 * geoMath.ts - Cartographically Accurate Spherical <-> Cartesian Coordinate Mathematics
 *
 * Implements precise spherical-to-Cartesian and Cartesian-to-spherical conversions matching
 * Three.js SphereGeometry UV parameterization (where 0° Latitude is equator, +90° is North Pole,
 * and 0° Longitude corresponds to U = 0.5 with prime meridian facing front-center).
 */

import * as THREE from 'three';

export interface LatLon {
  lat: number; // degrees [-90, +90] (North > 0, South < 0)
  lon: number; // degrees [-180, +180] or [0, 360] (East > 0, West < 0)
}

/**
 * Converts Geographic Latitude and Longitude to Cartesian 3D World Coordinates
 * on a sphere of specified radius. Matches standard equirectangular Three.js UV wrapping:
 * - phi (polar colatitude): 0 at North Pole (+Y), PI at South Pole (-Y)
 * - theta (azimuthal longitude): 0 at West 180°, PI at 0° Prime Meridian, 2PI at East 180°
 */
export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90.0 - lat) * (Math.PI / 180.0);
  const theta = (lon + 180.0) * (Math.PI / 180.0);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

/**
 * Inverts Cartesian 3D surface coordinate back to Latitude and Longitude (degrees).
 * Used for live raycasted cursor telemetry readouts on planetary globe meshes.
 */
export function vector3ToLatLon(point: THREE.Vector3, _radius = 1.0): LatLon {
  const norm = point.clone().normalize();

  // Colatitude phi in [0, PI]
  const clampedY = THREE.MathUtils.clamp(norm.y, -1.0, 1.0);
  const phi = Math.acos(clampedY);
  const lat = 90.0 - phi * (180.0 / Math.PI);

  // Azimuthal theta in [-PI, PI] from atan2(z, -x)
  // because in latLonToVector3: -x = r*sin(phi)*cos(theta) and z = r*sin(phi)*sin(theta)
  const thetaRad = Math.atan2(norm.z, -norm.x);
  let thetaDeg = thetaRad * (180.0 / Math.PI);

  // Reverse theta = (lon + 180) => lon = theta - 180
  let lon = thetaDeg - 180.0;

  // Normalize lon to [-180, +180] range
  while (lon < -180.0) lon += 360.0;
  while (lon > 180.0) lon -= 360.0;

  return {
    lat: Math.round(lat * 10000) / 10000,
    lon: Math.round(lon * 10000) / 10000,
  };
}

/**
 * Formats Latitude and Longitude into professional NASA mission telemetry strings.
 * E.g., "0.6741° N, 23.4730° E"
 */
export function formatLatLon(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  const absLat = Math.abs(lat).toFixed(4);
  const absLon = Math.abs(lon).toFixed(4);
  return `${absLat}° ${latDir}, ${absLon}° ${lonDir}`;
}

/**
 * Computes great-circle surface distance across a planetary body using the Haversine formula.
 * @param radiusKm - Radius of body in km (Moon = 1737.4 km, Mars = 3389.5 km, Earth = 6371.0 km)
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusKm = 1737.4
): number {
  const toRad = Math.PI / 180.0;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;

  const a =
    Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
    Math.sin(dLon / 2.0) * Math.sin(dLon / 2.0);

  const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
  return radiusKm * c;
}

/**
 * Computes forward azimuth / initial compass bearing in degrees (0° - 360°)
 * from point 1 to point 2 on a planetary surface.
 */
export function calculateBearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = Math.PI / 180.0;
  const toDeg = 180.0 / Math.PI;

  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;
  const deltaLambda = (lon2 - lon1) * toRad;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return (theta * toDeg + 360.0) % 360.0;
}

