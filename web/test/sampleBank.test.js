// sampleBank.test.js - sample loading/caching with injected fetch + decode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSampleBank } from "../src/audio/sampleBank.js";

// Minimal stand-ins: the bank only calls fetch(url) -> {ok, arrayBuffer()} and
// audioCtx.decodeAudioData(arrayBuffer) -> decoded buffer object.
function fakeCtx() {
  return { decodeAudioData: async (buf) => ({ decoded: true, from: buf.url }) };
}
function fakeFetch(available) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    if (!available.includes(url)) return { ok: false, status: 404 };
    return { ok: true, arrayBuffer: async () => ({ url }) };
  };
  fn.calls = calls;
  return fn;
}

const pattern = {
  rhythmic_layers: [{
    instrument_role: "kudi", pulse_unit: "semiquaver", metric_cycle_length: 8,
    stroke_events: [
      { pulse_position: 1, stroke_type: "slap", pitch_register: "low" },
      { pulse_position: 5, stroke_type: "open", pitch_register: "mid" }
    ]
  }]
};

test("getSync resolves register-exact sample after preload", async () => {
  const fetchFn = fakeFetch(["/samples/kudi/slap_low.wav", "/samples/kudi/open.wav"]);
  const bank = createSampleBank(fakeCtx(), { fetchFn });
  await bank.preload(pattern);
  const exact = bank.getSync("kudi", "slap", "low");
  assert.equal(exact.registerExact, true);
  assert.ok(exact.buffer.decoded);
  const fallback = bank.getSync("kudi", "open", "mid");
  assert.equal(fallback.registerExact, false); // only register-agnostic file exists
});

test("getSync returns null when no file exists, and 404s are cached", async () => {
  const fetchFn = fakeFetch([]);
  const bank = createSampleBank(fakeCtx(), { fetchFn });
  await bank.preload(pattern);
  assert.equal(bank.getSync("kudi", "slap", "low"), null);
  const callsAfterPreload = fetchFn.calls.length;
  await bank.preload(pattern); // second preload must not refetch cached misses
  assert.equal(fetchFn.calls.length, callsAfterPreload);
});

test("preload fetches each unique candidate path exactly once", async () => {
  const repeatPattern = { rhythmic_layers: [{
    instrument_role: "kudi", pulse_unit: "semiquaver", metric_cycle_length: 8,
    stroke_events: [
      { pulse_position: 1, stroke_type: "slap", pitch_register: "low" },
      { pulse_position: 3, stroke_type: "slap", pitch_register: "low" },
      { pulse_position: 5, stroke_type: "slap", pitch_register: "low" }
    ]
  }]};
  const fetchFn = fakeFetch([]);
  const bank = createSampleBank(fakeCtx(), { fetchFn });
  await bank.preload(repeatPattern);
  // Two unique candidates (slap_low.wav, slap.wav) -> exactly two fetches,
  // even though three events queued them concurrently.
  assert.equal(fetchFn.calls.length, 2);
});

test("glide events preload the start-register sample", async () => {
  const glidePattern = { rhythmic_layers: [{
    instrument_role: "iya-ilu-dundun", pulse_unit: "semiquaver", metric_cycle_length: 12,
    stroke_events: [{
      pulse_position: 1, stroke_type: "open", pitch_register: "glide",
      pitch_glide: { start_register: "mid", end_register: "high", glide_direction: "ascending" }
    }]
  }]};
  const fetchFn = fakeFetch(["/samples/iya-ilu-dundun/open_mid.wav"]);
  const bank = createSampleBank(fakeCtx(), { fetchFn });
  await bank.preload(glidePattern);
  const hit = bank.getSync("iya-ilu-dundun", "open", "mid");
  assert.equal(hit.registerExact, true);
});
