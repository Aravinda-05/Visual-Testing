export interface CuriosityHotspot {
  id: string;
  title: string;
  shortName: string;
  component: string;
  pos: [number, number, number];
  specBadge: string;
  explanation: string;
  funFact: string;
}

export const CURIOSITY_HOTSPOTS: CuriosityHotspot[] = [
  {
    id: 'mmrtg',
    title: 'MMRTG NUCLEAR POWER SOURCE',
    shortName: 'MMRTG NUCLEAR',
    component: 'Multi-Mission Radioisotope Thermoelectric Generator',
    pos: [0.0, 1.35, -1.6],
    specBadge: '110W ELECTRICAL | 4.8 KG PU-238',
    explanation:
      'Curiosity abandoned solar panels because Martian dust storms starved Spirit and Opportunity of sunlight. Its MMRTG converts the radioactive decay heat of Plutonium-238 into continuous electricity, running 24/7 through freezing polar winters and global dust storms.',
    funFact:
      'Decay heat from the nuclear core is circulated through fluid loops inside the chassis like warm blood, keeping internal computers at room temperature even when outside drops to -130°C!',
  },
  {
    id: 'chemcam',
    title: 'CHEMCAM 7m PULSED LASER',
    shortName: 'CHEMCAM LASER',
    component: 'Laser-Induced Breakdown Spectrometer (LIBS)',
    pos: [0.42, 2.65, 0.92],
    specBadge: 'RANGE: 7.0M | 1064NM INFRARED',
    explanation:
      'Curiosity fires a powerful million-watt infrared laser from its mast to vaporize pinhead-sized spots of rock into glowing plasma 7 meters away. The onboard telescope analyzes the light emission spectrum to identify minerals without needing to drive up and touch the rock.',
    funFact:
      'Each laser blast creates an audible shockwave snap that sounds like a miniature gunshot crack in Mars\' thin CO2 atmosphere, recorded by SuperCam microphones!',
  },
  {
    id: 'wheels',
    title: '50cm WHEELS & SECRET MORSE CODE',
    shortName: '0.75mm AL WHEELS',
    component: 'Machined Aluminum Grousers & Visual Odometry Treads',
    pos: [-1.4, 0.65, 1.15],
    specBadge: '50CM DIAMETER | 0.75MM SKIN',
    explanation:
      'Each 50cm wheel was milled from a solid cylinder of aircraft-grade aluminum with a skin only 0.75mm thin to minimize flight weight. Holes in the treads leave tracks in the loose sand so navigation cameras can measure drive distance and wheel slippage accurately.',
    funFact:
      'The rectangular tread holes aren\'t random cutouts—they spell out "J-P-L" (.---  .--.  .-..) in Morse code, permanently imprinting NASA Jet Propulsion Laboratory into the Martian sand with every turn!',
  },
  {
    id: 'rocker_bogie',
    title: 'ROCKER-BOGIE SUSPENSION',
    shortName: 'ROCKER-BOGIE',
    component: 'Springless Articulated Titanium Linkage',
    pos: [1.35, 0.85, 0.1],
    specBadge: 'MAX STEP: 75CM | ZERO SPRINGS',
    explanation:
      'Curiosity uses no mechanical springs or shock absorbers. An articulated rocker-bogie linkage connected through a central differential pivot keeps all six wheels firmly on the ground, allowing the rover to climb over rocks up to 75cm high without tipping over.',
    funFact:
      'The rocker-bogie design allows Curiosity to safely tilt at up to 45 degrees in any direction without rolling, though mission software conservatively stops at 30 degrees to prevent slide!',
  },
  {
    id: 'robotic_arm',
    title: '2.3m ROBOTIC ARM & DRILL',
    shortName: 'ROBOTIC ARM & DRILL',
    component: '5-DoF Heavy Arm with 30kg Sensor Turret',
    pos: [-0.55, 0.9, 2.15],
    specBadge: '5-DoF | 30KG TURRET | 6.5CM DRILL',
    explanation:
      'Like a robotic field geologist, this 2.3-meter arm presses a rotary percussive drill, a dust removal wire brush, and MAHLI (a microscopic magnifier) against Martian rocks. It bores 6.5cm into ancient bedrock to deliver pristine stone powder to internal laboratories.',
    funFact:
      'The arm turret carries an authentic 1909 VDB Lincoln penny mounted to its calibration target as a fun geological scale reference and tribute to coin-collecting tradition!',
  },
  {
    id: 'hga',
    title: 'HIGH-GAIN HEXAGON ANTENNA',
    shortName: 'HIGH-GAIN ANTENNA',
    component: 'Steerable Hexagonal X-Band Phased Transceiver',
    pos: [-0.52, 1.45, -0.6],
    specBadge: 'X-BAND (8 GHZ) | DUAL-AXIS GIMBAL',
    explanation:
      'This hexagonal dish antenna articulates across two axes to point directly at Earth\'s Deep Space Network dishes or relay orbiters (MRO / Odyssey) overhead. It transmits high-volume scientific spectra, color panoramas, and engineering telemetry across 150 million miles.',
    funFact:
      'Because Mars spins on its axis and orbits the Sun at a different speed than Earth, Curiosity recalculates Earth\'s exact planetary coordinates every morning to lock onto the home planet!',
  },
];
