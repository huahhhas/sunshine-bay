// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. The game moves between title, play, paused,
// wasted, busted and story-complete screens; the save lives in localStorage.
//
// ?seed=N fixes the city. ?shot=start|play|chase|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createSound } from './audio.js';
import { createGame } from './world.js';
import { createRenderer } from './render.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE, ACTION_RELOAD, createInput } from './input.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const sound = createSound();
const game = createGame(createRandom(seed));
const renderer = createRenderer(game);
const input = createInput(canvas, {
  unlockAudio() {
    sound.unlock();
  },
  orbit(dx, dy) {
    renderer.addYaw(-dx * 0.005);
    renderer.addPitch(dy * 0.004);
  },
  zoom(direction) {
    renderer.addZoom(direction * 1.5);
  },
});

function announce(message) {
  status.textContent = message;
}

function updateSoundButton() {
  const btn = document.getElementById('btn-sound');
  btn.textContent = sound.muted ? 'Sound: off' : 'Sound: on';
}

function startPlaying() {
  sound.unlock();
  sound.startMusic();
  renderer.clearFixed();
  renderer.snapCamera();
  renderer.showScreen(null);
  announce('Playing. Follow the mission on the screen.');
}

function quitToTitle() {
  game.saveGame();
  game.state.mode = 'title';
  renderer.showScreen('title');
  document.getElementById('btn-continue').classList.toggle('hidden', !game.saveData);
  announce('Sunshine Bay. Press New game or Continue.');
}

function runShot(name) {
  const scene = stageShot(name, game, renderer);
  let painted = 0;
  function paint() {
    renderer.draw(STEP);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  announce(`Sunshine Bay screenshot: ${scene.screen}.`);
  requestAnimationFrame(paint);
}

function runGame() {
  let lastMode = 'title';
  let accumulator = 0;
  let last = performance.now();

  document.getElementById('btn-new').addEventListener('click', () => {
    sound.click();
    game.newGame();
    startPlaying();
  });
  document.getElementById('btn-continue').addEventListener('click', () => {
    sound.click();
    game.continueGame();
    startPlaying();
  });
  document.getElementById('btn-sound').addEventListener('click', () => {
    sound.unlock();
    sound.setMuted(!sound.muted);
    updateSoundButton();
  });
  document.getElementById('btn-resume').addEventListener('click', () => {
    sound.click();
    game.state.mode = 'play';
    startPlaying();
  });
  document.getElementById('btn-restart').addEventListener('click', () => {
    sound.click();
    game.newGame();
    startPlaying();
  });
  document.getElementById('btn-quit').addEventListener('click', () => {
    sound.click();
    quitToTitle();
  });
  document.getElementById('btn-retry').addEventListener('click', () => {
    sound.click();
    game.resetToMissionStart();
    startPlaying();
  });
  document.getElementById('btn-retry2').addEventListener('click', () => {
    sound.click();
    game.resetToMissionStart();
    startPlaying();
  });
  document.getElementById('btn-quit2').addEventListener('click', () => {
    sound.click();
    quitToTitle();
  });
  document.getElementById('btn-quit3').addEventListener('click', () => {
    sound.click();
    quitToTitle();
  });
  document.getElementById('btn-again').addEventListener('click', () => {
    sound.click();
    game.newGame();
    startPlaying();
  });
  document.getElementById('btn-quit4').addEventListener('click', () => {
    sound.click();
    quitToTitle();
  });

  document.getElementById('btn-continue').classList.toggle('hidden', !game.saveData);
  updateSoundButton();
  renderer.showScreen('title');
  announce('Sunshine Bay. Press New game or Continue.');

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state.mode === 'play') {
      game.saveGame();
      game.state.mode = 'paused';
      renderer.showScreen('paused');
      announce('Paused.');
    }
  });

  function handleActions() {
    const actions = input.takeActions();
    const mode = game.state.mode;
    if (actions & ACTION_CONFIRM) {
      if (mode === 'title') {
        game.newGame();
        startPlaying();
      } else if (mode === 'paused') {
        game.state.mode = 'play';
        startPlaying();
      } else if (mode === 'over' || mode === 'busted') {
        game.resetToMissionStart();
        startPlaying();
      } else if (mode === 'complete') {
        game.newGame();
        startPlaying();
      } else if (mode === 'play' && !game.player.onFoot) {
        sound.click();
      }
    }
    if (actions & ACTION_PAUSE) {
      if (mode === 'play') {
        game.saveGame();
        game.state.mode = 'paused';
        renderer.showScreen('paused');
        announce('Paused.');
      } else if (mode === 'paused') {
        game.state.mode = 'play';
        startPlaying();
      }
    }
    return actions;
  }

  function drainEvents() {
    for (const event of game.takeEvents()) {
      if (event.kind === 'shot') sound.shot();
      else if (event.kind === 'crash') sound.crash();
      else if (event.kind === 'pickup') sound.pickup();
      else if (event.kind === 'jingle') sound.jingle();
      else if (event.kind === 'busted') sound.busted();
      else if (event.kind === 'reload' || event.kind === 'horn') sound.click();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    const move = input.move();
    const yaw = renderer.cameraYaw();
    const fx = Math.sin(yaw) * move.f + Math.cos(yaw) * move.s;
    const fz = Math.cos(yaw) * move.f - Math.sin(yaw) * move.s;
    const len = Math.hypot(fx, fz);
    const shootAt = input.takeShoot();
    let aim = null;
    if (shootAt) aim = renderer.screenToGround(shootAt.x, shootAt.y);
    const worldInput = {
      fx: len > 0.01 ? fx / len : 0,
      fz: len > 0.01 ? fz / len : 0,
      run: move.run,
      throttle: move.f,
      steer: -move.s,
      handbrake: false,
      enter: !!(actions & ACTION_ENTER),
      shoot: !!aim,
      aimX: aim ? aim.x : 0,
      aimZ: aim ? aim.z : 0,
      reload: !!(actions & ACTION_RELOAD),
    };
    if (game.state.mode === 'play') {
      let first = true;
      while (accumulator >= STEP) {
        game.update(STEP, worldInput);
        accumulator -= STEP;
        if (first) {
          first = false;
          worldInput.enter = false;
          worldInput.shoot = false;
          worldInput.reload = false;
        }
        if (game.state.mode !== 'play') {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    drainEvents();
    const mode = game.state.mode;
    if (mode !== lastMode) {
      if (mode === 'title') renderer.showScreen('title');
      else if (mode === 'paused') renderer.showScreen('paused');
      else if (mode === 'over') renderer.showScreen('over');
      else if (mode === 'busted') renderer.showScreen('busted');
      else if (mode === 'complete') {
        const s = game.state.stats;
        const acc = game.state.stats.shots > 0 ? Math.round((s.hits / s.shots) * 100) : 0;
        document.getElementById('complete-stats').textContent =
          `Cash: $${game.state.cash} · Missions done: ${s.missionsDone} · Cars stolen: ${s.stolen} · Shot accuracy: ${acc}%`;
        renderer.showScreen('complete');
      }
      lastMode = mode;
    }
    const p = game.player;
    sound.engine(mode === 'play' && !p.onFoot && p.car !== null, p.car ? Math.abs(p.car.speed) / 40 : 0);
    sound.siren(mode === 'play' && game.state.wanted > 0);
    renderer.draw(Math.min((now - last) / 1000, MAX_FRAME));
  }

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
