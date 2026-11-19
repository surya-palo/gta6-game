// Boot and the one loop: the world advances in fixed 1/60 s steps (several
// in a slow frame, none in a fast one), input is read every frame, and the
// renderer paints what is there. The game moves between six screens: title,
// play, paused, busted, wasted and story complete.
//
// ?seed=N fixes the city and traffic. ?shot=chase|drive|foot|title (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createWorld, respawn, stepWorld } from './world.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { loadSave, storeSave } from './save.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

/** A silent stand-in for the audio system (screenshot mode has no gesture). */
const silentAudio = {
  unlock() {},
  toggleMute() { return true; },
  isMuted() { return true; },
  gunshot() {},
  punch() {},
  crash() {},
  pickup() {},
  missionDone() {},
  busted() {},
  wasted() {},
  engine() {},
  stopEngine() {},
  siren() {},
  stopSiren() {},
};

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const world = createWorld(seed, null, silentAudio);
  const renderer = createRenderer(canvas);
  world.viewW = renderer.view.width;
  world.viewH = renderer.view.height;
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const audio = createAudio();
  const save = loadSave();
  const world = createWorld(seed, save, audio);
  const renderer = createRenderer(canvas);
  const input = createInput(canvas);
  world.viewW = renderer.view.width;
  world.viewH = renderer.view.height;

  let screen = SCREEN_TITLE;
  let bustKind = 'busted';
  let accumulator = 0;
  let last = performance.now();
  let savedMissions = save ? save.missionsDone : 0;
  let savedMoney = save ? save.money : 0;

  function persist() {
    const missionsDone = world.missions.index;
    const money = world.player.money;
    if (missionsDone === savedMissions && money === savedMoney) return;
    savedMissions = missionsDone;
    savedMoney = money;
    storeSave({
      missionsDone,
      money,
      best: Math.max(save ? save.best : 0, money),
      completed: missionsDone >= 4,
    });
  }

  function beginPlay() {
    audio.unlock();
    screen = SCREEN_PLAY;
    announce('Playing Sunset Keys. Drive to Dario\'s garage to start the first job.');
  }

  function handleEvent(event) {
    if (event === 'busted' || event === 'wasted') {
      bustKind = event;
      world.bustFine = Math.min(world.player.money, event === 'busted' ? 250 : 150);
      screen = event === 'busted' ? SCREEN_BUSTED : SCREEN_WASTED;
      if (event === 'busted') audio.busted();
      else audio.wasted();
      announce(event === 'busted' ? 'Busted by the police.' : 'Wasted.');
    } else if (event === 'complete') {
      screen = SCREEN_COMPLETE;
      persist();
      announce('Story complete. All four jobs done.');
    }
  }

  function handleActions(actions) {
    const confirm = actions.includes('confirm');
    const pause = actions.includes('pause');
    if (screen === SCREEN_TITLE && confirm) {
      beginPlay();
    } else if (screen === SCREEN_PLAY && pause) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (screen === SCREEN_PAUSED && (pause || confirm)) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if ((screen === SCREEN_BUSTED || screen === SCREEN_WASTED) && confirm) {
      respawn(world, bustKind);
      persist();
      screen = SCREEN_PLAY;
      announce('Back on the streets.');
    } else if (screen === SCREEN_COMPLETE && confirm) {
      screen = SCREEN_PLAY;
      announce('Free roam. Palma Keys is yours.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_PLAY) {
      accumulator += dt;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        const event = stepWorld(world, STEP, input, actions);
        accumulator -= STEP;
        if (event) handleEvent(event);
      }
      if (screen === SCREEN_PLAY) persist();
    } else if (screen === SCREEN_TITLE) {
      // The title camera drifts; the world idles behind it.
      world.time += dt;
      world.titleCam.x = 1400 + Math.sin(world.time * 0.05) * 500;
      world.titleCam.y = 900 + Math.cos(world.time * 0.04) * 300;
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, save);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  // The view size feeds the camera clamp; keep it fresh.
  window.addEventListener('resize', () => {
    world.viewW = renderer.view.width;
    world.viewH = renderer.view.height;
  });

  announce('Sunset Keys. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
