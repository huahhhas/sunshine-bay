// Keyboard and mouse. Held keys are read every frame; one-shot presses (confirm, pause,
// steal, reload) are queued as bit flags and taken once, so a press between two frames is
// never lost and never counted twice. Dragging the mouse orbits the camera; the wheel zooms.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_RELOAD = 8;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const RELOAD = new Set(['KeyR']);

export function createInput(canvas, callbacks) {
  const keys = new Set();
  let actions = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let shootQueued = false;
  let shootX = 0;
  let shootY = 0;

  window.addEventListener('keydown', (event) => {
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      keys.add(event.code);
    } else if (RUN.has(event.code)) {
      keys.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (RELOAD.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RELOAD;
    } else {
      return;
    }
    if (event.code !== 'Escape') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    dragging = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    callbacks.unlockAudio();
    if (event.button === 0) {
      shootQueued = true;
      shootX = event.clientX;
      shootY = event.clientY;
    }
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    callbacks.orbit(event.clientX - lastX, event.clientY - lastY);
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    callbacks.zoom(Math.sign(event.deltaY));
  }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function hasAny(set) {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  }

  return {
    /** Forward/back and left/right as -1, 0 or 1, in camera space (set by the caller). */
    move() {
      const f = (hasAny(FORWARD) ? 1 : 0) - (hasAny(BACK) ? 1 : 0);
      const s = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      return { f, s, run: hasAny(RUN) };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeShoot() {
      if (!shootQueued) return null;
      shootQueued = false;
      return { x: shootX, y: shootY };
    },
  };
}
