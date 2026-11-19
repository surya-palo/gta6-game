// Keyboard and mouse input for Sunset Keys. Held keys are read every frame for
// movement and driving; one-shot presses (enter car, shoot, pause, mission
// start, mute) are queued as named actions and taken once by the loop, so a
// press between two frames is never lost and never counted twice.

/** One-shot actions, queued by key presses and mouse clicks. */
export const ACT = {
  CONFIRM: 'confirm',
  PAUSE: 'pause',
  ENTER_CAR: 'enterCar',
  PUNCH: 'punch',
  SHOOT: 'shoot',
  RELOAD: 'reload',
  MISSION: 'mission',
  MUTE: 'mute',
  SPRINT: 'sprint',
};

const MOVE_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
  'ShiftLeft', 'ShiftRight',
]);

const ACTION_KEYS = {
  Enter: ACT.CONFIRM,
  Space: ACT.PUNCH,
  KeyE: ACT.ENTER_CAR,
  KeyF: ACT.SHOOT,
  KeyR: ACT.RELOAD,
  KeyM: ACT.MISSION,
  KeyN: ACT.MUTE,
  KeyP: ACT.PAUSE,
  Escape: ACT.PAUSE,
};

export function createInput(canvas) {
  const held = new Set();
  const queue = [];
  const mouse = { x: 0, y: 0, down: false, worldX: 0, worldY: 0 };

  function onKeyDown(event) {
    if (MOVE_KEYS.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    const action = ACTION_KEYS[event.code];
    if (action && !event.repeat) {
      queue.push(action);
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onBlur() {
    held.clear();
    mouse.down = false;
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    mouse.down = true;
    onMouseMove(event);
    if (event.button === 0) queue.push(ACT.SHOOT);
    if (event.button === 2) queue.push(ACT.PUNCH);
  }

  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** The movement vector from held keys: {x: -1..1, y: -1..1}. */
    move() {
      const left = held.has('KeyA') || held.has('ArrowLeft');
      const right = held.has('KeyD') || held.has('ArrowRight');
      const up = held.has('KeyW') || held.has('ArrowUp');
      const down = held.has('KeyS') || held.has('ArrowDown');
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    /** True while either Shift key is held (sprint on foot). */
    sprinting() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** True while W/Up is held (throttle when driving). */
    throttle() {
      return held.has('KeyW') || held.has('ArrowUp');
    },
    /** True while S/Down is held (brake/reverse when driving). */
    brake() {
      return held.has('KeyS') || held.has('ArrowDown');
    },
    /** -1, 0 or 1 from the held steering keys. */
    steer() {
      const left = held.has('KeyA') || held.has('ArrowLeft');
      const right = held.has('KeyD') || held.has('ArrowRight');
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** The mouse position in canvas pixels, and the world point it aims at. */
    mouse() {
      return mouse;
    },
    /** Update the world point the mouse aims at (call after the camera moves). */
    setMouseWorld(x, y) {
      mouse.worldX = x;
      mouse.worldY = y;
    },
    /** The queued one-shot actions since the last call, in order. */
    takeActions() {
      const taken = queue.splice(0, queue.length);
      return taken;
    },
  };
}
