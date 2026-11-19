// The screenshot scenes behind ?shot=chase|drive|foot|title. Each one stages
// a real game state — a fresh world, the player placed, the systems running —
// then plays the rules forward for a few seconds with a simple autopilot, so
// the frame is what the game really looks like and the same seed always gives
// the same frame.

import { MISSIONS, PLACES, STEP } from './config.js';
import { makeCar } from './vehicles.js';
import { enterCar } from './player.js';
import { spawnEnemy } from './combat.js';
import { stepWorld } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** A fake input the autopilot drives: steer/throttle read a mutable drive state. */
function autopilotInput(drive) {
  return {
    move() { return { x: 0, y: 0 }; },
    sprinting() { return false; },
    throttle() { return drive.throttle > 0; },
    brake() { return drive.throttle < 0; },
    steer() { return drive.steer; },
    mouse() { return { x: 640, y: 360 }; },
    takeActions() { return []; },
  };
}

/** Steer a car along the road toward a target, slowing for turns. */
function driveToward(car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  let throttle = 1;
  // A sharp turn: brake while fast, but creep forward while slow — never
  // reverse, or the car ends up backing into the turn the wrong way.
  if (Math.abs(diff) > 1.0) throttle = Math.abs(car.speed) > 200 ? -0.3 : 0.3;
  else if (Math.abs(diff) > 0.5) throttle = 0.25;
  return { throttle, steer: Math.max(-1, Math.min(1, diff * 2.4)) };
}

/**
 * Drive a car through a list of waypoints (junctions). If the car gets stuck
 * (barely moving for a second), reverse briefly to unwedge it.
 */
function driveRoute(world, car, waypoints, seconds) {
  const drive = { throttle: 1, steer: 0 };
  const input = autopilotInput(drive);
  let wp = 0;
  let stuckTime = 0;
  let reversing = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const target = waypoints[Math.min(wp, waypoints.length - 1)];
    if (Math.hypot(target.x - car.x, target.y - car.y) < 60 && wp < waypoints.length - 1) wp += 1;
    if (reversing > 0) {
      reversing -= STEP;
      drive.throttle = -1;
      drive.steer = -drive.steer;
    } else {
      Object.assign(drive, driveToward(car, target.x, target.y));
      if (Math.abs(car.speed) < 15) {
        stuckTime += STEP;
        if (stuckTime > 1) {
          reversing = 0.9;
          stuckTime = 0;
        }
      } else {
        stuckTime = 0;
      }
    }
    stepWorld(world, STEP, input);
  }
}

/**
 * Clear the traffic cars sitting on a stretch of road, so a staged drive has
 * a clear run. `segments` are axis-aligned road stretches {x1, y1, x2, y2};
 * a car within 60 units of any of them is removed. (Staging only — the game
 * itself spawns its full traffic.)
 */
function clearRoute(world, segments) {
  world.traffic.cars = world.traffic.cars.filter((car) => {
    if (car === world.player.car) return true;
    for (const s of segments) {
      const nearX = car.x >= Math.min(s.x1, s.x2) - 60 && car.x <= Math.max(s.x1, s.x2) + 60;
      const nearY = car.y >= Math.min(s.y1, s.y2) - 60 && car.y <= Math.max(s.y1, s.y2) + 60;
      if (nearX && nearY) return false;
    }
    return true;
  });
}

function runSteps(world, input, seconds) {
  const n = Math.floor(seconds / STEP);
  for (let i = 0; i < n; i += 1) stepWorld(world, STEP, input);
}

function putPlayerInCar(world, type, x, y, angle, colour) {
  const car = makeCar(type, x, y, angle, world.rng, 'parked');
  if (colour) car.colour = colour;
  world.traffic.cars.push(car);
  world.player.x = x;
  world.player.y = y;
  enterCar(world.player, car);
  return car;
}

/** Chase: 3 wanted stars, police on the tail, a mission objective on the HUD. */
function stageChase(world) {
  world.reset(null);
  world.player.money = 1350;
  const car = putPlayerInCar(world, 'sports', 1400, 1000, 0, '#e74c3c');
  // Hot Wheels, second stage: deliver to the chop shop.
  world.missions.index = 1;
  world.missions.active = MISSIONS[1];
  world.missions.state = 'active';
  world.missions.stage = 1;
  world.police.wanted = 3;
  // Two patrol cars already on the tail, close enough to stay in the frame:
  // the sports car is faster than a cruiser, so timer-spawned cars alone fall
  // too far behind to be seen. No further spawns during the short scene.
  world.police.spawnTimer = 99;
  world.police.cars.push(makeCar('police', 1200, 1000, 0, world.rng, 'police'));
  world.police.cars.push(makeCar('police', 1100, 1000, 0, world.rng, 'police'));
  // Clear the chase route so the run is clean (police still chase from behind).
  clearRoute(world, [{ x1: 1000, y1: 1000, x2: 3450, y2: 1000 }]);
  // Straight east along Meridian Row at full speed, police on the tail.
  driveRoute(world, car, [
    { x: 1800, y: 1000 }, { x: 2200, y: 1000 }, { x: 2600, y: 1000 },
    { x: 3000, y: 1000 }, { x: 3400, y: 1000 },
  ], 3.6);
  world.message('Deliver it to the chop shop — lose the cops!', 6);
  return { screen: SCREEN_PLAY };
}

/** Drive: a calm cruise through downtown with traffic and pedestrians. */
function stageDrive(world) {
  world.reset(null);
  world.player.money = 500;
  const car = putPlayerInCar(world, 'sedan', 1000, 1400, 0, '#2e86c1');
  // Clear the avenue so the cruise has a clean run.
  clearRoute(world, [{ x1: 900, y1: 1400, x2: 3450, y2: 1400 }]);
  // Straight east along the avenue, at speed the whole way.
  driveRoute(world, car, [
    { x: 1400, y: 1400 }, { x: 1800, y: 1400 }, { x: 2200, y: 1400 },
    { x: 2600, y: 1400 }, { x: 3000, y: 1400 }, { x: 3400, y: 1400 },
  ], 4.4);
  return { screen: SCREEN_PLAY };
}

/** Foot: on foot by the park marker, a guard ahead, mission live. */
function stageFoot(world) {
  world.reset(null);
  world.player.money = 2150;
  world.player.x = PLACES.park.x - 260;
  world.player.y = PLACES.park.y + 140;
  world.player.angle = Math.atan2(PLACES.park.y - world.player.y, PLACES.park.x - world.player.x);
  world.missions.index = 2;
  world.missions.active = MISSIONS[2];
  world.missions.state = 'active';
  world.missions.stage = 0;
  spawnEnemy(world.combat, PLACES.park.x + 80, PLACES.park.y - 40, 'guard');
  // Walk toward the marker, stopping short of it so stage 1 stays live.
  const walk = {
    move() {
      const dx = PLACES.park.x - world.player.x;
      const dy = PLACES.park.y - world.player.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    },
    sprinting() { return false; },
    throttle() { return false; },
    brake() { return false; },
    steer() { return 0; },
    mouse() { return { x: 900, y: 300 }; },
    takeActions() { return []; },
  };
  runSteps(world, walk, 0.9);
  world.message('Pick up the bag in the park.', 5);
  return { screen: SCREEN_PLAY };
}

/**
 * Set the world to the named scene and return the screen to draw.
 * Unknown names stage the title screen.
 */
export function stageShot(name, world) {
  if (name === 'chase') return stageChase(world);
  if (name === 'drive') return stageDrive(world);
  if (name === 'foot') return stageFoot(world);
  world.reset(null);
  return { screen: SCREEN_TITLE };
}
