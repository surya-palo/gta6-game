// The world: all the systems in one state, advanced by one fixed step. The
// loop calls step(dt, input) with the player's input; step returns an event
// ('busted', 'wasted', 'complete' or '') for the screens to react to. Nothing
// here draws or touches the DOM except through the audio object it is given.

import { MESSAGE_TIME, PLAYER, POLICE, TRAFFIC, WORLD } from './config.js';
import { buildCity, isWater, solidRects } from './city.js';
import { createRandom } from './random.js';
import { createPlayer, enterCar, exitCar, hurtPlayer, nearestEnterableCar, regenPlayer, stepOnFoot } from './player.js';
import { collideCars, stepCar } from './vehicles.js';
import { createTraffic, scarePeds, spawnPed, spawnTrafficCar, stepPeds, stepTrafficCars } from './traffic.js';
import { clearWanted, commitCrime, createPolice, stepPolice } from './police.js';
import { createCombat, playerPunch, playerShoot, stepCombat } from './combat.js';
import { canStartMission, createMissions, failMission, missionMarker, startMission, stepMissions } from './missions.js';
import { addShake, burst, createEffects, explosion, floatText, smokePuff, sparks, stepEffects } from './effects.js';

export function createWorld(seed, save, audio) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const rects = solidRects(city);
  const world = {
    seed,
    rng,
    city,
    rects,
    audio,
    time: 0,
    player: null,
    traffic: null,
    police: null,
    combat: null,
    missions: null,
    fx: createEffects(),
    camera: { x: 0, y: 0 },
    titleCam: { x: 600, y: 600 },
    viewW: 1280,
    viewH: 720,
    msgText: '',
    msgTime: 0,
    hint: '',
    bustFine: 0,
    lastShotCrime: -99,
    lastPedCrime: -99,
  };

  world.message = function message(text, seconds) {
    world.msgText = text;
    world.msgTime = seconds || MESSAGE_TIME;
  };

  world.allCars = function allCars() {
    // The player's car lives in traffic.cars too (it was stolen from there),
    // so deduplicate: each car exactly once.
    const seen = new Set();
    const out = [];
    for (const car of [...world.traffic.cars, ...world.police.cars]) {
      if (!seen.has(car.id)) {
        seen.add(car.id);
        out.push(car);
      }
    }
    if (world.player.car && !seen.has(world.player.car.id)) out.push(world.player.car);
    return out;
  };

  world.reset = function reset(saveState) {
    world.rng = createRandom(seed);
    world.city = buildCity(world.rng);
    world.rects = solidRects(world.city);
    world.time = 0;
    world.fx = createEffects();
    world.msgText = '';
    world.msgTime = 0;
    world.hint = '';
    world.bustFine = 0;
    // Mara starts on foot outside Dario's garage.
    world.player = createPlayer(600, 500);
    if (saveState) world.player.money = saveState.money || 0;
    world.traffic = createTraffic(world.rng);
    world.police = createPolice();
    world.combat = createCombat();
    world.missions = createMissions(saveState);
    for (let i = 0; i < TRAFFIC.cars; i += 1) spawnTrafficCar(world.traffic, world.rng, 600, 500);
    for (let i = 0; i < TRAFFIC.peds; i += 1) spawnPed(world.traffic, world.rng, 600, 500);
    // A parked car near the start so the player can drive right away.
    const starter = world.traffic.cars[0];
    if (starter) {
      starter.x = 660;
      starter.y = 480;
      starter.driver = 'parked';
      starter.speed = 0;
    }
    world.camera.x = world.player.x - world.viewW / 2;
    world.camera.y = world.player.y - world.viewH / 2;
    world.titleCam = { x: 600, y: 600 };
  };

  world.reset(save);
  return world;
}

function wreckCar(world, car) {
  if (car.dead) return;
  car.dead = true;
  car.speed = 0;
  explosion(world.fx, car.x, car.y);
  world.audio.crash(1);
  if (world.player.car === car) {
    // The player's car blew up under them: out on foot, hurt.
    world.player.car = null;
    world.player.onFoot = true;
    hurtPlayer(world.player, 25, world.time);
    world.message('Your car is wrecked!');
  }
}

