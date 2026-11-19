// The Palma Keys police: a wanted level from 0 to 5 stars, police cars that
// chase and ram, and officers on foot who try to bust the player. Crimes raise
// the heat; staying out of sight lets it cool. Getting busted or wasted ends
// the run (and fails the active mission).

import { POLICE } from './config.js';
import { nearestRoadPoint, resolveCircle, roadCentresX, roadCentresY } from './city.js';
import { collideCars, makeCar, stepCar } from './vehicles.js';
import { burst } from './effects.js';

export function createPolice() {
  return {
    wanted: 0,
    /** Seconds since any officer last had the player in sight. */
    hiddenTime: 0,
    /** Bust progress, 0..1 (fills while an officer stands close). */
    bust: 0,
    cars: [],
    officers: [],
    /** Cooldown between police car spawns. */
    spawnTimer: 0,
  };
}

export function addWanted(police, stars) {
  police.wanted = Math.min(POLICE.maxWanted, police.wanted + stars);
  police.hiddenTime = 0;
}

export function clearWanted(police) {
  police.wanted = 0;
  police.bust = 0;
  police.hiddenTime = 0;
}

/** A crime just happened: raise the heat and wake the force up. */
export function commitCrime(police, kind) {
  if (kind === 'steal') addWanted(police, 1);
  else if (kind === 'hitPed') addWanted(police, 1);
  else if (kind === 'killPed') addWanted(police, 2);
  else if (kind === 'hitCop') addWanted(police, 1);
  else if (kind === 'shoot') addWanted(police, 1);
  else if (kind === 'killCop') addWanted(police, 2);
}

function spawnPoliceCar(police, player, rng, rects) {
  // Spawn on a road near the player, facing along it toward the player, so
  // the chase starts on the streets instead of across a block.
  const xs = roadCentresX();
  const ys = roadCentresY();
  let x;
  let y;
  let angle;
  if (rng.chance(0.5)) {
    x = xs.reduce((a, b) => (Math.abs(b - player.x) < Math.abs(a - player.x) ? b : a));
    y = player.y + (rng.chance(0.5) ? 1 : -1) * POLICE.spawnDistance;
    y = Math.max(150, Math.min(2250, y));
    angle = y < player.y ? Math.PI / 2 : -Math.PI / 2;
  } else {
    x = player.x + (rng.chance(0.5) ? 1 : -1) * POLICE.spawnDistance;
    x = Math.max(150, Math.min(3450, x));
    y = ys.reduce((a, b) => (Math.abs(b - player.y) < Math.abs(a - player.y) ? b : a));
    angle = x < player.x ? 0 : Math.PI;
  }
  const car = makeCar('police', x, y, angle, rng, 'police');
  police.cars.push(car);
  return car;
}

function spawnOfficer(police, player, rng) {
  const a = rng.range(0, Math.PI * 2);
  const d = POLICE.spawnDistance * 0.8;
  police.officers.push({
    x: player.x + Math.cos(a) * d,
    y: player.y + Math.sin(a) * d,
    angle: 0,
    speed: 250,
    health: 50,
  });
}

function steerToward(car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.max(-1, Math.min(1, diff * 2.5));
}

/**
 * One step of the police. Returns 'busted' when the player is caught, else ''.
 * `world` is consulted for the player, cars, effects and audio hooks.
 */
