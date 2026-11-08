import React, { useState } from 'react';
import { Leva } from 'leva';
import { EraKey } from './types/era';
import { RoverScene } from './components/canvas/RoverScene';
import { HudOverlay } from './components/ui/HudOverlay';

export const App: React.FC = () => {
  const [currentEra, setCurrentEra] = useState<EraKey>('2021_MODERN');

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#05070B] select-none">
      {/* Leva Controls Panel configured with NASA retro styling */}
      <Leva
        collapsed={false}
        oneLineLabels={false}
        flat={false}
        theme={{
          colors: {
            elevation1: '#080c14',
            elevation2: '#0d1522',
            elevation3: '#152033',
            accent1: '#00F0FF',
            accent2: '#00c4d4',
            accent3: '#008b99',
            highlight1: '#00F0FF',
            highlight2: '#38bdf8',
            highlight3: '#7dd3fc',
          },
          radii: {
            xs: '2px',
            sm: '3px',
            lg: '4px',
          },
          space: {
            xs: '3px',
            sm: '6px',
            md: '10px',
            rowGap: '6px',
            colGap: '6px',
          },
          fontSizes: {
            root: '11px',
            toolTip: '10px',
          },
        }}
      />

      {/* 3D WebGL Canvas Layer */}
      <RoverScene currentEra={currentEra} onEraChange={setCurrentEra} />

      {/* Diegetic & Mission Telemetry 2D Vector DOM Layer */}
      <HudOverlay
        currentEra={currentEra}
        onSelectEra={setCurrentEra}
      />
    </main>
  );
};

export default App;
