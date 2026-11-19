// Progress saved between visits in localStorage: missions finished, money
// earned, and the best single-session score. Everything is guarded — storage
// can be off (private windows) and a corrupt value must never break the game.

import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return { missionsDone: 0, money: 0, best: 0, completed: false };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    const save = defaultSave();
    if (Number.isInteger(data.missionsDone)) save.missionsDone = Math.max(0, Math.min(4, data.missionsDone));
    if (typeof data.money === 'number' && Number.isFinite(data.money)) save.money = Math.max(0, Math.floor(data.money));
    if (typeof data.best === 'number' && Number.isFinite(data.best)) save.best = Math.max(0, Math.floor(data.best));
    if (data.completed === true) save.completed = true;
    return save;
  } catch {
    return null;
  }
}

export function storeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear, or storage is unavailable.
  }
}
