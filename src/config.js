import { random } from './rng.js';

// Gameplay constants ported from football_mania.py.
//
// The Python version is Z-up, with the goal line on y = 0 and the pitch at negative y.
// Three.js is Y-up, so a Python point (x, y, z) maps to (x, z, -y) here: the goal line
// sits on z = 0 and free kicks are taken from positive z. Units are kept identical, so
// every number below can be compared 1:1 with the original source.

export const GRID_LENGTH = 900;          // half width of the pitch
export const FIELD_BACK = 300;           // python FIELD_BACK_Y (pitch extends behind the goal)
export const FIELD_FRONT = GRID_LENGTH;  // python FIELD_FRONT_Y = -GRID_LENGTH

export const STATE = {
  MENU: 'menu',
  MODE_SELECT: 'modeSelect',
  PLAYING: 'playing',
  GAME_OVER: 'gameOver',
};

export const MODE = {
  KEEPER_POWER: 0,
  GOALPOST_REDUCTION: 1,
  TIME_REDUCTION: 2,
  DAILY: 3,
  PRACTICE: 4,
};

export const MODE_INFO = [
  {
    id: MODE.KEEPER_POWER,
    name: 'Goalkeeper Power',
    tag: 'Keeper grows',
    desc: 'Every goal makes the keeper 8% bigger. Find the gaps while they still exist.',
  },
  {
    id: MODE.GOALPOST_REDUCTION,
    name: 'Goalpost Reduction',
    tag: 'Goal shrinks',
    desc: 'The goal gets 40 units narrower after every goal you score.',
  },
  {
    id: MODE.TIME_REDUCTION,
    name: 'Time Reduction',
    tag: 'Shot clock',
    desc: '30 seconds per shot, 3 seconds less after every goal. Run out of time and it counts as a miss.',
  },
  {
    id: MODE.DAILY,
    name: 'Daily Challenge',
    tag: 'New every day',
    desc: 'Ten fixed free kicks, the same for everyone today. Wind, two bosses and no miss limit.',
  },
  {
    id: MODE.PRACTICE,
    name: 'Practice',
    tag: 'No pressure',
    desc: 'Unlimited free kicks against a normal keeper. Work on your curve and power.',
  },
];

export const DAILY = { kicks: 10, bossKicks: [4, 9] };

// Consecutive goals multiply the points of each goal.
export const STREAK = [{ at: 5, mult: 2 }, { at: 3, mult: 1.5 }];
export function multiplierFor(streak) {
  return STREAK.find((s) => streak >= s.at)?.mult ?? 1;
}

// A green band on the power bar: releasing inside it removes all scatter.
export const PERFECT = { width: 0.09, min: 0.3, max: 0.72, reactionDelay: 0.06 };

export const WIND = { startGoal: 2, perGoal: 0.12, max: 0.9, maxAccel: 320, kmh: 40 };
export const BOSS = { every: 5, bonus: 10 };
export const STICKER = { chance: 0.22, bonus: 5, radius: 22 };
export const NEAR_MISS = { gap: 20, cmPerUnit: 1.83 };

export const RULES = {
  maxMiss: 3,
  timerMax: 30,
  timerMin: 5,
  timerDec: 3,
};

export const GOAL = {
  width: 400,
  height: 200,
  depth: 40,
  netDepth: 90,
  postRadius: 5,
  minWidth: 120,
  shrinkStep: 40,
};

export const KEEPER = {
  width: 80,
  height: 120,
  lineOffset: 50,        // python keeper_y = -50
  maxRotation: 65,       // degrees, python KEEPER_MAX_ROTATION_ANGLE
  jumpDuration: 0.4,
  rotationDuration: 0.3,
  growth: 0.08,
};

export const BALL = { radius: 10 };

// Humanoids are modelled ~64 units tall (python draw_wall/draw_player local coords).
export const HUMAN_HEIGHT = 64;
export const PLAYER_SCALE = 1.5;

export const WALL = {
  count: 4,
  spacing: 30,      // shoulder to shoulder (python used 100, which left 70 unit gaps)
  // python WALL_DISTANCE_FROM_BALL = 110. Here the wall stands a share of the way to
  // goal (capped) so it can be cleared with a lob or bent around.
  distanceRatio: 0.45,
  maxDistance: 300,
  minDistance: 120,
  scale: 1.25,
  jumpHeight: 14,
};

export const PHYSICS = {
  gravity: 980,
  substep: 1 / 240,
  groundRestitution: 0.55,
  groundFriction: 0.82,
  rollFriction: 0.9,
};

export const SHOT = {
  minSpeed: 520,       // horizontal speed at zero power (a lob)
  maxSpeed: 2300,      // horizontal speed at full power (a driven shot)
  chargeTime: 1.1,     // seconds for the power bar to fill
  maxCurve: 1300,      // sideways acceleration at full curve
  maxDip: 1600,        // extra downward pull (topspin) at full power: driven shots rise then dip
  curveStep: 0.25,
  overpower: 0.85,     // above this power the shot loses accuracy
  overpowerError: 55,
  baseScatter: 6,
  distanceScatter: 0.025,
  aimSpeed: 240,       // marker speed with WASD (python moved 20 units per key press)
  aimMargin: 16,
};

export const SPAWN = {
  maxX: GRID_LENGTH - 250,
  minZ: 250,
  maxZ: GRID_LENGTH - 50,
  maxAngle: (62 * Math.PI) / 180,
};

// python get_goal_points: split the mouth into thirds.
export function getGoalPoints(x, y, goalWidth, goalHeight) {
  const xZone = Math.max(0, Math.min(2, Math.floor((x + goalWidth / 2) / (goalWidth / 3))));
  const yZone = Math.max(0, Math.min(2, Math.floor(y / (goalHeight / 3))));
  const corner = xZone === 0 || xZone === 2;
  if (corner && yZone === 2) return 9;
  if (corner && yZone === 0) return 5;
  return 3;
}

export function zoneName(points) {
  if (points === 9) return 'Top corner';
  if (points === 5) return 'Bottom corner';
  return 'Centre';
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (lo, hi) => lo + random() * (hi - lo);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const damp = (k, dt) => 1 - Math.exp(-k * dt);
