// transcribe.test.js - the audio->pattern pipeline against synthesized
// recordings with known ground truth. Fixture helpers are duplicated from
// dsp.test.js on purpose: Node's default test discovery executes every file
// under test/, so a shared helper module would itself run as a "test".
import { test } from "node:test";
import assert from "node:assert/strict";
import { transcribe } from "../src/transcribe/transcribe.js";
import { ROLE_REGISTER_FREQ } from "../src/audio/timing.js";
import { validatePattern } from "ydnl-core";

const RATE = 44100;

function makeBuffer(seconds) {
  return new Float32Array(Math.round(seconds * RATE));
}

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

const DUNDUN = ROLE_REGISTER_FREQ["iya-ilu-dundun"]; // { low: 75, mid: 105, high: 150 }
// 120bpm semiquaver = 0.125s per pulse.
const OPTS = { role: "iya-ilu-dundun", tempoBpm: 120, pulseUnit: "semiquaver", cycleLength: 8, glideCapable: true };

test("strokes land on the right pulses with the right registers", () => {
  const buf = makeBuffer(2.0);
  addBurst(buf, { t0: 0.1, freq: DUNDUN.high });                              // pulse 1
  addBurst(buf, { t0: 0.35, freq: DUNDUN.mid, tau: 0.03, duration: 0.2 });    // pulse 3, choked
  addBurst(buf, { t0: 0.6, freq: DUNDUN.low });                               // pulse 5
  const { pattern, report } = transcribe(buf, RATE, OPTS);
  const evs = pattern.rhythmic_layers[0].stroke_events;
  assert.deepEqual(evs.map(e => e.pulse_position), [1, 3, 5]);
  assert.deepEqual(evs.map(e => e.pitch_register), ["high", "mid", "low"]);
  assert.deepEqual(evs.map(e => e.stroke_type), ["open", "muted", "open"]);
  assert.equal(report.skipped, 0);
  assert.equal(report.rows.length, 3);
});

test("a rising sweep becomes an ascending glide on a tension drum", () => {
  const buf = makeBuffer(1.5);
  addBurst(buf, { t0: 0.1, freq: DUNDUN.mid, freqEnd: DUNDUN.high, duration: 0.45, tau: 0.4 });
  const { pattern } = transcribe(buf, RATE, OPTS);
  const ev = pattern.rhythmic_layers[0].stroke_events[0];
  assert.equal(ev.pitch_register, "glide");
  assert.equal(ev.pitch_glide.glide_direction, "ascending");
  assert.equal(ev.pitch_glide.start_register, "mid");
  assert.equal(ev.pitch_glide.end_register, "high");
  assert.ok(ev.pitch_glide.duration_pulses >= 1 && ev.pitch_glide.duration_pulses <= 4);
});

test("the same sweep on a fixed-pitch drum yields a plain register, never a glide", () => {
  const buf = makeBuffer(1.5);
  addBurst(buf, { t0: 0.1, freq: 95, freqEnd: 130, duration: 0.45, tau: 0.3 });
  const { pattern } = transcribe(buf, RATE, { ...OPTS, role: "iya-ilu", glideCapable: false });
  const ev = pattern.rhythmic_layers[0].stroke_events[0];
  assert.notEqual(ev.pitch_register, "glide");
  assert.equal(ev.pitch_glide, null);
});

test("beyond-cycle and colliding onsets are skipped and counted", () => {
  // Crotchet pulses (0.5s at 120bpm) so colliding onsets can sit 200ms apart -
  // far enough for the envelope to dip between them (a choked first stroke),
  // close enough to quantize onto the same pulse.
  const opts = { ...OPTS, pulseUnit: "crotchet", cycleLength: 3 };
  const buf = makeBuffer(2.5);
  addBurst(buf, { t0: 0.1, freq: DUNDUN.mid, tau: 0.03, duration: 0.15 }); // pulse 1
  addBurst(buf, { t0: 0.3, freq: DUNDUN.mid, tau: 0.03, duration: 0.15 }); // rounds to pulse 1 -> collision
  addBurst(buf, { t0: 1.7, freq: DUNDUN.mid });                            // pulse 4 > cycleLength 3 -> beyond
  const { pattern, report } = transcribe(buf, RATE, opts);
  assert.equal(pattern.rhythmic_layers[0].stroke_events.length, 1);
  assert.equal(report.skipped, 2);
});

test("silence reports no-onsets instead of a pattern", () => {
  const { pattern, report } = transcribe(makeBuffer(1.0), RATE, OPTS);
  assert.equal(pattern, null);
  assert.equal(report.error, "no-onsets");
});

test("the draft validates once a human completes the cultural annotation", () => {
  const buf = makeBuffer(1.5);
  addBurst(buf, { t0: 0.1, freq: DUNDUN.mid, freqEnd: DUNDUN.high, duration: 0.45, tau: 0.4 });
  addBurst(buf, { t0: 0.6, freq: DUNDUN.low });
  const { pattern } = transcribe(buf, RATE, OPTS);
  // The raw draft must NOT validate: CulturalAnnotation is mandatory and
  // machine output never asserts provenance (DATA.md).
  assert.equal(pattern.cultural_annotation.validation_status, "draft");
  assert.equal(pattern.cultural_annotation.source_drummer_id, "");
  assert.equal(validatePattern(pattern).valid, false);
  // Once the human supplies the annotation (as the Encoder requires), the
  // machine-generated structure itself is schema-clean - including the glide,
  // which is legal on this tension drum.
  pattern.cultural_annotation.orisha_id = "Sango";
  pattern.cultural_annotation.ceremony_type = "festival";
  pattern.cultural_annotation.regional_variant = "Oyo";
  const { valid, errors } = validatePattern(pattern);
  assert.equal(valid, true, JSON.stringify(errors));
});
