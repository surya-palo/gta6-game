// Sunset Keys — every tuning number, colour and world constant in one place.
// The world is measured in world units; the camera shows roughly one screenful
// of it at a time, so no number below depends on the window size.

/** Fixed simulation step, seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** The city is this big, in world units. */
export const WORLD = { width: 3600, height: 2600 };

/** Road centrelines run every GRID units; each road is ROAD wide with sidewalks. */
export const GRID = 400;
export const ROAD = 96;
export const SIDEWALK = 14;

/** The beach strip: sand starts here, water starts a little further down. */
export const BEACH_Y = 2420;
export const WATER_Y = 2520;

/** The park block (in block coordinates: block 2 across, block 1 down). */
export const PARK = { bx: 2, by: 1 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  sprintSpeed: 330,
  maxHealth: 100,
  /** Health regained per second after 5 s without damage. */
  regen: 6,
  regenDelay: 5,
  punchRange: 34,
  punchDamage: 12,
  punchCooldown: 0.35,
};

export const WEAPON = {
  name: 'Pistol',
  damage: 25,
  magSize: 12,
  reloadTime: 1.1,
  fireCooldown: 0.22,
  bulletSpeed: 900,
  range: 520,
  spread: 0.03,
};

/** Vehicle types: size, handling and look. Speeds are world units per second. */
export const VEHICLES = {
  sedan: { name: 'Sedan', length: 64, width: 30, topSpeed: 520, accel: 300, brake: 480, grip: 5.2, turn: 2.6, health: 100, colours: ['#c0392b', '#2e86c1', '#7d3c98', '#b7950b', '#5d6d7e'] },
  taxi: { name: 'Taxi', length: 64, width: 30, topSpeed: 500, accel: 290, brake: 470, grip: 5.2, turn: 2.6, health: 100, colours: ['#f1c40f'] },
  sports: { name: 'Sports', length: 66, width: 30, topSpeed: 720, accel: 430, brake: 560, grip: 6.4, turn: 3.1, health: 80, colours: ['#e74c3c', '#1abc9c', '#f39c12'] },
  van: { name: 'Van', length: 74, width: 32, topSpeed: 430, accel: 220, brake: 400, grip: 4.4, turn: 2.2, health: 140, colours: ['#ecf0f1', '#95a5a6', '#2980b9'] },
  truck: { name: 'Truck', length: 84, width: 34, topSpeed: 400, accel: 190, brake: 380, grip: 4.0, turn: 2.0, health: 180, colours: ['#6e2c00', '#1e8449', '#7f8c8d'] },
  police: { name: 'Police', length: 66, width: 30, topSpeed: 660, accel: 380, brake: 540, grip: 6.0, turn: 3.0, health: 120, colours: ['#f4f6f7'] },
};

export const TRAFFIC = {
  cars: 26,
  peds: 30,
  cruiseMin: 130,
  cruiseMax: 200,
  pedSpeedMin: 40,
  pedSpeedMax: 70,
  /** How far ahead a traffic car looks for an obstacle before braking. */
  lookAhead: 90,
};

export const POLICE = {
  /** Wanted stars at which each response tier starts. */
  maxWanted: 5,
  /** Seconds out of every officer's sight before one star drops. */
  decaySeconds: 12,
  /** Distance beyond which the player counts as out of sight. */
  sightRange: 700,
  /** Seconds an officer must stay close to bust the player on foot. */
  bustSeconds: 2.0,
  bustRange: 46,
  /** How many police cars may chase at once, by wanted level. */
  carsByWanted: [0, 1, 2, 3, 4, 5],
  /** How many officers on foot may chase at once, by wanted level. */
  officersByWanted: [0, 1, 2, 2, 3, 4],
  spawnDistance: 620,
  ramDamage: 8,
};

export const MISSIONS = [
  {
    id: 'first-job',
    title: 'First Job',
    giver: 'Dario Venn',
    briefing: 'Dario needs a package picked up from his garage and dropped at the docks. No rush — just drive.',
    reward: 500,
    stages: [
      { kind: 'goto', label: 'Drive to Dario\'s garage', marker: 'garage' },
      { kind: 'goto', label: 'Deliver the package to the docks', marker: 'docks' },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    giver: 'Dario Venn',
    briefing: 'A buyer wants the red sports car parked by the marina. Take it, lose the cops, bring it to the chop shop.',
    reward: 800,
    stages: [
      { kind: 'steal', label: 'Steal the sports car at the marina', marker: 'marina' },
      { kind: 'goto', label: 'Deliver it to the chop shop', marker: 'chopshop' },
    ],
  },
  {
    id: 'the-drop',
    title: 'The Drop',
    giver: 'Lena Kova',
    briefing: 'Lena left a bag in the park. Grab it on foot — the cops are watching, so stay cool and walk it to the safehouse.',
    reward: 1200,
    stages: [
      { kind: 'goto', label: 'Pick up the bag in the park', marker: 'park' },
      { kind: 'goto', label: 'Walk it to the safehouse', marker: 'safehouse' },
    ],
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    giver: 'Dario Venn',
    briefing: 'The bank on Meridian Row. Get in, grab the cash, get out. Guards will shoot back — and so will the whole force.',
    reward: 2500,
    stages: [
      { kind: 'goto', label: 'Reach the bank on Meridian Row', marker: 'bank' },
      { kind: 'grab', label: 'Grab the cash (deal with the guards)', marker: 'bank' },
      { kind: 'goto', label: 'Escape to the safehouse', marker: 'safehouse' },
    ],
  },
];

/** Named places in the city (world coordinates), used by missions and the minimap. */
export const PLACES = {
  garage: { x: 600, y: 600, label: "Dario's Garage" },
  docks: { x: 3300, y: 2200, label: 'The Docks' },
  marina: { x: 3000, y: 2300, label: 'Marina' },
  chopshop: { x: 200, y: 1800, label: 'Chop Shop' },
  park: { x: 1200, y: 800, label: 'Palm Park' },
  safehouse: { x: 1800, y: 400, label: 'Safehouse' },
  bank: { x: 2200, y: 1400, label: 'Meridian Bank' },
  hospital: { x: 1000, y: 1800, label: 'Hospital' },
  policeStation: { x: 2600, y: 600, label: 'Police Station' },
};

export const PALETTE = {
  grass: '#7ec850',
  grassDark: '#6db844',
  sand: '#f2d492',
  water: '#2e9fd8',
  waterDeep: '#1f7fb8',
  road: '#3d3f45',
  roadLine: '#e8d44d',
  sidewalk: '#b9bec4',
  crosswalk: '#e8e8e8',
  park: '#5da93f',
  buildingRoof: ['#c96f4a', '#d9a05b', '#8fa3b8', '#b08968', '#a3b18a', '#e07a5f', '#6d6875', '#f2cc8f'],
  buildingEdge: '#00000033',
  player: '#2ecc71',
  playerDark: '#27ae60',
  pedShirt: ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#34495e'],
  officer: '#1a5276',
  hudBg: '#00000088',
  hudText: '#ffffff',
  hudMuted: '#cfd6dd',
  star: '#ffd700',
  starEmpty: '#ffffff44',
  money: '#7dff8a',
  health: '#4ade80',
  healthLow: '#ef4444',
  marker: '#ffd700',
  markerSafe: '#4ade80',
  title: '#ff9a3c',
  titleShadow: '#7b2d8e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'sunset-keys.save.v1';

/** Seconds a HUD message stays up before fading. */
export const MESSAGE_TIME = 4;
