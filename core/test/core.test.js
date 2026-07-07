// core.test.js  - run with: npm test  (uses the built in node:test runner)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDrumPattern, validatePattern, toXML, fromXML, toJSON, fromJSON,
  detectFeatures, computeECS, computeBPR, toMusicXML
} from "../index.js";

// A dundun ensemble: the iya-ilu-dundun is a tension drum, so it may carry a
// pitch glide. Bata drums and the gudugudu are fixed-pitch and may not.
function samplePattern() {
  return createDrumPattern({
    pattern_id: "DP-TEST",
    title: "Test Sango pattern",
    tempo_bpm: 130,
    ensemble_ref: "ENS-Dundun-2",
    cultural_annotation: { orisha_id: "Sango", ceremony_type: "festival", regional_variant: "Oyo", source_drummer_id: "Test Drummer", validation_status: "master-validated" },
    rhythmic_layers: [
      { instrument_role: "iya-ilu-dundun", metric_cycle_length: 16, pulse_unit: "semiquaver", stroke_events: [
        { pulse_position: 1, stroke_type: "open", pitch_register: "high" },
        { pulse_position: 3, stroke_type: "muted", pitch_register: "mid" },
        { pulse_position: 9, stroke_type: "open", pitch_glide: { start_register: "mid", end_register: "high", glide_direction: "ascending" } }
      ]},
      { instrument_role: "gudugudu", metric_cycle_length: 4, pulse_unit: "semiquaver", stroke_events: [
        { pulse_position: 1, stroke_type: "open", pitch_register: "mid" },
        { pulse_position: 3, stroke_type: "muted", pitch_register: "mid" }
      ]}
    ]
  });
}

function bataPattern() {
  return createDrumPattern({
    pattern_id: "DP-TEST-BATA",
    title: "Test bata pattern",
    tempo_bpm: 120,
    ensemble_ref: "ENS-Bata-2",
    cultural_annotation: { orisha_id: "Sango", ceremony_type: "festival", regional_variant: "Oyo", source_drummer_id: "Test Drummer", validation_status: "master-validated" },
    rhythmic_layers: [
      { instrument_role: "iya-ilu", metric_cycle_length: 12, pulse_unit: "semiquaver", stroke_events: [
        { pulse_position: 1, stroke_type: "open", pitch_register: "high" },
        { pulse_position: 5, stroke_type: "combined", pitch_register: "high" }
      ]},
      { instrument_role: "omele-abo", metric_cycle_length: 8, pulse_unit: "semiquaver", stroke_events: [
        { pulse_position: 1, stroke_type: "open", pitch_register: "low" },
        { pulse_position: 5, stroke_type: "slap", pitch_register: "low" }
      ]}
    ]
  });
}

test("a well formed pattern validates", () => {
  const { valid, errors } = validatePattern(samplePattern());
  assert.equal(valid, true, JSON.stringify(errors));
});

test("a well formed bata pattern without glides validates", () => {
  const { valid, errors } = validatePattern(bataPattern());
  assert.equal(valid, true, JSON.stringify(errors));
});

test("a pitch glide on a fixed-pitch bata drum fails validation", () => {
  const p = bataPattern();
  p.rhythmic_layers[0].stroke_events[1] = {
    event_id: "EV-BAD", pulse_position: 5, stroke_type: "open", pitch_register: "glide",
    duration_pulses: 1, dynamics: "mf",
    pitch_glide: { start_register: "mid", end_register: "high", glide_direction: "ascending", duration_pulses: 1 }
  };
  const { valid, errors } = validatePattern(p);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.path.includes("pitch_glide")), JSON.stringify(errors));
});

test("a pitch glide on the fixed-pitch gudugudu fails validation", () => {
  const p = samplePattern();
  p.rhythmic_layers[1].stroke_events[0].pitch_register = "glide";
  p.rhythmic_layers[1].stroke_events[0].pitch_glide =
    { start_register: "low", end_register: "mid", glide_direction: "ascending", duration_pulses: 1 };
  const { valid } = validatePattern(p);
  assert.equal(valid, false);
});

test("a pattern without cultural annotation fails validation", () => {
  const p = samplePattern();
  p.cultural_annotation = null;
  const { valid, errors } = validatePattern(p);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.path === "/cultural_annotation"));
});

test("XML round trips without losing structure", () => {
  const p = samplePattern();
  const back = fromXML(toXML(p));
  assert.equal(back.rhythmic_layers.length, 2);
  assert.equal(back.rhythmic_layers[0].metric_cycle_length, 16);
  assert.equal(back.rhythmic_layers[1].metric_cycle_length, 4);
  assert.ok(back.rhythmic_layers[0].stroke_events.find(e => e.pitch_glide));
});

test("JSON round trips", () => {
  const p = samplePattern();
  const back = fromJSON(toJSON(p));
  assert.equal(back.pattern_id, "DP-TEST");
});

test("feature detection finds the polymetric and glide features", () => {
  const f = detectFeatures(samplePattern());
  for (const expected of ["multi_layer", "polymeter", "pitch_glide", "timbre_variation", "cultural_metadata"]) {
    assert.ok(f.includes(expected), `missing ${expected}`);
  }
});

test("ECS is 1.0 for YDNL and below 1.0 for MusicXML capability", () => {
  const p = samplePattern();
  assert.equal(computeECS(p).ecs, 1);
  const mx = computeECS(p, ["multi_layer", "register_tones"]);
  assert.ok(mx.ecs < 1);
});

test("BPR over MusicXML exceeds the 2.0 threshold for a rich pattern", () => {
  const { bpr } = computeBPR(samplePattern());
  assert.ok(bpr > 2.0, `BPR was ${bpr}`);
});

test("benchmark encoder reports lost features", () => {
  const { lostFeatures, musicxml } = toMusicXML(samplePattern());
  assert.ok(musicxml.includes("score-partwise"));
  assert.ok(lostFeatures.some(l => l.feature === "pitch_glide"));
});

test("benchmark encoder preserves onset timing with rests", () => {
  const { musicxml } = toMusicXML(samplePattern());
  assert.ok(musicxml.includes("<rest"), "gaps between strokes must become rests, not be silently closed up");
});

test("benchmark encoder fills every measure to the shared time signature", () => {
  const { musicxml } = toMusicXML(samplePattern());
  const beats = Number(musicxml.match(/<beats>(\d+)<\/beats>/)[1]);
  const parts = musicxml.split(/<part id=/).slice(1);
  assert.equal(parts.length, 2);
  for (const part of parts) {
    const total = [...part.matchAll(/<duration>(\d+)<\/duration>/g)]
      .reduce((sum, m) => sum + Number(m[1]), 0);
    assert.equal(total, beats, "note + rest durations must fill the measure exactly");
  }
});