export function stepPolice(police, world, dt) {
  const { player, rng, fx } = world;
  const rects = world.rects;
  if (police.wanted <= 0) {
    // No heat: the force stands down, cars drive off and despawn.
    police.bust = 0;
    police.cars = police.cars.filter((c) => Math.hypot(c.x - player.x, c.y - player.y) < 900);
    police.officers = [];
    return '';
  }

  // Spawn up to the wanted level's allowance.
  const wantCars = POLICE.carsByWanted[police.wanted];
  const wantOfficers = player.onFoot ? POLICE.officersByWanted[police.wanted] : 0;
  police.spawnTimer -= dt;
  if (police.spawnTimer <= 0) {
    if (police.cars.length < wantCars) spawnPoliceCar(police, player, rng, rects);
    if (police.officers.length < wantOfficers) spawnOfficer(police, player, rng);
    police.spawnTimer = 1.2;
  }

  // Is any officer close enough to see the player?
  let seen = false;
  for (const car of police.cars) {
    if (Math.hypot(car.x - player.x, car.y - player.y) < POLICE.sightRange) seen = true;
  }
  for (const off of police.officers) {
    if (Math.hypot(off.x - player.x, off.y - player.y) < POLICE.sightRange) seen = true;
  }
  if (seen) police.hiddenTime = 0;
  else {
    police.hiddenTime += dt;
    if (police.hiddenTime > POLICE.decaySeconds) {
      police.wanted -= 1;
      police.hiddenTime = 0;
      world.message(`Wanted level down — ${police.wanted === 0 ? 'you lost them!' : `${police.wanted} star${police.wanted === 1 ? '' : 's'} left.`}`);
    }
  }

  // Police cars chase: follow the roads toward the player while far away,
  // then steer straight at them to ram when close.
  for (const car of police.cars) {
    if (car.dead) continue;
    const dist = Math.hypot(player.x - car.x, player.y - car.y);
    let tx = player.x;
    let ty = player.y;
    if (dist > 320) {
      // Aim for the road junction nearest the player, so the chase stays on
      // the streets instead of cutting across blocks.
      const rp = nearestRoadPoint(player.x, player.y, rng);
      tx = rp.x;
      ty = rp.y;
    }
    const steer = steerToward(car, tx, ty);
    const throttle = dist > 60 ? 1 : 0.4;
    // Stuck recovery: reverse out with opposite lock if wedged.
    if (car.reversing > 0) {
      car.reversing -= dt;
      stepCar(car, { throttle: -1, steer: -steer }, dt, rects);
      continue;
    }
    if (Math.abs(car.speed) < 15) {
      car.stuckTime = (car.stuckTime || 0) + dt;
      if (car.stuckTime > 1) {
        car.reversing = 0.9;
        car.stuckTime = 0;
      }
    } else {
      car.stuckTime = 0;
    }
    stepCar(car, { throttle, steer }, dt, rects);
    // Ram damage when the police car hits the player's car hard.
    if (!player.onFoot && player.car) {
      const impact = collideCars(car, player.car);
      if (impact > 120) {
        world.audio.crash(impact / 400);
        fx && sparksAt(fx, (car.x + player.car.x) / 2, (car.y + player.car.y) / 2);
      }
    }
    // A police car that is wrecked stops chasing.
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      car.driver = 'parked';
    }
  }
  police.cars = police.cars.filter((c) => !c.dead || Math.hypot(c.x - player.x, c.y - player.y) < 500);

  // Officers on foot chase the player; close and slow means busted.
  let busting = false;
  for (const off of police.officers) {
    const dx = player.x - off.x;
    const dy = player.y - off.y;
    const d = Math.hypot(dx, dy) || 1;
    off.angle = Math.atan2(dy, dx);
    const nx = off.x + (dx / d) * off.speed * dt;
    const ny = off.y + (dy / d) * off.speed * dt;
    const fixed = resolveCircle(nx, ny, 10, rects);
    off.x = fixed.x;
    off.y = fixed.y;
    if (player.onFoot && d < POLICE.bustRange) {
      // Busting needs the player nearly still; a sprinting player slips away.
      const playerSpeed = Math.hypot(player.vx || 0, player.vy || 0);
      if (playerSpeed < 60) busting = true;
    }
  }
  if (busting) {
    police.bust += dt / POLICE.bustSeconds;
    if (police.bust >= 1) return 'busted';
  } else {
    police.bust = Math.max(0, police.bust - dt * 0.5);
  }

  // Busted in a car: surrounded and stopped with cops on every side.
  if (!player.onFoot && player.car && Math.abs(player.car.speed) < 10) {
    let close = 0;
    for (const car of police.cars) {
      if (Math.hypot(car.x - player.x, car.y - player.y) < 120) close += 1;
    }
    if (close >= 2 && police.wanted >= 1) {
      police.bust += dt / 3;
      if (police.bust >= 1) return 'busted';
    }
  }
  return '';
}

function sparksAt(fx, x, y) {
  if (fx) burst(fx, x, y, '#ffd76a', 8, 220, 0.35, 3);
}

export function drawOfficer(ctx, off, time) {
  ctx.save();
  ctx.translate(off.x, off.y);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a5276';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0e2a3d';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Cap + badge.
  ctx.fillStyle = '#0e2a3d';
  ctx.beginPath();
  ctx.arc(Math.cos(off.angle) * 2, Math.sin(off.angle) * 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(Math.cos(off.angle) * 8, Math.sin(off.angle) * 8, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
