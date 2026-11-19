// Combat: the player's pistol and fists, bullets with tracers, and the
// enemies who shoot back (bank guards, rival crew). Enemies are simple —
// they see the player, close to range, and fire with a human-ish cadence.

import { PLAYER, WEAPON } from './config.js';
import { resolveCircle } from './city.js';
import { muzzle, sparks } from './effects.js';

export function createCombat() {
  return { bullets: [], enemies: [] };
}

export function spawnEnemy(combat, x, y, kind) {
  const enemy = {
    x, y,
    angle: 0,
    health: kind === 'guard' ? 60 : 40,
    kind,
    fireTimer: 0.5 + Math.random(),
    speed: kind === 'guard' ? 170 : 200,
    dead: false,
  };
  combat.enemies.push(enemy);
  return enemy;
}

/** Fire the player's pistol toward (tx, ty). Returns 'shot' | 'empty' | 'reloading'. */
export function playerShoot(combat, player, tx, ty, fx, audio) {
  if (player.reloading > 0) return 'reloading';
  if (player.fireTimer > 0) return 'cooldown';
  if (player.ammo <= 0) return 'empty';
  player.ammo -= 1;
  player.fireTimer = WEAPON.fireCooldown;
  const base = Math.atan2(ty - player.y, tx - player.x);
  const angle = base + (Math.random() - 0.5) * 2 * WEAPON.spread;
  combat.bullets.push({
    x: player.x + Math.cos(angle) * 20,
    y: player.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * WEAPON.bulletSpeed,
    vy: Math.sin(angle) * WEAPON.bulletSpeed,
    from: 'player',
    damage: WEAPON.damage,
    travelled: 0,
    range: WEAPON.range,
  });
  muzzle(fx, player.x, player.y, angle);
  audio.gunshot();
  return 'shot';
}

/** A punch: hits the nearest enemy or pedestrian in front of the player. */
export function playerPunch(combat, player, peds, fx, audio) {
  if (player.punchTimer > 0) return null;
  player.punchTimer = PLAYER.punchCooldown;
  audio.punch();
  const fx0 = Math.cos(player.angle);
  const fy = Math.sin(player.angle);
  let best = null;
  let bestD = PLAYER.punchRange;
  for (const e of combat.enemies) {
    if (e.dead) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d = Math.hypot(dx, dy);
    const facing = (dx * fx0 + dy * fy) / (d || 1);
    if (d < bestD && facing > 0.3) {
      best = e;
      bestD = d;
    }
  }
  if (best) {
    best.health -= PLAYER.punchDamage;
    sparks(fx, best.x, best.y, 6);
    if (best.health <= 0) best.dead = true;
    return best;
  }
  for (const ped of peds) {
    const dx = ped.x - player.x;
    const dy = ped.y - player.y;
    const d = Math.hypot(dx, dy);
    const facing = (dx * fx0 + dy * fy) / (d || 1);
    if (d < PLAYER.punchRange && facing > 0.3) {
      ped.flee = 4;
      ped.fleeX = player.x;
      ped.fleeY = player.y;
      return ped;
    }
  }
  return null;
}

function bulletHitsRect(bx, by, rects) {
  for (const r of rects) {
    if (bx >= r.x && bx <= r.x + r.w && by >= r.y && by <= r.y + r.h) return true;
  }
  return false;
}

/**
 * Step bullets and enemies. `hit` callbacks report what a bullet struck:
 * onPlayerHit(damage), onEnemyHit(enemy), onPedHit(ped), onCarHit(car).
 */
