// engine.js
// Lookahead scheduler: a coarse JS timer wakes every tickMs and schedules
// every stroke falling in the next lookaheadS seconds directly on the
// AudioContext hardware clock, so timing is sample-accurate regardless of
// event-loop jitter. Each layer advances on its own metric cycle - the
// polymeter is audible because scheduling is per-layer, not per-bar.
// Strokes play the user's samples when the bank has them, otherwise a small
// synthesized membrane voice.

import {
  secondsPerPulse, strokeTimesInWindow, layerPosition, patternDuration,
  glideRateRatio, registerRateRatio, registerFreq, fileRegister, DYNAMICS_GAIN
} from "./timing.js";

const SYNTH_DECAY = { open: 0.35, muted: 0.08, slap: 0.12, "heel-toe": 0.2, rim: 0.15, combined: 0.4 };
// How hard each stroke's attack transient hits, relative to the stroke gain.
const NOISE_LEVEL = { slap: 0.7, rim: 0.6, "heel-toe": 0.4, combined: 0.4, open: 0.25, muted: 0.15 };
const MEMBRANE_DROP_S = 0.03; // the struck head's pitch settles within ~30ms

export function createEngine(audioCtx, bank, { tickMs = 25, lookaheadS = 0.1 } = {}) {
  let timer = null;
  let current = null;      // { pattern, loop, startTime, scheduledUntil, duration }
  const liveSources = new Set(); // pending sources; pruned via onended
  let onEnded = null;
  let noiseBuf = null;     // shared white-noise buffer for attack transients

  function glideSeconds(ev, spp) {
    return ev.pitch_glide ? (ev.pitch_glide.duration_pulses || 1) * spp : 0;
  }

  function playSample(hit, layer, when, spp, sample) {
    const ev = hit.ev;
    const role = layer.instrument_role;
    const src = audioCtx.createBufferSource();
    src.buffer = sample.buffer;
    const baseRate = sample.registerExact ? 1 : registerRateRatio(fileRegister(ev), role);
    src.playbackRate.setValueAtTime(baseRate, when);
    if (ev.pitch_glide) {
      const ratio = glideRateRatio(ev.pitch_glide.start_register, ev.pitch_glide.end_register, role);
      src.playbackRate.linearRampToValueAtTime(baseRate * ratio, when + glideSeconds(ev, spp));
    }
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(DYNAMICS_GAIN[ev.dynamics] ?? DYNAMICS_GAIN.mf, when);
    src.connect(g).connect(audioCtx.destination);
    src.onended = () => liveSources.delete(src);
    src.start(when);
    liveSources.add(src);
  }

  function noiseBuffer() {
    if (!noiseBuf) {
      const rate = audioCtx.sampleRate || 44100;
      const length = Math.floor(rate * 0.05);
      noiseBuf = audioCtx.createBuffer(1, length, rate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  // The stick/hand impact: a short noise burst bandpassed around the drum's
  // body resonance. Without it a struck membrane reads as a pure beep.
  function playAttackNoise(when, f0, gain, strokeType) {
    if (!audioCtx.createBuffer || !audioCtx.createBiquadFilter) return;
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = Math.min(4000, Math.max(500, f0 * 8));
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(gain * (NOISE_LEVEL[strokeType] ?? 0.25), when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
    noise.connect(filter).connect(g).connect(audioCtx.destination);
    noise.onended = () => liveSources.delete(noise);
    noise.start(when);
    noise.stop(when + 0.05);
    liveSources.add(noise);
  }

  function playSynth(hit, layer, when, spp) {
    const ev = hit.ev;
    const role = layer.instrument_role;
    const startReg = ev.pitch_glide ? ev.pitch_glide.start_register : ev.pitch_register;
    const endReg = ev.pitch_glide ? ev.pitch_glide.end_register : startReg;
    const f0 = registerFreq(role, startReg);
    const f1 = ev.pitch_glide ? registerFreq(role, endReg) : f0;
    const glide = glideSeconds(ev, spp);
    // Deeper drums ring longer; scale the stroke decay by how low this voice sits.
    const depth = Math.min(1.6, Math.max(0.8, Math.sqrt(130 / f0)));
    const decay = (SYNTH_DECAY[ev.stroke_type] ?? 0.3) * depth + glide;
    const gain = DYNAMICS_GAIN[ev.dynamics] ?? DYNAMICS_GAIN.mf;

    // Membrane body: the hit lands sharp above the target pitch and falls
    // onto it as the head settles, then any linguistic glide takes over.
    const osc = audioCtx.createOscillator();
    if (osc.type !== undefined) osc.type = (ev.stroke_type === "slap" || ev.stroke_type === "rim") ? "triangle" : "sine";
    osc.frequency.setValueAtTime(f0 * 1.5, when);
    osc.frequency.exponentialRampToValueAtTime(f0, when + MEMBRANE_DROP_S);
    if (f1 !== f0) osc.frequency.linearRampToValueAtTime(f1, when + Math.max(glide, MEMBRANE_DROP_S + 0.02));

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + decay);

    osc.connect(g).connect(audioCtx.destination);
    osc.onended = () => liveSources.delete(osc);
    osc.start(when);
    osc.stop(when + decay + 0.05);
    liveSources.add(osc);

    playAttackNoise(when, f0, gain, ev.stroke_type);
  }

  // Shared teardown for stop() and natural end. When `silence` is true
  // (explicit stop()), every still-ringing source is cut off immediately.
  // When false (natural once-mode end), sources are left alone to finish
  // their own scheduled decay; they self-prune via onended. Clearing the
  // Set itself is safe even though the sources are still live: onended's
  // `liveSources.delete(src)` on an already-cleared Set is just a no-op.
  function halt(silence) {
    if (timer) { clearInterval(timer); timer = null; }
    if (silence) {
      for (const src of liveSources) {
        try { src.stop(); } catch { /* already ended */ }
      }
    }
    liveSources.clear();
    current = null;
  }

  function tick() {
    if (!current) return;
    const elapsed = audioCtx.currentTime - current.startTime;
    if (!current.loop && elapsed >= current.duration) {
      const cb = onEnded;
      halt(false);
      if (cb) cb();
      return;
    }
    const from = current.scheduledUntil;
    const to = elapsed + lookaheadS;
    if (to <= from) return;
    for (const layer of current.pattern.rhythmic_layers || []) {
      const spp = secondsPerPulse(current.pattern.tempo_bpm, layer.pulse_unit);
      for (const hit of strokeTimesInWindow(layer, current.pattern.tempo_bpm, from, to, current.loop)) {
        const when = current.startTime + hit.when;
        const sample = bank.getSync(layer.instrument_role, hit.ev.stroke_type, fileRegister(hit.ev));
        if (sample) playSample(hit, layer, when, spp, sample);
        else playSynth(hit, layer, when, spp);
      }
    }
    current.scheduledUntil = to;
  }

  async function play(pattern, { loop = true } = {}) {
    stop();
    await bank.preload(pattern);
    if (audioCtx.resume) await audioCtx.resume();
    current = {
      pattern, loop,
      startTime: audioCtx.currentTime,
      scheduledUntil: 0,
      duration: patternDuration(pattern)
    };
    tick();
    // The first tick can end zero-duration once-mode playback synchronously
    // (stop() already ran); only arm the timer if we are still playing.
    if (current) timer = setInterval(tick, tickMs);
  }

  function stop() {
    halt(true);
  }

  function positionsAt(audioTime) {
    if (!current) return null;
    const elapsed = audioTime - current.startTime;
    return (current.pattern.rhythmic_layers || []).map(l =>
      layerPosition(l, current.pattern.tempo_bpm, elapsed, current.loop));
  }

  return {
    play, stop, positionsAt, tick,
    get playing() { return current !== null; },
    set onEnded(fn) { onEnded = fn; }
  };
}
