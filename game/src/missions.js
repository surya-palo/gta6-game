// The story of Sunset Keys: Mara Reyes, a getaway driver paying off a debt
// to the fixer Dario Venn. Four missions in order, each a short chain of
// objectives. A mission starts at its "M" marker; finishing one unlocks the
// next and pays out. Getting busted or wasted fails the active mission.

import { MISSIONS, PLACES } from './config.js';
import { makeCar } from './vehicles.js';
import { spawnEnemy } from './combat.js';

export function createMissions(save) {
  return {
    index: save ? save.missionsDone : 0,
    active: null,
    stage: 0,
    state: 'idle', // idle | briefing | active | done | failed
    timer: 0,
    // Mission-specific spawned things, cleaned up on end.
    spawned: { car: null, enemies: [] },
  };
}

export function currentMission(missions) {
  if (missions.index >= MISSIONS.length) return null;
  return MISSIONS[missions.index];
}

/** The marker position for the mission's current stage (or the start marker). */
export function missionMarker(missions) {
  const m = currentMission(missions);
  if (!m) return null;
  if (missions.state === 'idle' || missions.state === 'briefing') {
    return { ...PLACES.garage, label: `Start: ${m.title}` };
  }
  const stage = m.stages[missions.stage];
  if (!stage) return null;
  const place = PLACES[stage.marker];
  return { ...place, label: stage.label };
}

export function missionObjective(missions) {
  const m = currentMission(missions);
  if (!m) return 'Story complete — Palma Keys is yours. Free roam!';
  if (missions.state === 'idle') return `Go to ${PLACES.garage.label} to start "${m.title}" (press M nearby)`;
  if (missions.state === 'briefing') return m.briefing;
  if (missions.state === 'done') return `"${m.title}" complete! +$${m.reward}`;
  if (missions.state === 'failed') return `"${m.title}" failed — drive back to ${PLACES.garage.label} to retry.`;
  const stage = m.stages[missions.stage];
  return stage ? stage.label : '';
}

/** Can the player start the next mission from here? */
export function canStartMission(missions, player) {
  const m = currentMission(missions);
  if (!m || missions.state !== 'idle') return false;
  return Math.hypot(player.x - PLACES.garage.x, player.y - PLACES.garage.y) < 160;
}

export function startMission(missions, world) {
  const m = currentMission(missions);
  if (!m) return;
  missions.active = m;
  missions.stage = 0;
  missions.state = 'active';
  missions.spawned = { car: null, enemies: [] };
  world.message(`${m.giver}: ${m.briefing}`, 6);
  // Mission-specific setup.
  if (m.id === 'hot-wheels') {
    const car = makeCar('sports', PLACES.marina.x, PLACES.marina.y, 0, world.rng, 'parked');
    car.colour = '#e74c3c';
    world.traffic.cars.push(car);
    missions.spawned.car = car;
  }
  if (m.id === 'big-score') {
    for (const [dx, dy] of [[-60, -40], [60, 30]]) {
      const e = spawnEnemy(world.combat, PLACES.bank.x + dx, PLACES.bank.y + dy, 'guard');
      missions.spawned.enemies.push(e);
    }
  }
  world.audio.pickup();
}

function endMission(missions, world, ok) {
  const m = missions.active;
  missions.state = ok ? 'done' : 'failed';
  missions.active = null;
  if (ok && m) {
    world.player.money += m.reward;
    missions.index += 1;
    world.audio.missionDone();
    world.message(`Mission complete: ${m.title} — +$${m.reward}`, 5);
    if (missions.index >= MISSIONS.length) {
      world.message('STORY COMPLETE — you own Palma Keys now.', 6);
    }
  } else {
    world.message('Mission failed.', 4);
  }
  // Clean up spawned things.
  if (missions.spawned.car) {
    const i = world.traffic.cars.indexOf(missions.spawned.car);
    if (i >= 0 && missions.spawned.car.driver !== 'player') world.traffic.cars.splice(i, 1);
  }
  for (const e of missions.spawned.enemies) e.dead = true;
  missions.spawned = { car: null, enemies: [] };
  // Back to idle after a beat so the player can retry or start the next one.
  missions.timer = 2.5;
}

/** One step of the mission state machine. */
export function stepMissions(missions, world, dt) {
  if (missions.timer > 0) {
    missions.timer -= dt;
    if (missions.timer <= 0 && (missions.state === 'done' || missions.state === 'failed')) {
      missions.state = 'idle';
    }
    return;
  }
  if (missions.state !== 'active' || !missions.active) return;
  const m = missions.active;
  const stage = m.stages[missions.stage];
  if (!stage) {
    endMission(missions, world, true);
    return;
  }
  const player = world.player;
  const place = PLACES[stage.marker];
  const dist = Math.hypot(player.x - place.x, player.y - place.y);

  if (stage.kind === 'goto') {
    if (dist < 70) {
      missions.stage += 1;
      world.audio.pickup();
      if (missions.stage < m.stages.length) {
        world.message(m.stages[missions.stage].label, 4);
      } else {
        endMission(missions, world, true);
      }
    }
  } else if (stage.kind === 'steal') {
    // Complete when the player is driving the spawned sports car.
    const car = missions.spawned.car;
    if (car && !player.onFoot && player.car === car) {
      missions.stage += 1;
      world.message('Got it — now lose the cops and reach the chop shop.', 4);
    }
  } else if (stage.kind === 'grab') {
    // Complete when the bank guards are down and the player is at the bank.
    const guardsLeft = missions.spawned.enemies.filter((e) => !e.dead).length;
    if (guardsLeft === 0 && dist < 90) {
      missions.stage += 1;
      world.message('Cash grabbed — escape to the safehouse!', 4);
      world.police.wanted = Math.max(world.police.wanted, 3);
    } else if (guardsLeft > 0 && dist < 200) {
      world.hint = `Guards left: ${guardsLeft}`;
    }
  }
}

/** Fail the active mission (busted / wasted). */
export function failMission(missions, world) {
  if (missions.state === 'active') endMission(missions, world, false);
}
