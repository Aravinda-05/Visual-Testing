import { useEffect, useRef, useState, useCallback } from 'react';
import { RoverDriveInput } from '../types/drive';

export function useRoverControls() {
  const inputsRef = useRef<RoverDriveInput>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false,
    brake: false,
    reset: false,
  });

  // State mirror for UI indicators
  const [activeInputs, setActiveInputs] = useState<RoverDriveInput>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false,
    brake: false,
    reset: false,
  });

  const updateInput = useCallback((key: keyof RoverDriveInput, value: boolean) => {
    inputsRef.current[key] = value;
    setActiveInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in a text field
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      let handled = true;
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          inputsRef.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          inputsRef.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          inputsRef.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          inputsRef.current.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          inputsRef.current.boost = true;
          break;
        case 'Space':
          inputsRef.current.brake = true;
          break;
        case 'KeyR':
          inputsRef.current.reset = true;
          break;
        default:
          handled = false;
          break;
      }

      if (handled) {
        e.preventDefault();
        setActiveInputs({ ...inputsRef.current });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      let handled = true;
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          inputsRef.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          inputsRef.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          inputsRef.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          inputsRef.current.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          inputsRef.current.boost = false;
          break;
        case 'Space':
          inputsRef.current.brake = false;
          break;
        case 'KeyR':
          inputsRef.current.reset = false;
          break;
        default:
          handled = false;
          break;
      }

      if (handled) {
        setActiveInputs({ ...inputsRef.current });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return {
    inputsRef,
    activeInputs,
    setVirtualInput: updateInput,
  };
}