export function stepCombat(combat, world, dt, hooks) {
  const { player, fx, rects } = world;
  player.fireTimer = Math.max(0, player.fireTimer - dt);
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) {
      player.ammo = WEAPON.magSize;
      world.message('Reloaded.');
    }
  }

  for (let i = combat.bullets.length - 1; i >= 0; i -= 1) {
    const b = combat.bullets[i];
    const step = Math.hypot(b.vx, b.vy) * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += step;
    let gone = b.travelled > b.range;
    if (!gone && bulletHitsRect(b.x, b.y, rects)) {
      sparks(fx, b.x, b.y, 4);
      gone = true;
    }
    if (!gone && b.from === 'player') {
      for (const e of combat.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < 14) {
          e.health -= b.damage;
          sparks(fx, e.x, e.y, 6);
          if (e.health <= 0) {
            e.dead = true;
            hooks.onEnemyKilled && hooks.onEnemyKilled(e);
          }
          gone = true;
          break;
        }
      }
    }
    if (!gone && b.from === 'player') {
      for (const ped of world.traffic.peds) {
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
          hooks.onPedHit && hooks.onPedHit(ped);
          gone = true;
          break;
        }
      }
    }
    if (!gone && b.from === 'player') {
      for (const car of world.allCars()) {
        if (car.dead) continue;
        const dx = b.x - car.x;
        const dy = b.y - car.y;
        if (Math.hypot(dx, dy) < 26) {
          car.health -= b.damage;
          sparks(fx, b.x, b.y, 5);
          if (car.health <= 40) car.smoking = true;
          hooks.onCarHit && hooks.onCarHit(car);
          gone = true;
          break;
        }
      }
    }
    if (!gone && b.from === 'enemy') {
      if (player.onFoot && Math.hypot(player.x - b.x, player.y - b.y) < 14) {
        hooks.onPlayerHit && hooks.onPlayerHit(b.damage);
        gone = true;
      } else if (!player.onFoot && player.car && Math.hypot(player.car.x - b.x, player.car.y - b.y) < 28) {
        player.car.health -= b.damage;
        sparks(fx, b.x, b.y, 4);
        gone = true;
      }
    }
    if (gone) combat.bullets.splice(i, 1);
  }

  // Enemies: close to range, then fire on a cadence.
  for (const e of combat.enemies) {
    if (e.dead) continue;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dy, dx);
    if (d > 320) {
      const nx = e.x + (dx / d) * e.speed * dt;
      const ny = e.y + (dy / d) * e.speed * dt;
      const fixed = resolveCircle(nx, ny, 11, rects);
      e.x = fixed.x;
      e.y = fixed.y;
    }
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && d < 480 && player.onFoot) {
      e.fireTimer = 0.7 + Math.random() * 0.6;
      const angle = e.angle + (Math.random() - 0.5) * 0.12;
      combat.bullets.push({
        x: e.x + Math.cos(angle) * 18,
        y: e.y + Math.sin(angle) * 18,
        vx: Math.cos(angle) * 780,
        vy: Math.sin(angle) * 780,
        from: 'enemy',
        damage: 9,
        travelled: 0,
        range: 500,
      });
      muzzle(fx, e.x, e.y, angle);
      world.audio.gunshot();
    }
  }
  combat.enemies = combat.enemies.filter((e) => !e.dead || Math.hypot(e.x - player.x, e.y - player.y) < 400);
}

export function drawBullets(ctx, combat) {
  ctx.save();
  ctx.strokeStyle = '#ffe066';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const b of combat.bullets) {
    const len = 14;
    const d = Math.hypot(b.vx, b.vy) || 1;
    ctx.beginPath();
    ctx.moveTo(b.x - (b.vx / d) * len, b.y - (b.vy / d) * len);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawEnemy(ctx, e) {
  if (e.dead) return;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.kind === 'guard' ? '#5b3a1e' : '#7b241c';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#00000055';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f5cba7';
  ctx.beginPath();
  ctx.arc(Math.cos(e.angle) * 4, Math.sin(e.angle) * 4, 5, 0, Math.PI * 2);
  ctx.fill();
  // Gun.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(Math.cos(e.angle) * 8, Math.sin(e.angle) * 8);
  ctx.lineTo(Math.cos(e.angle) * 20, Math.sin(e.angle) * 20);
  ctx.stroke();
  // Health bar.
  const max = e.kind === 'guard' ? 60 : 40;
  ctx.fillStyle = '#00000088';
  ctx.fillRect(-12, -22, 24, 4);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(-12, -22, 24 * Math.max(0, e.health / max), 4);
  ctx.restore();
}
