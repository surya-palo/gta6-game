// All sound is synthesized with WebAudio — no audio files, no network. Short
// oscillator/noise bursts for effects, and a low engine hum plus a two-tone
// siren while they are needed. Audio starts on the first user gesture (the
// browser requires one) and can be muted with N.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  /** A short tone: frequency glide from f0 to f1 over `dur` seconds. */
  function blip(f0, f1, dur, type, volume) {
    const c = ensure();
    if (!c || muted) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A burst of filtered noise (gunshots, crashes, explosions). */
  function noise(dur, filterFreq, volume) {
    const c = ensure();
    if (!c || muted) return;
    const t = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t);
  }

  return {
    /** Call from any user gesture so the context is allowed to start. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (muted) {
        this.stopEngine();
        this.stopSiren();
      }
      return muted;
    },
    isMuted() {
      return muted;
    },
    gunshot() {
      noise(0.12, 1800, 0.25);
    },
    punch() {
      noise(0.08, 500, 0.2);
    },
    crash(intensity) {
      noise(0.2, 900, 0.15 + 0.25 * Math.min(1, intensity));
    },
    pickup() {
      blip(660, 990, 0.12, 'sine', 0.2);
    },
    missionDone() {
      blip(523, 523, 0.12, 'triangle', 0.2);
      setTimeout(() => blip(659, 659, 0.12, 'triangle', 0.2), 110);
      setTimeout(() => blip(784, 784, 0.22, 'triangle', 0.22), 220);
    },
    busted() {
      blip(392, 196, 0.5, 'sawtooth', 0.15);
    },
    wasted() {
      blip(330, 110, 0.7, 'sawtooth', 0.15);
    },
    /** A continuous engine hum whose pitch follows speed (0..1). Call each frame. */
    engine(speedNorm, running) {
      const c = ensure();
      if (!c || muted || !running) {
        this.stopEngine();
        return;
      }
      if (!engineOsc) {
        engineOsc = c.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = c.createGain();
        engineGain.gain.value = 0.0;
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter).connect(engineGain).connect(c.destination);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + 130 * speedNorm;
      engineGain.gain.value = 0.05 + 0.04 * speedNorm;
    },
    stopEngine() {
      if (engineOsc) {
        try { engineOsc.stop(); } catch { /* already stopped */ }
        engineOsc = null;
        engineGain = null;
      }
    },
    /** A two-tone siren while police are chasing. Call each frame. */
    siren(active, dt) {
      const c = ensure();
      if (!c || muted || !active) {
        this.stopSiren();
        return;
      }
      if (!sirenOsc) {
        sirenOsc = c.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = c.createGain();
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain).connect(c.destination);
        sirenOsc.start();
        sirenTimer = 0;
      }
      sirenTimer += dt;
      sirenOsc.frequency.value = Math.floor(sirenTimer / 0.4) % 2 === 0 ? 720 : 960;
    },
    stopSiren() {
      if (sirenOsc) {
        try { sirenOsc.stop(); } catch { /* already stopped */ }
        sirenOsc = null;
        sirenGain = null;
      }
    },
  };
}