export function stepWorld(world, dt, input, actions) {
  const { player, traffic, police, combat, missions, fx, audio } = world;
  world.time += dt;
  world.msgTime = Math.max(0, world.msgTime - dt);
  world.hint = '';
  let event = '';

  // Mouse aim in world coordinates (on foot).
  const mouse = input.mouse();
  player.aimX = world.camera.x + mouse.x;
  player.aimY = world.camera.y + mouse.y;

  // One-shot actions: the caller hands them over (it takes them once per
  // frame so screen transitions and gameplay share the same presses).
  const acts = actions || input.takeActions();
  for (const action of acts) {
    if (action === 'enterCar') {
      if (player.onFoot) {
        const car = nearestEnterableCar(player, world.allCars());
        if (car) {
          const hadDriver = car.driver !== 'parked' && car.driver !== 'player';
          enterCar(player, car);
          audio.pickup();
          if (hadDriver) {
            commitCrime(police, 'steal');
            world.message('Car stolen — the driver called the cops!');
            scarePeds(traffic, player.x, player.y, 200);
          }
        } else {
          world.message('No car nearby — get closer to one.');
        }
      } else {
        exitCar(player, world.rects);
      }
    } else if (action === 'punch' && player.onFoot) {
      playerPunch(combat, player, traffic.peds, fx, audio);
    } else if (action === 'shoot' && player.onFoot) {
      const result = playerShoot(combat, player, player.aimX, player.aimY, fx, audio);
      if (result === 'shot') {
        if (world.time - world.lastShotCrime > 5) {
          world.lastShotCrime = world.time;
          commitCrime(police, 'shoot');
        }
        scarePeds(traffic, player.x, player.y, 300);
      } else if (result === 'empty') {
        world.message('Out of ammo — press R to reload.');
      }
    } else if (action === 'reload' && player.onFoot) {
      if (player.ammo < 12 && player.reloading <= 0) {
        player.reloading = 1.1;
        world.message('Reloading…');
      }
    } else if (action === 'mission') {
      if (canStartMission(missions, player)) {
        startMission(missions, world);
      } else if (missions.state === 'idle') {
        world.message('Drive to Dario\'s garage to start the next job.');
      }
    } else if (action === 'mute') {
      const muted = audio.toggleMute();
      world.message(muted ? 'Sound off.' : 'Sound on.');
    }
  }

  // Player movement.
  if (player.onFoot) {
    const move = input.move();
    // Facing follows the mouse while aiming (shoot held or mouse moved lately).
    stepOnFoot(player, move, input.sprinting(), dt, world.rects, traffic.peds, world.allCars());
    if (Math.hypot(player.aimX - player.x, player.aimY - player.y) > 30) {
      player.angle = Math.atan2(player.aimY - player.y, player.aimX - player.x);
    }
    // Water stops a walker.
    if (isWater(player.x, player.y)) {
      player.y -= 40 * dt * 10;
    }
  } else if (player.car) {
    const car = player.car;
    const healthBefore = car.health;
    const speedBefore = Math.abs(car.speed);
    stepCar(car, { throttle: (input.throttle() ? 1 : 0) - (input.brake() ? 1 : 0), steer: input.steer() }, dt, world.rects);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.distance += Math.abs(car.speed) * dt;
    // Crash feedback.
    if (car.health < healthBefore - 3) {
      const impact = speedBefore;
      audio.crash(impact / 500);
      addShake(fx, Math.min(10, impact / 60));
      sparks(fx, car.x, car.y, 8);
    }
    // Skid marks when sliding hard.
    if (Math.abs(car.slide) > 90 && Math.abs(car.speed) > 200 && Math.random() < dt * 20) {
      const bx = car.x - Math.cos(car.angle) * car.length * 0.35;
      const by = car.y - Math.sin(car.angle) * car.length * 0.35;
      fx.skids.push({ x: bx, y: by, angle: car.angle, life: 6 });
    }
    // Smoking wreck.
    if (car.smoking && Math.random() < dt * 8) smokePuff(fx, car.x, car.y - 6);
    if (car.health <= 0) wreckCar(world, car);
  }

  // Traffic.
  stepTrafficCars(traffic, world.rng, dt, world.rects, traffic.peds, fx);
  stepPeds(traffic, world.rng, dt, world.rects);
  // Keep the streets populated.
  if (traffic.cars.length < TRAFFIC.cars && Math.random() < dt * 0.5) {
    spawnTrafficCar(traffic, world.rng, player.x, player.y);
  }
  if (traffic.peds.length < TRAFFIC.peds && Math.random() < dt * 0.8) {
    spawnPed(traffic, world.rng, player.x, player.y);
  }

  // Collisions: player's car vs traffic and police; police vs traffic.
  if (!player.onFoot && player.car) {
    for (const other of traffic.cars) {
      if (other === player.car || other.dead) continue;
      const impact = collideCars(player.car, other);
      if (impact > 140) {
        audio.crash(impact / 400);
        addShake(fx, 4);
        sparks(fx, (player.car.x + other.x) / 2, (player.car.y + other.y) / 2, 8);
      }
    }
    for (const cop of police.cars) {
      if (cop.dead) continue;
      const impact = collideCars(player.car, cop);
      if (impact > 140) {
        audio.crash(impact / 400);
        addShake(fx, 4);
        commitCrime(police, 'hitCop');
      }
    }
    // Running over a pedestrian.
    for (let i = traffic.peds.length - 1; i >= 0; i -= 1) {
      const ped = traffic.peds[i];
      if (Math.hypot(ped.x - player.car.x, ped.y - player.car.y) < 26 && Math.abs(player.car.speed) > 80) {
        traffic.peds.splice(i, 1);
        burst(fx, ped.x, ped.y, '#e74c3c', 10, 200, 0.5, 4);
        if (world.time - world.lastPedCrime > 4) {
          world.lastPedCrime = world.time;
          commitCrime(police, 'hitPed');
          world.message('You hit a pedestrian!');
        }
        scarePeds(traffic, ped.x, ped.y, 300);
      }
    }
  }
  for (const cop of police.cars) {
    if (cop.dead) continue;
    for (const other of traffic.cars) {
      if (other.dead) continue;
      collideCars(cop, other);
    }
  }
  // Wrecked traffic cars burn out.
  for (const car of [...traffic.cars, ...police.cars]) {
    if (!car.dead && car.health <= 0) wreckCar(world, car);
  }
  world.traffic.cars = traffic.cars.filter((c) => !c.dead || Math.hypot(c.x - player.x, c.y - player.y) < 600);

  // Police.
  const policeEvent = stepPolice(police, world, dt);
  if (policeEvent === 'busted') event = 'busted';

  // Combat.
  stepCombat(combat, world, dt, {
    onPlayerHit(damage) {
      if (hurtPlayer(player, damage, world.time)) event = 'wasted';
    },
    onEnemyKilled() {
      player.money += 25;
      floatText(fx, player.x, player.y - 30, '+$25', '#7dff8a');
    },
    onPedHit(ped) {
      const i = traffic.peds.indexOf(ped);
      if (i >= 0) traffic.peds.splice(i, 1);
      commitCrime(police, 'killPed');
      world.message('You shot a pedestrian!');
      scarePeds(traffic, ped.x, ped.y, 350);
    },
    onCarHit(car) {
      if (car.type === 'police') commitCrime(police, 'hitCop');
    },
  });

  // Missions.
  const missionsBefore = missions.index;
  stepMissions(missions, world, dt);
  if (missions.index >= 4 && missionsBefore < 4) event = 'complete';

  // Health regen, effects, camera.
  regenPlayer(player, dt, world.time);
  stepEffects(fx, dt);

  // Camera follows the player, clamped to the world.
  const tx = Math.max(0, Math.min(WORLD.width - world.viewW, player.x - world.viewW / 2));
  const ty = Math.max(0, Math.min(WORLD.height - world.viewH, player.y - world.viewH / 2));
  const k = 1 - Math.pow(0.001, dt);
  world.camera.x += (tx - world.camera.x) * k;
  world.camera.y += (ty - world.camera.y) * k;

  // Title screen camera: a slow drift across downtown.
  world.titleCam.x = 1400 + Math.sin(world.time * 0.05) * 500;
  world.titleCam.y = 900 + Math.cos(world.time * 0.04) * 300;

  // Engine and siren audio.
  const driving = !player.onFoot && player.car;
  audio.engine(driving ? Math.abs(player.car.speed) / player.car.topSpeed : 0, driving);
  audio.siren(police.wanted > 0 && police.cars.length > 0, dt);

  return event;
}

/** Respawn after busted/wasted: hospital or police station, with a fine. */
export function respawn(world, kind) {
  const { player, police, combat } = world;
  // The fine was set when the event fired (so the screen could show it);
  // fall back to computing it if this is ever called on its own.
  const fine = world.bustFine > 0 ? world.bustFine : Math.min(player.money, kind === 'busted' ? 250 : 150);
  player.money -= fine;
  world.bustFine = fine;
  player.health = PLAYER.maxHealth;
  player.dead = false;
  player.ammo = 12;
  player.reloading = 0;
  clearWanted(police);
  police.cars = [];
  police.officers = [];
  combat.bullets = [];
  for (const e of combat.enemies) e.dead = true;
  combat.enemies = [];
  if (player.car) {
    player.car.driver = 'parked';
    player.car = null;
  }
  player.onFoot = true;
  const spot = kind === 'busted' ? { x: 2600, y: 500 } : { x: 1000, y: 1700 };
  player.x = spot.x;
  player.y = spot.y;
  player.angle = -Math.PI / 2;
  world.camera.x = player.x - world.viewW / 2;
  world.camera.y = player.y - world.viewH / 2;
  failMission(world.missions, world);
}
