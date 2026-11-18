// Sunshine Bay — every tuning number in one place. The city is a grid of streets: blocks
// of 44 units with 14-unit roads between them, 7 blocks across, so the drivable city is about
// 420 units wide. South of the last street is the beach and the bay itself.

export const STEP = 1 / 60;

export const CITY = {
  blocks: 7,
  block: 44,
  road: 14,
  pitch: 58,
  half: 210,
  beachZ: 218,
  oceanZ: 300,
};

export const PLAYER = {
  radius: 0.55,
  walk: 6,
  run: 10.5,
  health: 100,
  magSize: 12,
  shootCooldown: 0.22,
  reloadTime: 1.1,
  punchRange: 1.6,
};

export const CAR = {
  accel: 24,
  brake: 34,
  reverse: 13,
  maxSpeed: 40,
  maxReverse: 12,
  steer: 2.1,
  grip: 6.5,
  health: 100,
  trafficSpeed: 11,
  policeSpeed: 42,
};

export const WANTED = {
  max: 5,
  decaySeconds: 26,
  steal: 1,
  hitPed: 1,
  shoot: 1,
  killCop: 1,
  policePerStar: [0, 1, 2, 3, 4, 5],
};

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    briefing: 'Delgado needs a driver. Steal any car on the street and bring it to his garage.',
    reward: 250,
    objectives: [
      { type: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', text: 'Drive to Delgado\'s garage', pos: [58, -58], radius: 6 },
    ],
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    briefing: 'A package is waiting at the marina. Grab it on foot — and expect company.',
    reward: 400,
    objectives: [
      { type: 'goto', text: 'Drive to the marina', pos: [-116, 174], radius: 7 },
      { type: 'pickup', text: 'Grab the package (press E at the marker)', pos: [-116, 174], radius: 3 },
      { type: 'escape', text: 'Lose the cops, then reach the hideout', pos: [116, -116], radius: 7, wanted: 2 },
    ],
  },
  {
    id: 'bay-heist',
    title: 'Bay Heist',
    briefing: 'The Bay Bank keeps its cash in the front vault. Walk in, take it, and get out fast.',
    reward: 900,
    objectives: [
      { type: 'goto', text: 'Reach the Bay Bank', pos: [0, 58], radius: 7 },
      { type: 'pickup', text: 'Grab the cash (press E at the vault)', pos: [0, 58], radius: 3 },
      { type: 'escape', text: 'Escape to the hideout with the cash', pos: [-58, -116], radius: 7, wanted: 3 },
    ],
  },
  {
    id: 'the-last-ride',
    title: 'The Last Ride',
    briefing: 'Delgado sold you out. Take the getaway car, outrun the whole Bay PD, and cross the bridge to freedom.',
    reward: 1500,
    objectives: [
      { type: 'steal', text: 'Steal the getaway car at the garage' },
      { type: 'escape', text: 'Outrun the police — reach the north bridge', pos: [0, -203], radius: 8, wanted: 4 },
    ],
  },
];

export const PALETTE = {
  sky: 0x8ec9ee,
  fog: 0x9fc7e8,
  sun: 0xfff2d8,
  ground: 0x3a3f46,
  road: 0x2b2e33,
  roadLine: 0xd8c95a,
  sidewalk: 0x8d9299,
  sand: 0xe3cf9e,
  ocean: 0x1e6f9e,
  building: [0x9a8f7a, 0x7a8ba0, 0xa08a7a, 0x8a9a7a, 0xb09a6a, 0x6a7a8a, 0xc0b49a, 0x5a6a7a],
  windowLit: 0xffe9a8,
  windowDark: 0x2a3542,
  grass: 0x5a8a4a,
};

export const SAVE_KEY = 'sunshine-bay.save.v1';
export const SOUND_KEY = 'sunshine-bay.sound.v1';

export const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0x3fae5a, 0xe0a92e, 0x8a5ac2, 0xd8d8d8, 0x222226, 0xe07a2e, 0x2ea8a0];
export const SHIRT_COLORS = [0xe05a4e, 0x4e8ae0, 0x4ee08a, 0xe0c94e, 0xc24ee0, 0xe08a4e, 0x8a8a8a, 0xe04e8a];
