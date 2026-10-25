// Sound effects: two mp3 clips plus small synthesized blips via Web Audio.

let currentAudio = null;
let lockUntil = 0;

const isBusy = () => (currentAudio && !currentAudio.paused) || Date.now() < lockUntil;

function playClip(src, volume = 0.85, maxMs) {
  if (isBusy()) return false;
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    currentAudio = audio;
    audio.play().catch(() => {});
    const release = () => {
      if (currentAudio === audio) currentAudio = null;
    };
    audio.onended = release;
    audio.onerror = release;
    if (maxMs) {
      setTimeout(() => {
        if (!audio.paused) {
          audio.pause();
          audio.currentTime = 0;
        }
        release();
      }, maxMs);
    }
    return true;
  } catch {
    return false;
  }
}

// Plays a tone that sweeps from `from` Hz to `to` Hz.
function sweep(ctx, { type = 'sine', from, to, gain, duration, stop, filter }) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const t = ctx.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + duration);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.001, t + duration + 0.03);
  if (filter) {
    osc.connect(filter);
    filter.connect(amp);
  } else {
    osc.connect(amp);
  }
  amp.connect(ctx.destination);
  osc.start();
  osc.stop(t + stop);
}

export function playSound(name) {
  if (isBusy()) return;

  if (name === 'ironman') {
    if (playClip('/assets/audio/ironman_suitup.mp3', 0.85)) lockUntil = Date.now() + 1500;
    return;
  }
  if (name === 'spiderman') {
    playClip('/assets/audio/spiderman_desi_8s.mp3', 0.9, 8000);
    return;
  }

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const t = ctx.currentTime;

    switch (name) {
      case 'zip':
        lockUntil = Date.now() + 380;
        sweep(ctx, { type: 'triangle', from: 220, to: 1400, gain: 0.18, duration: 0.35, stop: 0.4 });
        break;

      case 'barcode': {
        const a = ctx.createOscillator();
        const b = ctx.createOscillator();
        const amp = ctx.createGain();
        a.frequency.setValueAtTime(1760, t);
        b.frequency.setValueAtTime(2637, t + 0.08);
        amp.gain.setValueAtTime(0.15, t);
        amp.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        a.connect(amp);
        b.connect(amp);
        amp.connect(ctx.destination);
        a.start();
        a.stop(t + 0.08);
        b.start(t + 0.08);
        b.stop(t + 0.28);
        break;
      }

      case 'contact':
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const amp = ctx.createGain();
          const start = t + i * 0.035;
          osc.frequency.setValueAtTime(freq, start);
          amp.gain.setValueAtTime(0.08, start);
          amp.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
          osc.connect(amp);
          amp.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.5);
        });
        break;

      case 'clasp':
        sweep(ctx, { from: 2600, to: 750, gain: 0.2, duration: 0.12, stop: 0.13 });
        break;

      case 'tape': {
        const len = Math.floor(ctx.sampleRate * 0.12);
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.setValueAtTime(2200, t);
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(0.22, t);
        src.connect(band);
        band.connect(amp);
        amp.connect(ctx.destination);
        src.start();
        break;
      }

      case 'respawn':
        sweep(ctx, { from: 140, to: 840, gain: 0.15, duration: 0.35, stop: 0.42 });
        break;

      case 'flip': {
        const low = ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.setValueAtTime(1000, t);
        sweep(ctx, { type: 'triangle', from: 340, to: 120, gain: 0.22, duration: 0.28, stop: 0.32, filter: low });
        break;
      }
    }
  } catch {}
}

export function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}
