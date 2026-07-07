// dsp.test.js - signal-processing primitives, tested against audio that is
// SYNTHESIZED here with known ground truth (no audio files in the repo).
import { test } from "node:test";
import assert from "node:assert/strict";
import { rmsEnvelope, detectOnsets, estimatePitch, decayHalfLife } from "../src/transcribe/dsp.js";

const RATE = 44100;

function makeBuffer(seconds) {
  return new Float32Array(Math.round(seconds * RATE));
}

// An exponentially decaying sine burst - the test stand-in for a drum stroke.
// freqEnd (optional) ramps the frequency linearly over the duration: a glide.
function addBurst(buf, { t0, freq, freqEnd = null, duration = 0.4, amp = 0.8, tau = 0.15 }) {
  const start = Math.round(t0 * RATE);
  const n = Math.round(duration * RATE);
  let phase = 0;
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / RATE;
    const f = freqEnd === null ? freq : freq + (freqEnd - freq) * (t / duration);
    phase += (2 * Math.PI * f) / RATE;
    buf[start + i] += amp * Math.exp(-t / tau) * Math.sin(phase);
  }
}

// Deterministic pseudo-noise so the "no pitch in noise" test can never flake.
function addNoise(buf, amp = 0.5) {
  let seed = 42;
  for (let i = 0; i < buf.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    buf[i] += amp * ((seed / 4294967296) * 2 - 1);
  }
}

test("detectOnsets finds each burst once, near its true time", () => {
  const buf = makeBuffer(2.0);
  const truth = [0.1, 0.6, 1.2];
  for (const t0 of truth) addBurst(buf, { t0, freq: 130 });
  const onsets = detectOnsets(rmsEnvelope(buf, RATE));
  assert.equal(onsets.length, 3, `expected 3 onsets, got ${onsets.length}: ${onsets}`);
  truth.forEach((t, i) => assert.ok(Math.abs(onsets[i] - t) < 0.025, `onset ${i}: ${onsets[i]} vs ${t}`));
});

test("one stroke cannot fire twice (refractory period)", () => {
  const buf = makeBuffer(1.0);
  addBurst(buf, { t0: 0.2, freq: 130 });
  const onsets = detectOnsets(rmsEnvelope(buf, RATE));
  assert.equal(onsets.length, 1);
});

test("silence produces no onsets", () => {
  const onsets = detectOnsets(rmsEnvelope(makeBuffer(1.0), RATE));
  assert.deepEqual(onsets, []);
});

test("estimatePitch reads a burst's frequency within 5%", () => {
  for (const freq of [100, 300]) {
    const buf = makeBuffer(1.0);
    addBurst(buf, { t0: 0.1, freq, tau: 0.3 });
    const hz = estimatePitch(buf, RATE, 0.13); // 30ms past the onset
    assert.ok(hz !== null, `no pitch found for ${freq}Hz`);
    assert.ok(Math.abs(hz - freq) / freq < 0.05, `estimated ${hz} for ${freq}`);
  }
});

test("estimatePitch returns null on noise", () => {
  const buf = makeBuffer(0.5);
  addNoise(buf);
  assert.equal(estimatePitch(buf, RATE, 0.1), null);
});

test("estimatePitch returns null on silence", () => {
  assert.equal(estimatePitch(makeBuffer(0.5), RATE, 0.1), null);
});

test("decayHalfLife separates muted from ringing strokes", () => {
  const buf = makeBuffer(1.0);
  addBurst(buf, { t0: 0.1, freq: 130, tau: 0.03, duration: 0.2 }); // choked
  addBurst(buf, { t0: 0.5, freq: 130, tau: 0.3 });                 // ringing
  const env = rmsEnvelope(buf, RATE);
  assert.ok(decayHalfLife(env, 0.1) < 0.09, "choked stroke should halve fast");
  assert.ok(decayHalfLife(env, 0.5) > 0.09, "ringing stroke should sustain");
});
