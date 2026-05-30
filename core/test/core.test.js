// core.test.js  - run with: npm test  (uses the built in node:test runner)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDrumPattern, validatePattern, toXML, fromXML, toJSON, fromJSON,
  detectFeatures, computeECS, computeBPR, toMusicXML
} from "../index.js";

function samplePattern() {
  return createDrumPattern({
    pattern_id: "DP-TEST",
    title: "Test Sango pattern",
    tempo_bpm: 130,
    ensemble_ref: "ENS-Bata-3",
    cultural_annotation: { orisha_id: "Sango", ceremony_type: "festival", regional_variant: "Oyo", source_drummer_id: "Test Drummer", validation_status: "master-validated" },
    rhythmic_layers: [
      { instrument_role: "iya-ilu", metric_cycle_length: 12, pulse_unit: "semiquaver", stroke_events: [
        { pulse_position: 1, stroke_type: "open", pitch_register: "high" },
        { pulse_position: 3, stroke_type: "muted", pitch_register: "mid" },
        { pulse_position: 9, stroke_type: "open", pitch_glide: { start_register: "mid", end_register: "high", glide_direction: "ascending" } }
      ]},
      { instrument_role: "omele-abo", metric_cycle_length: 8, pulse_unit: "semiquaver", stroke_events: [
        { pulse_position: 1, stroke_type: "open", pitch_register: "low" },
        { pulse_position: 5, stroke_type: "open", pitch_register: "low" }
      ]}
    ]
  });
}

test("a well formed pattern validates", () => {
  const { valid, errors } = validatePattern(samplePattern());
  assert.equal(valid, true, JSON.stringify(errors));
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
  assert.equal(back.rhythmic_layers[0].metric_cycle_length, 12);
  assert.equal(back.rhythmic_layers[1].metric_cycle_length, 8);
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
