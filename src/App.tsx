import React, { useRef, useEffect } from 'react';
import { Leva } from 'leva';
import { useMissionStore } from './store/useMissionStore';
import { RoverScene } from './components/canvas/RoverScene';
import { MissionHUD } from './components/MissionHUD';
import { DriveControls } from './components/CuriosityRover';
import { soundEngine } from './utils/soundEngine';

export const App: React.FC = () => {
  const setEraShaderOverride = useMissionStore((s) => s.setEraShaderOverride);
  const setCameraMode = useMissionStore((s) => s.setCameraMode);
  const toggleCodex = useMissionStore((s) => s.toggleCodex);
  const resetMission = useMissionStore((s) => s.resetMission);
  const distanceToTarget = useMissionStore((s) => s.distanceToTarget);
  const missionPhase = useMissionStore((s) => s.missionPhase);
  const setMissionPhase = useMissionStore((s) => s.setMissionPhase);

  // High-performance drive controls ref (polled directly by 60fps physics loop)
  const driveControlsRef = useRef<DriveControls>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false,
    brake: false,
    reset: false,
  });

  // Global Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const key = e.code;
      const input = driveControlsRef.current;

      // Prevent page scrolling on Space and Arrow keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        e.preventDefault();
      }

      // Driving inputs
      if (key === 'KeyW' || key === 'ArrowUp') input.forward = true;
      if (key === 'KeyS' || key === 'ArrowDown') input.backward = true;
      if (key === 'KeyA' || key === 'ArrowLeft') input.left = true;
      if (key === 'KeyD' || key === 'ArrowRight') input.right = true;
      if (key === 'ShiftLeft' || key === 'ShiftRight') input.boost = true;
      if (key === 'KeyX') input.brake = true;

      // Era Shader Hotkeys [1], [2], [3]
      if (key === 'Digit1') {
        setEraShaderOverride('1967_ANALOG');
      }
      if (key === 'Digit2') {
        setEraShaderOverride('1997_RETRO_16BIT');
      }
      if (key === 'Digit3') {
        setEraShaderOverride('2012_MSL_DEFAULT');
      }

      // Camera toggle [C]: Follow (3rd Person) -> Free Roam Orbit -> ChemCam Zoom
      if (key === 'KeyC') {
        useMissionStore.getState().cycleCameraMode();
        soundEngine.playUiBlip();
      }

      // Context action [E]: engage telescope when in range
      if (key === 'KeyE') {
        if (distanceToTarget <= 7.0 && missionPhase === 'EXPLORING') {
          setCameraMode('CHEMCAM_TELESCOPE');
          setMissionPhase('LASER_TARGETING');
        }
      }

      // Codex Drawer toggle [Tab]
      if (key === 'Tab') {
        e.preventDefault();
        toggleCodex();
      }

      // Reset [R]
      if (key === 'KeyR') {
        input.reset = true;
        resetMission();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.code;
      const input = driveControlsRef.current;

      if (key === 'KeyW' || key === 'ArrowUp') input.forward = false;
      if (key === 'KeyS' || key === 'ArrowDown') input.backward = false;
      if (key === 'KeyA' || key === 'ArrowLeft') input.left = false;
      if (key === 'KeyD' || key === 'ArrowRight') input.right = false;
      if (key === 'ShiftLeft' || key === 'ShiftRight') input.boost = false;
      if (key === 'KeyX') input.brake = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [distanceToTarget, missionPhase, setCameraMode, setEraShaderOverride, setMissionPhase, toggleCodex, resetMission]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0a0503] select-none font-mono">
      {/* 3D WebGL Canvas Scene */}
      <RoverScene driveControlsRef={driveControlsRef} />

      {/* Flight Director Terminal HUD & Overlays */}
      <MissionHUD />

      {/* Hidden Leva Controls Root */}
      <Leva
        collapsed
        hidden={true}
        theme={{
          colors: {
            elevation1: '#090d16',
            elevation2: '#0e1526',
            elevation3: '#152038',
            accent1: '#00F0FF',
            accent2: '#C85A32',
            accent3: '#00F0FF',
            highlight1: '#00F0FF',
            highlight2: '#38bdf8',
            highlight3: '#7dd3fc',
          },
        }}
      />
    </main>
  );
};
export default App;
