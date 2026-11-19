// The city's life: traffic cars that drive the roads and turn at junctions,
// and pedestrians who walk the sidewalks and run from trouble. Both keep the
// world feeling inhabited while the player is busy elsewhere.

import { GRID, ROAD, TRAFFIC, WORLD } from './config.js';
import { isRoad, nearestRoadPoint, roadCentresX, roadCentresY, resolveCircle, solidRects } from './city.js';
import { collideCars, makeCar, stepCar } from './vehicles.js';

const CAR_TYPES = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'truck', 'sports'];

export function createTraffic(rng) {
  return { cars: [], peds: [] };
}

export function spawnTrafficCar(traffic, rng, avoidX, avoidY) {
  // Pick a road first, then a point on it, so the car's heading matches the
  // road it spawns on (a car facing across its road drives straight off it).
  const xs = roadCentresX();
  const ys = roadCentresY();
  let x;
  let y;
  let angle;
  for (let tries = 0; tries < 12; tries += 1) {
    if (rng.chance(0.5)) {
      x = rng.pick(xs);
      y = rng.range(150, 2250);
      angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = rng.range(150, WORLD.width - 150);
      y = rng.pick(ys);
      angle = rng.chance(0.5) ? 0 : Math.PI;
    }
    if (Math.hypot(x - avoidX, y - avoidY) > 400) break;
  }
  const car = makeCar(rng.pick(CAR_TYPES), x, y, angle, rng, 'traffic');
  car.cruise = rng.range(TRAFFIC.cruiseMin, TRAFFIC.cruiseMax);
  car.target = nextJunctionTarget(car, rng);
  traffic.cars.push(car);
  return car;
}

/** The next junction the car is heading for, along its current road. */
export function nextJunctionTarget(car, rng) {
  const vertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
  const dir = vertical ? Math.sign(Math.sin(car.angle)) : Math.sign(Math.cos(car.angle));
  if (vertical) {
    const xs = roadCentresX();
    const x = xs.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
    const ys = roadCentresY();
    const ahead = ys.filter((y) => (dir > 0 ? y > car.y + 40 : y < car.y - 40));
    const y = ahead.length ? ahead[dir > 0 ? 0 : ahead.length - 1] : (dir > 0 ? 2200 : 200);
    return { x, y };
  }
  const ys = roadCentresY();
  const y = ys.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
  const xs = roadCentresX();
  const ahead = xs.filter((x) => (dir > 0 ? x > car.x + 40 : x < car.x - 40));
  const x = ahead.length ? ahead[dir > 0 ? 0 : ahead.length - 1] : (dir > 0 ? 3400 : 200);
  return { x, y };
}

/** At a junction, a traffic car may turn; otherwise it carries straight on. */
function chooseTurn(car, rng) {
  const vertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
  const roll = rng.next();
  if (roll < 0.55) return nextJunctionTarget(car, rng); // straight on
  // Turn: pick a target on the crossing road, left or right.
  const turnLeft = roll < 0.78;
  if (vertical) {
    const dir = Math.sign(Math.sin(car.angle));
    const ys = roadCentresY();
    const y = ys.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
    const x = car.x + (turnLeft ? -1 : 1) * dir * GRID;
    return { x: Math.max(200, Math.min(3400, x)), y };
  }
  const dir = Math.sign(Math.cos(car.angle));
  const xs = roadCentresX();
  const x = xs.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
  const y = car.y + (turnLeft ? 1 : -1) * dir * GRID;
  return { x, y: Math.max(200, Math.min(2200, y)) };
}

/** Is there a car or a pedestrian close ahead of this car? */
function blockedAhead(car, cars, peds) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < TRAFFIC.lookAhead && side < 30) return true;
  }
  for (const ped of peds) {
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < 60 && side < 26) return true;
  }
  return false;
}

