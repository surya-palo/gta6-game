// Mara Reyes, the player: on foot she walks, sprints, punches and shoots;
// in a car she drives it. Entering and leaving a car is the heart of the
// game, so it is kept forgiving — the nearest car within reach, and the
// player steps out beside it, never inside a wall.

import { PLAYER, WEAPON } from './config.js';
import { resolveCircle } from './city.js';
import { carRadius } from './vehicles.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    health: PLAYER.maxHealth,
    money: 0,
    onFoot: true,
    car: null,
    // Combat state.
    ammo: WEAPON.magSize,
    reloading: 0,
    punchTimer: 0,
    fireTimer: 0,
    lastHurt: -99,
    // Aim: the world point the mouse points at (on foot only).
    aimX: x,
    aimY: y - 100,
    dead: false,
    // Distance walked/driven, for the end-of-run stats.
    distance: 0,
  };
}

/** The nearest car the player can enter (within reach, not wrecked). */
export function nearestEnterableCar(player, cars) {
  let best = null;
  let bestD = 64;
  for (const car of cars) {
    if (car.dead || car.health <= 0) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Put the player into a car (stealing it if it had a driver). */
export function enterCar(player, car) {
  player.onFoot = false;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  const stolen = car.driver !== 'parked' && car.driver !== 'player';
  car.driver = 'player';
  return stolen;
}

/** Step out of the car beside its door, pushed clear of walls. */
export function exitCar(player, rects) {
  const car = player.car;
  if (!car) return;
  const side = { x: -Math.sin(car.angle), y: Math.cos(car.angle) };
  let px = car.x + side.x * (car.width / 2 + 22);
  let py = car.y + side.y * (car.width / 2 + 22);
  const fixed = resolveCircle(px, py, PLAYER.radius, rects);
  px = fixed.x;
  py = fixed.y;
  player.x = px;
  player.y = py;
  player.onFoot = true;
  player.car = null;
  car.driver = 'parked';
  car.speed = 0;
  car.slide = 0;
}

/** One step of on-foot movement. Returns the distance moved. */
export function stepOnFoot(player, move, sprinting, dt, rects, peds, cars) {
  const len = Math.hypot(move.x, move.y);
  if (len === 0) return 0;
  const speed = sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const nx = player.x + (move.x / len) * speed * dt;
  const ny = player.y + (move.y / len) * speed * dt;
  // Facing follows movement unless the player is aiming with the mouse.
  player.angle = Math.atan2(move.y, move.x);
  const fixed = resolveCircle(nx, ny, PLAYER.radius, rects);
  // Soft push away from cars and pedestrians (no standing inside them).
  let px = fixed.x;
  let py = fixed.y;
  for (const car of cars) {
    if (car.dead) continue;
    const dx = px - car.x;
    const dy = py - car.y;
    const d = Math.hypot(dx, dy);
    const min = carRadius(car) - 4 + PLAYER.radius;
    if (d > 0 && d < min) {
      px = car.x + (dx / d) * min;
      py = car.y + (dy / d) * min;
    }
  }
  for (const ped of peds) {
    const dx = px - ped.x;
    const dy = py - ped.y;
    const d = Math.hypot(dx, dy);
    if (d > 0 && d < 26) {
      px = ped.x + (dx / d) * 26;
      py = ped.y + (dy / d) * 26;
    }
  }
  const moved = Math.hypot(px - player.x, py - player.y);
  player.x = px;
  player.y = py;
  player.distance += moved;
  return moved;
}

/** Hurt the player; returns true when the damage kills them. */
export function hurtPlayer(player, amount, time) {
  if (player.dead) return false;
  player.health -= amount;
  player.lastHurt = time;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    return true;
  }
  return false;
}

/** Slow health recovery after a quiet spell. */
export function regenPlayer(player, dt, time) {
  if (player.dead) return;
  if (time - player.lastHurt > PLAYER.regenDelay && player.health < PLAYER.maxHealth) {
    player.health = Math.min(PLAYER.maxHealth, player.health + PLAYER.regen * dt);
  }
}

/** Draw Mara top-down: a body circle, a head, and a gun line when aiming. */
export function drawPlayer(ctx, player, time) {
  if (player.dead || !player.onFoot) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 14, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = '#2ecc71';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1e8449';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Head, offset toward the facing direction.
  const hx = Math.cos(player.angle) * 5;
  const hy = Math.sin(player.angle) * 5;
  ctx.fillStyle = '#f5cba7';
  ctx.beginPath();
  ctx.arc(hx, hy, 6, 0, Math.PI * 2);
  ctx.fill();
  // Hair.
  ctx.fillStyle = '#4a2c1a';
  ctx.beginPath();
  ctx.arc(hx - Math.cos(player.angle) * 2, hy - Math.sin(player.angle) * 2, 6, player.angle + 1.2, player.angle + Math.PI * 2 - 1.2);
  ctx.fill();
  // Gun: a short line toward the aim when the player has ammo.
  if (player.ammo > 0) {
    const aim = Math.atan2(player.aimY - player.y, player.aimX - player.x);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(aim) * 10, Math.sin(aim) * 10);
    ctx.lineTo(Math.cos(aim) * 22, Math.sin(aim) * 22);
    ctx.stroke();
  }
  // Punch swing: a quick arc when the punch timer is fresh.
  if (player.punchTimer > 0.2) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 24, player.angle - 0.7, player.angle + 0.7);
    ctx.stroke();
  }
  ctx.restore();
}
