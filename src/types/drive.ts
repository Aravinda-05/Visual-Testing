export interface RoverDriveState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number; // m/s
  steerAngle: number; // radians
  wheelRotation: number; // radians
  odometer: number; // meters
  isBoosting: boolean;
  isBraking: boolean;
}

export interface RoverDriveInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  brake: boolean;
  reset: boolean;
}

export type CameraFollowMode = 'CHASE' | 'FREE_ORBIT';

