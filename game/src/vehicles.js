// Vehicles: definitions, arcade car physics, spawning and collisions. A car
// has a heading, a forward speed and a lateral slide; steering bites harder
// the faster it goes, and grip bleeds the slide away so the car feels planted
// but can still drift when thrown hard into a turn.

import { VEHICLES } from './config.js';
import { resolveCircle, solidRects } from './city.js';

let nextId = 1;

export function makeCar(type, x, y, angle, rng, driver) {
  const def = VEHICLES[type];
  return {
    id: nextId++,
    type,
    name: def.name,
    x,
    y,
    angle,
    speed: 0,
    slide: 0,
    length: def.length,
    width: def.width,
    topSpeed: def.topSpeed,
    accel: def.accel,
    brake: def.brake,
    grip: def.grip,
    turn: def.turn,
    health: def.health,
    maxHealth: def.health,
    colour: rng.pick(def.colours),
    driver: driver || 'parked',
    // Traffic state: the road point the car is steering for.
    target: null,
    // Damage smoke once health is low.
    smoking: false,
    dead: false,
    // Seconds until this car can take crash damage again (a single shunt
    // must not drain the whole health bar while the cars stay touching).
    hitCooldown: 0,
  };
}

/** The radius used for circle collisions (roughly half the car's diagonal). */
export function carRadius(car) {
  return Math.hypot(car.length, car.width) / 2 - 6;
}

/**
 * One physics step for a car. `drive` is { throttle: -1..1, steer: -1..1 }.
 * Returns the distance travelled (for skid marks and speed effects).
 */
export function stepCar(car, drive, dt, rects) {
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const side = { x: -forward.y, y: forward.x };
  car.hitCooldown = Math.max(0, car.hitCooldown - dt);

  // Throttle and braking along the heading.
  if (drive.throttle > 0) car.speed += car.accel * drive.throttle * dt;
  else if (drive.throttle < 0) {
    if (car.speed > 5) car.speed -= car.brake * dt;
    else car.speed = Math.max(-car.topSpeed * 0.35, car.speed + car.accel * 0.6 * drive.throttle * dt);
  }
  // Drag and rolling resistance.
  car.speed -= car.speed * 0.35 * dt;
  if (Math.abs(car.speed) < 2 && drive.throttle === 0) car.speed = 0;
  car.speed = Math.max(-car.topSpeed * 0.35, Math.min(car.topSpeed, car.speed));

  // Steering: stronger with speed, reversed when reversing.
  const speedFactor = Math.min(1, Math.abs(car.speed) / 220);
  const steerDir = car.speed >= 0 ? 1 : -1;
  car.angle += drive.steer * car.turn * speedFactor * steerDir * dt;

  // Lateral slide: steering at speed throws the tail out; grip pulls it back.
  car.slide += -drive.steer * Math.abs(car.speed) * 0.35 * dt;
  car.slide -= car.slide * car.grip * dt;
  car.slide = Math.max(-160, Math.min(160, car.slide));

  const vx = forward.x * car.speed + side.x * car.slide;
  const vy = forward.y * car.speed + side.y * car.slide;
  const nx = car.x + vx * dt;
  const ny = car.y + vy * dt;
  const radius = carRadius(car);
  const fixed = resolveCircle(nx, ny, radius, rects);
  const hitWall = fixed.x !== nx || fixed.y !== ny;
  if (hitWall) {
    // A wall hit kills speed and slide, and dents the car (once per shunt,
    // not every frame the car grinds along the wall).
    const impact = Math.abs(car.speed) + Math.abs(car.slide);
    car.speed *= 0.35;
    car.slide *= 0.2;
    if (impact > 180 && car.hitCooldown <= 0) {
      car.health -= (impact - 180) / 22;
      car.hitCooldown = 0.5;
    }
    if (car.health <= 40) car.smoking = true;
  }
  car.x = fixed.x;
  car.y = fixed.y;
  return Math.hypot(vx, vy) * dt;
}

/** Circle-circle push-apart between two cars; returns the impact speed. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = carRadius(a) + carRadius(b) - 10;
  if (dist === 0 || dist >= min) return 0;
  const overlap = min - dist;
  const ux = dx / dist;
  const uy = dy / dist;
  a.x -= ux * overlap * 0.5;
  a.y -= uy * overlap * 0.5;
  b.x += ux * overlap * 0.5;
  b.y += uy * overlap * 0.5;
  const impact = Math.abs(a.speed - b.speed) + 60;
  a.speed *= 0.6;
  b.speed *= 0.6;
  // Damage is throttled: a shunt costs health once, not every frame the two
  // cars stay in contact.
  if (a.hitCooldown <= 0) {
    a.health -= impact / 30;
    a.hitCooldown = 0.5;
  }
  if (b.hitCooldown <= 0) {
    b.health -= impact / 30;
    b.hitCooldown = 0.5;
  }
  if (a.health <= 40) a.smoking = true;
  if (b.health <= 40) b.smoking = true;
  return impact;
}

/** Draw a car top-down: body, cabin, wheels and (for police) a light bar. */
export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const l = car.length;
  const w = car.width;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-l / 2 + 3, -w / 2 + 4, l, w);
  // Wheels.
  ctx.fillStyle = '#1a1a1a';
  const ww = 10;
  const wh = 5;
  ctx.fillRect(-l / 2 + 6, -w / 2 - 2, ww, wh);
  ctx.fillRect(-l / 2 + 6, w / 2 - 3, ww, wh);
  ctx.fillRect(l / 2 - 16, -w / 2 - 2, ww, wh);
  ctx.fillRect(l / 2 - 16, w / 2 - 3, ww, wh);
  // Body.
  ctx.fillStyle = car.colour;
  ctx.beginPath();
  ctx.roundRect(-l / 2, -w / 2, l, w, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Cabin: windshield and rear window.
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  ctx.fillRect(-l * 0.12, -w / 2 + 4, l * 0.22, w - 8);
  ctx.fillStyle = 'rgba(120,180,220,0.5)';
  ctx.fillRect(l * 0.12, -w / 2 + 5, 6, w - 10);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(l / 2 - 3, -w / 2 + 3, 3, 5);
  ctx.fillRect(l / 2 - 3, w / 2 - 8, 3, 5);
  // Taxi sign / police light bar.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-4, -6, 12, 12);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAXI', 2, 0);
  }
  if (car.type === 'police') {
    const flash = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d7bff';
    ctx.fillRect(-8, -w / 2 + 2, 16, 7);
    ctx.fillStyle = flash ? '#2d7bff' : '#ff2d2d';
    ctx.fillRect(-8, w / 2 - 9, 16, 7);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 0);
  }
  // Damage smoke is drawn by the effects system; a wreck darkens the body.
  if (car.health <= 25) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect(-l / 2, -w / 2, l, w, 8);
    ctx.fill();
  }
  ctx.restore();
}
