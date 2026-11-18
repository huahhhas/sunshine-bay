// All sound is synthesized with WebAudio: no audio files, no network. The engine is a
// sawtooth through a low-pass filter whose pitch follows the car's speed; the siren is two
// alternating tones; gunshots and crashes are filtered noise bursts; the music is a small
// scheduled bass-and-pad loop. Everything is guarded so it stays silent until the player
// first interacts (browsers block audio before a gesture) and in screenshot mode.

export function createSound() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  try {
    muted = window.localStorage.getItem('sunshine-bay.sound.v1') === 'off';
  } catch {
    muted = false;
  }

  function ensure() {
    if (ctx !== null) return ctx !== null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function tone(freq, dur, type, vol, when) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function burst(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  const api = {
    get muted() {
      return muted;
    },
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      try {
        window.localStorage.setItem('sunshine-bay.sound.v1', muted ? 'off' : 'on');
      } catch {
        // Storage can be off: the setting then lasts this visit only.
      }
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    click() {
      tone(660, 0.07, 'square', 0.12);
    },
    shot() {
      burst(0.14, 0.5, 1800);
      tone(180, 0.1, 'square', 0.2);
    },
    crash() {
      burst(0.3, 0.5, 500);
      tone(70, 0.25, 'sine', 0.4);
    },
    pickup() {
      tone(523, 0.09, 'sine', 0.25);
      tone(659, 0.09, 'sine', 0.25, 0.09);
      tone(784, 0.16, 'sine', 0.25, 0.18);
    },
    jingle() {
      const notes = [523, 659, 784, 1047];
      for (let i = 0; i < notes.length; i += 1) tone(notes[i], 0.18, 'triangle', 0.3, i * 0.13);
    },
    busted() {
      const notes = [392, 330, 262, 196];
      for (let i = 0; i < notes.length; i += 1) tone(notes[i], 0.3, 'sawtooth', 0.2, i * 0.22);
    },
    engine(on, speed01) {
      if (!ensure()) return;
      if (on && !muted) {
        if (engineOsc === null) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          engineFilter = ctx.createBiquadFilter();
          engineFilter.type = 'lowpass';
          engineFilter.frequency.value = 420;
          engineGain = ctx.createGain();
          engineGain.gain.value = 0.05;
          engineOsc.connect(engineFilter);
          engineFilter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        const freq = 55 + speed01 * 130;
        engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
        engineFilter.frequency.setTargetAtTime(320 + speed01 * 900, ctx.currentTime, 0.1);
        engineGain.gain.setTargetAtTime(0.04 + speed01 * 0.05, ctx.currentTime, 0.1);
      } else if (engineOsc !== null) {
        engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      }
    },
    siren(on) {
      if (!ensure()) return;
      if (on && !muted) {
        if (sirenOsc === null) {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'triangle';
          sirenOsc.frequency.value = 720;
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0.045;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
        }
        sirenTimer += 1;
        if (sirenTimer % 24 === 0) {
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.setTargetAtTime(sirenHigh ? 720 : 960, ctx.currentTime, 0.03);
        }
      } else if (sirenOsc !== null) {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      }
    },
    startMusic() {
      if (!ensure() || musicTimer !== null) return;
      // A slow sunset-drive loop: Am – F – C – G bass under a soft pad.
      const bass = [110, 87.31, 130.81, 98];
      const pad = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 196, 246.94]];
      musicTimer = window.setInterval(() => {
        if (muted) return;
        const bar = musicStep % 4;
        const root = bass[bar];
        tone(root, 1.7, 'sine', 0.16);
        tone(root / 2, 1.7, 'triangle', 0.1);
        for (const f of pad[bar]) tone(f, 1.7, 'sine', 0.035);
        if (musicStep % 2 === 0) tone(root * 2, 0.3, 'square', 0.03);
        musicStep += 1;
      }, 900);
    },
    stopMusic() {
      if (musicTimer !== null) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
  return api;
}