export function stepTrafficCars(traffic, rng, dt, rects, peds, fx) {
  for (const car of traffic.cars) {
    // The player's car lives in this list too (it was stolen from traffic):
    // the traffic AI must never drive it — the player does.
    if (car.dead || car.driver === 'player') continue;
    if (!car.target || Math.hypot(car.target.x - car.x, car.target.y - car.y) < 40) {
      car.target = chooseTurn(car, rng);
    }
    const distToTarget = Math.hypot(car.target.x - car.x, car.target.y - car.y);
    const want = Math.atan2(car.target.y - car.y, car.target.x - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    const blocked = blockedAhead(car, traffic.cars, peds);
    // Slow down for a turn and on the approach to a junction, so the car
    // turns tightly at the junction centre and stays on the road instead of
    // swinging wide across the block.
    let throttle = car.speed < car.cruise ? 0.8 : 0;
    if (distToTarget < 160) throttle = Math.min(throttle, 0.25);
    // A sharp turn: brake while fast, creep forward while slow — never
    // reverse, or the car backs into the turn the wrong way.
    if (Math.abs(diff) > 1.0) throttle = Math.abs(car.speed) > 150 ? -0.4 : 0.2;
    else if (Math.abs(diff) > 0.5) throttle = Math.min(throttle, 0.15);
    if (blocked) throttle = -0.4;
    // Stuck recovery: if the car is barely moving for a second (wedged
    // against a building or another car), reverse out with opposite lock.
    if (car.reversing > 0) {
      car.reversing -= dt;
      stepCar(car, { throttle: -1, steer: -steer }, dt, rects);
      continue;
    }
    if (Math.abs(car.speed) < 15 && throttle > 0) {
      car.stuckTime = (car.stuckTime || 0) + dt;
      if (car.stuckTime > 1) {
        car.reversing = 0.9;
        car.stuckTime = 0;
      }
    } else {
      car.stuckTime = 0;
    }
    stepCar(car, { throttle, steer }, dt, rects);
    // A car that has been shoved off the road steers back toward one.
    if (!isRoad(car.x, car.y) && rng.chance(dt * 0.5)) {
      car.target = nearestRoadPoint(car.x, car.y, rng);
    }
  }
  // Traffic cars bump into each other (the player's car is handled by the
  // world step, not here).
  for (let i = 0; i < traffic.cars.length; i += 1) {
    if (traffic.cars[i].driver === 'player') continue;
    for (let j = i + 1; j < traffic.cars.length; j += 1) {
      if (traffic.cars[j].driver === 'player') continue;
      collideCars(traffic.cars[i], traffic.cars[j]);
    }
  }
}

export function spawnPed(traffic, rng, avoidX, avoidY) {
  for (let tries = 0; tries < 10; tries += 1) {
    const x = rng.range(100, WORLD.width - 100);
    const y = rng.range(100, 2300);
    if (Math.hypot(x - avoidX, y - avoidY) < 350) continue;
    const ped = {
      x, y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(TRAFFIC.pedSpeedMin, TRAFFIC.pedSpeedMax),
      shirt: rng.pick(['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#34495e']),
      target: null,
      flee: 0,
      fleeX: 0,
      fleeY: 0,
      scared: 0,
    };
    ped.target = { x: rng.range(100, WORLD.width - 100), y: rng.range(100, 2300) };
    traffic.peds.push(ped);
    return ped;
  }
  return null;
}

/** Scare every pedestrian near (x, y): they run away from it. */
export function scarePeds(traffic, x, y, radius) {
  for (const ped of traffic.peds) {
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.flee = 3 + Math.random() * 2;
      ped.fleeX = x;
      ped.fleeY = y;
      ped.scared = 5;
    }
  }
}

export function stepPeds(traffic, rng, dt, rects) {
  for (const ped of traffic.peds) {
    let tx;
    let ty;
    let speed = ped.speed;
    if (ped.flee > 0) {
      // Run directly away from the scare.
      ped.flee -= dt;
      const dx = ped.x - ped.fleeX;
      const dy = ped.y - ped.fleeY;
      const d = Math.hypot(dx, dy) || 1;
      tx = ped.x + (dx / d) * 100;
      ty = ped.y + (dy / d) * 100;
      speed = ped.speed * 3.2;
    } else {
      if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 30) {
        ped.target = { x: rng.range(100, WORLD.width - 100), y: rng.range(100, 2300) };
      }
      tx = ped.target.x;
      ty = ped.target.y;
    }
    ped.scared = Math.max(0, ped.scared - dt);
    const want = Math.atan2(ty - ped.y, tx - ped.x);
    let diff = want - ped.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    const fixed = resolveCircle(nx, ny, 10, rects);
    ped.x = fixed.x;
    ped.y = fixed.y;
  }
}

export function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5cba7';
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
