// timing.test.js - pure playback math. Run with: npm test -w @ydnl/web
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  secondsPerPulse, glideRateRatio, registerRateRatio, sampleCandidates,
  layerPosition, strokeTimesInWindow, patternDuration, REGISTER_FREQ
} from "../src/audio/timing.js";

function layer(over = {}) {
  return {
    instrument_role: "iya-ilu-dundun", pulse_unit: "semiquaver",
    metric_cycle_length: 12, offset_pulses: 0,
    stroke_events: [
      { pulse_position: 1, stroke_type: "open", pitch_register: "high" },
      { pulse_position: 5, stroke_type: "muted", pitch_register: "mid" }
    ],
    ...over
  };
}

test("secondsPerPulse converts tempo and pulse unit", () => {
  assert.equal(secondsPerPulse(120, "crotchet"), 0.5);
  assert.equal(secondsPerPulse(120, "semiquaver"), 0.125);
  assert.equal(secondsPerPulse(60, "quaver"), 0.5);
  // unknown unit falls back to semiquaver
  assert.equal(secondsPerPulse(120, "nonsense"), 0.125);
});

test("glide and register rate ratios follow the anchor frequencies", () => {
  assert.equal(glideRateRatio("mid", "high"), REGISTER_FREQ.high / REGISTER_FREQ.mid);
  assert.equal(glideRateRatio("high", "low"), REGISTER_FREQ.low / REGISTER_FREQ.high);
  assert.equal(registerRateRatio("mid"), 1);
  assert.equal(registerRateRatio("low"), REGISTER_FREQ.low / REGISTER_FREQ.mid);
  assert.equal(registerRateRatio("unknown"), 1);
});

test("sampleCandidates tries register-exact then register-agnostic", () => {
  assert.deepEqual(sampleCandidates("kudi", "slap", "low"),
    ["samples/kudi/slap_low.wav", "samples/kudi/slap.wav"]);
  // glide register never names a file; the caller passes the glide start register
  assert.deepEqual(sampleCandidates("iya-ilu-dundun", "open", "glide"),
    ["samples/iya-ilu-dundun/open.wav"]);
  assert.deepEqual(sampleCandidates("gangan", "open", undefined),
    ["samples/gangan/open.wav"]);
});

test("layerPosition tracks a looping cycle", () => {
  const l = layer(); // 12 semiquaver pulses at 120bpm = 0.125s each, cycle 1.5s
  assert.deepEqual(layerPosition(l, 120, 0, true), { pulseIndex: 0, fraction: 0, done: false });
  const mid = layerPosition(l, 120, 0.75, true); // halfway
  assert.equal(mid.pulseIndex, 6);
  assert.ok(Math.abs(mid.fraction - 0.5) < 1e-9);
  const wrapped = layerPosition(l, 120, 1.625, true); // 1 cycle + 1 pulse
  assert.equal(wrapped.pulseIndex, 1);
  assert.equal(wrapped.done, false);
});

test("layerPosition in once mode finishes and honors offset_pulses", () => {
  const l = layer();
  const end = layerPosition(l, 120, 2.0, false); // past 1.5s cycle
  assert.equal(end.done, true);
  assert.equal(end.fraction, 1);
  const shifted = layerPosition(layer({ offset_pulses: 4 }), 120, 0.25, true);
  // 0.25s elapsed minus 0.5s offset -> not started yet
  assert.deepEqual(shifted, { pulseIndex: 0, fraction: 0, done: false });
});

test("strokeTimesInWindow returns onsets once through in once mode", () => {
  const hits = strokeTimesInWindow(layer(), 120, 0, 10, false);
  assert.deepEqual(hits.map(h => h.when), [0, 0.5]); // pulses 1 and 5
});

test("strokeTimesInWindow repeats at the layer's own cycle in loop mode", () => {
  const hits = strokeTimesInWindow(layer(), 120, 0, 3.1, true); // two cycles + a bit
  assert.deepEqual(hits.map(h => h.when), [0, 0.5, 1.5, 2.0, 3.0]);
  // window is half-open [from, to): a hit exactly at `to` is excluded
  const partial = strokeTimesInWindow(layer(), 120, 1.0, 1.5, true);
  assert.deepEqual(partial.map(h => h.when), []);
  const next = strokeTimesInWindow(layer(), 120, 1.5, 2.1, true);
  assert.deepEqual(next.map(h => h.when), [1.5, 2.0]);
});

test("strokeTimesInWindow returns no hits (does not hang) for a zero-length cycle", () => {
  // Finding 1: metric_cycle_length 0 (or negative tempo) used to make the
  // loop-mode `for (... t += cycleSeconds)` an infinite loop (t += 0),
  // freezing the tab. This test must complete instead of hanging.
  const hits = strokeTimesInWindow(layer({ metric_cycle_length: 0 }), 120, 0, 10, true);
  assert.deepEqual(hits, []);
});

test("strokeTimesInWindow returns no hits for a non-positive tempo", () => {
  const hits = strokeTimesInWindow(layer(), -10, 0, 10, true);
  assert.deepEqual(hits, []);
});

test("layerPosition does not produce NaN for a zero-length cycle", () => {
  const pos = layerPosition(layer({ metric_cycle_length: 0 }), 120, 1, true);
  assert.deepEqual(pos, { pulseIndex: 0, fraction: 0, done: false });
});

test("patternDuration is the longest layer's single cycle", () => {
  const pattern = { tempo_bpm: 120, rhythmic_layers: [
    layer(),                                   // 1.5s
    layer({ metric_cycle_length: 8 }),         // 1.0s
    layer({ metric_cycle_length: 8, offset_pulses: 8 }) // 2.0s including offset
  ]};
  assert.equal(patternDuration(pattern), 2.0);
});
