import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface DustTrailProps {
  roverPos: [number, number, number];
  speed: number;
  yaw: number;
}

const PARTICLE_COUNT = 60;

export const DustTrail: React.FC<DustTrailProps> = ({ roverPos, speed, yaw }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Store particle states: position, velocity, life (0 to 1), scale
  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, () => ({
      x: 0,
      y: -100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1.0,
      scale: 0.1,
    }));
  }, []);

  const spawnIndex = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const isMoving = Math.abs(speed) > 0.6;
    const dt = Math.min(delta, 0.1);

    // Spawn new dust puff behind left and right rear wheel positions
    if (isMoving) {
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);

      // Offset behind the rover wheels
      const rearDist = -1.6 * Math.sign(speed || 1);
      const sides = [-1.35, 1.35];

      sides.forEach((sideX) => {
        const p = particles[spawnIndex.current % PARTICLE_COUNT];
        spawnIndex.current++;

        // Calculate world position for wheel contact
        const wx = roverPos[0] + (cosY * sideX - sinY * rearDist);
        const wz = roverPos[2] + (sinY * sideX + cosY * rearDist);

        p.x = wx + (Math.random() - 0.5) * 0.3;
        p.y = roverPos[1] - 0.95 + Math.random() * 0.1;
        p.z = wz + (Math.random() - 0.5) * 0.3;

        // Velocity: kicked upwards and backward
        p.vx = -sinY * -speed * 0.15 + (Math.random() - 0.5) * 0.4;
        p.vy = 0.5 + Math.random() * 0.8;
        p.vz = -cosY * -speed * 0.15 + (Math.random() - 0.5) * 0.4;

        p.life = 1.0;
        p.maxLife = 0.6 + Math.random() * 0.4;
        p.scale = 0.12 + Math.random() * 0.15;
      });
    }

    // Update particles
    particles.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= dt / p.maxLife;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 0.6 * dt; // gravity

        const currentScale = Math.max(0, p.scale * (1.0 + (1.0 - p.life) * 1.5) * p.life);
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.set(currentScale, currentScale, currentScale);
        dummy.rotation.set(p.x * 2, p.y * 2, p.z * 2);
        dummy.updateMatrix();
      } else {
        dummy.position.set(0, -500, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
      }
      meshRef.current?.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PARTICLE_COUNT]}
      frustumCulled={false}
    >
      <dodecahedronGeometry args={[0.3, 0]} />
      <meshBasicMaterial
        color="#B45309"
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </instancedMesh>
  );
};

