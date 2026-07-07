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
  glideRateRatio, registerRateRatio, fileRegister, REGISTER_FREQ, DYNAMICS_GAIN
} from "./timing.js";

const SYNTH_DECAY = { open: 0.35, muted: 0.08, slap: 0.12, "heel-toe": 0.2, rim: 0.15, combined: 0.4 };

export function createEngine(audioCtx, bank, { tickMs = 25, lookaheadS = 0.1 } = {}) {
  let timer = null;
  let current = null;      // { pattern, loop, startTime, scheduledUntil, duration }
  const liveSources = new Set(); // pending sources; pruned via onended
  let onEnded = null;

  function glideSeconds(ev, spp) {
    return ev.pitch_glide ? (ev.pitch_glide.duration_pulses || 1) * spp : 0;
  }

  function playSample(hit, layer, when, spp, sample) {
    const ev = hit.ev;
    const src = audioCtx.createBufferSource();
    src.buffer = sample.buffer;
    const baseRate = sample.registerExact ? 1 : registerRateRatio(fileRegister(ev));
    src.playbackRate.setValueAtTime(baseRate, when);
    if (ev.pitch_glide) {
      const ratio = glideRateRatio(ev.pitch_glide.start_register, ev.pitch_glide.end_register);
      src.playbackRate.linearRampToValueAtTime(baseRate * ratio, when + glideSeconds(ev, spp));
    }
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(DYNAMICS_GAIN[ev.dynamics] ?? DYNAMICS_GAIN.mf, when);
    src.connect(g).connect(audioCtx.destination);
    src.onended = () => liveSources.delete(src);
    src.start(when);
    liveSources.add(src);
  }

  function playSynth(hit, layer, when, spp) {
    const ev = hit.ev;
    const startReg = ev.pitch_glide ? ev.pitch_glide.start_register : ev.pitch_register;
    const endReg = ev.pitch_glide ? ev.pitch_glide.end_register : startReg;
    const f0 = REGISTER_FREQ[startReg] || REGISTER_FREQ.mid;
    const f1 = REGISTER_FREQ[endReg] || f0;
    const glide = glideSeconds(ev, spp);
    const decay = (SYNTH_DECAY[ev.stroke_type] ?? 0.3) + glide;

    const osc = audioCtx.createOscillator();
    if (osc.type !== undefined) osc.type = (ev.stroke_type === "slap" || ev.stroke_type === "rim") ? "triangle" : "sine";
    osc.frequency.setValueAtTime(f0, when);
    if (f1 !== f0) osc.frequency.linearRampToValueAtTime(f1, when + glide);

    const g = audioCtx.createGain();
    const gain = DYNAMICS_GAIN[ev.dynamics] ?? DYNAMICS_GAIN.mf;
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + decay);

    osc.connect(g).connect(audioCtx.destination);
    osc.onended = () => liveSources.delete(osc);
    osc.start(when);
    osc.stop(when + decay + 0.05);
    liveSources.add(osc);
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
