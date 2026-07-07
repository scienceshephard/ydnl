// engine.test.js - drives the scheduler with a fake AudioContext and manual
// tick() calls, asserting WHEN sources are scheduled on the audio clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/audio/engine.js";
import { registerFreq, ROLE_REGISTER_FREQ } from "../src/audio/timing.js";

// An AudioParam stand-in that records every automation call so tests can
// assert on scheduled values, not just that a method exists.
function fakeParam() {
  const param = { events: [], value: 0 };
  for (const type of ["setValueAtTime", "linearRampToValueAtTime", "exponentialRampToValueAtTime"]) {
    param[type] = (value, time) => param.events.push({ type, value, time });
  }
  return param;
}

function fakeNode() {
  const node = {
    started: [], stopped: [],
    connect: (target) => target || node,
    start: (when) => node.started.push(when),
    stop: (when) => node.stopped.push(when),
    frequency: fakeParam(),
    playbackRate: fakeParam(),
    gain: fakeParam(),
    onended: null
  };
  return node;
}

function fakeCtx() {
  const ctx = {
    currentTime: 0, destination: {}, sources: [], oscillators: [], filters: [],
    sampleRate: 48000,
    createBufferSource() { const n = fakeNode(); ctx.sources.push(n); return n; },
    createOscillator() { const n = fakeNode(); ctx.oscillators.push(n); return n; },
    createGain: fakeNode,
    createBiquadFilter() { const n = fakeNode(); ctx.filters.push(n); return n; },
    createBuffer(_channels, length, _rate) {
      return { length, getChannelData: () => new Float32Array(length) };
    },
    resume: async () => {}
  };
  return ctx;
}

const emptyBank = { preload: async () => {}, getSync: () => null };

function pattern(loopyLayers) {
  return { tempo_bpm: 120, rhythmic_layers: loopyLayers }; // semiquaver = 0.125s
}
const twoAgainstThree = pattern([
  { instrument_role: "iya-ilu-dundun", pulse_unit: "semiquaver", metric_cycle_length: 3,
    stroke_events: [{ pulse_position: 1, stroke_type: "open", pitch_register: "mid" }] },
  { instrument_role: "gangan", pulse_unit: "semiquaver", metric_cycle_length: 2,
    stroke_events: [{ pulse_position: 1, stroke_type: "open", pitch_register: "low" }] }
]);

test("loop mode schedules each layer on its own cycle (synth fallback)", async () => {
  const ctx = fakeCtx();
  const engine = createEngine(ctx, emptyBank, { tickMs: 1e9, lookaheadS: 1.0 });
  await engine.play(twoAgainstThree, { loop: true });
  engine.tick(); // schedules [now, now+1.0s): layer cycles are 0.375s and 0.25s
  const starts = ctx.oscillators.flatMap(o => o.started).sort((a, b) => a - b);
  // layer1 at 0, .375, .75 ; layer2 at 0, .25, .5, .75 (start offset included)
  assert.equal(starts.filter(t => t < 1.0).length, 7);
  assert.equal(engine.playing, true);
  engine.stop();
  assert.equal(engine.playing, false);
  assert.equal(engine.positionsAt(0.5), null);
});

test("once mode ends by itself and reports via onEnded", async () => {
  const ctx = fakeCtx();
  const engine = createEngine(ctx, emptyBank, { tickMs: 1e9, lookaheadS: 1.0 });
  let ended = 0;
  engine.onEnded = () => { ended += 1; };
  await engine.play(twoAgainstThree, { loop: false });
  engine.tick(); // whole once-through fits in the 1s lookahead (duration 0.375s)
  const starts = ctx.oscillators.flatMap(o => o.started);
  assert.equal(starts.length, 2); // one hit per layer, no repeats
  ctx.currentTime = 0.5; // past patternDuration
  engine.tick();
  assert.equal(ended, 1);
  assert.equal(engine.playing, false);
});

test("samples are used when the bank has a buffer", async () => {
  const ctx = fakeCtx();
  const bank = { preload: async () => {}, getSync: () => ({ buffer: { fake: true }, registerExact: true }) };
  const engine = createEngine(ctx, bank, { tickMs: 1e9, lookaheadS: 0.3 });
  await engine.play(twoAgainstThree, { loop: false });
  engine.tick();
  assert.equal(ctx.sources.length, 2);   // AudioBufferSourceNodes
  assert.equal(ctx.oscillators.length, 0); // no synth fallback
  engine.stop();
});

test("once mode with an empty pattern ends immediately without arming a timer", async () => {
  const ctx = fakeCtx();
  const engine = createEngine(ctx, emptyBank, { tickMs: 1e9, lookaheadS: 1.0 });
  let ended = 0;
  engine.onEnded = () => { ended += 1; };
  const realSetInterval = globalThis.setInterval;
  const armed = [];
  // Record arms without starting a real timer, so a leaked interval cannot
  // keep the test process alive; clearInterval on the fake handle is a no-op.
  globalThis.setInterval = (...args) => { armed.push(args); return 0; };
  try {
    await engine.play({ tempo_bpm: 120, rhythmic_layers: [] }, { loop: false });
  } finally {
    globalThis.setInterval = realSetInterval;
  }
  assert.equal(ended, 1);
  assert.equal(engine.playing, false);
  assert.equal(armed.length, 0); // no dangling interval after instant end
});

test("stop() silences every pending scheduled source", async () => {
  const ctx = fakeCtx();
  const engine = createEngine(ctx, emptyBank, { tickMs: 1e9, lookaheadS: 1.0 });
  await engine.play(twoAgainstThree, { loop: true });
  engine.tick(); // schedules ~7 oscillators up to 1s ahead
  assert.ok(ctx.oscillators.length >= 7);
  engine.stop();
  for (const osc of ctx.oscillators) {
    // one stop scheduled at creation (decay end) + one immediate from engine.stop()
    assert.ok(osc.stopped.length >= 2, `oscillator not silenced: ${osc.stopped.length} stop calls`);
  }
});

test("finished sources are pruned so stop() never touches them", async () => {
  const ctx = fakeCtx();
  const engine = createEngine(ctx, emptyBank, { tickMs: 1e9, lookaheadS: 1.0 });
  await engine.play(twoAgainstThree, { loop: true });
  try {
    engine.tick(); // schedules ~7 oscillators up to 1s ahead
    assert.ok(ctx.oscillators.length >= 7);
    for (const osc of ctx.oscillators) {
      assert.equal(typeof osc.onended, "function", "engine must assign onended for pruning");
      osc.onended(); // simulate the source finishing on its own
    }
    assert.equal(engine.playing, true); // pruning does not affect playback state
    const stopCountsBefore = ctx.oscillators.map(o => o.stopped.length);
    engine.stop();
    const stopCountsAfter = ctx.oscillators.map(o => o.stopped.length);
    assert.deepEqual(stopCountsAfter, stopCountsBefore); // already pruned: untouched
    assert.equal(engine.playing, false);
  } finally {
    engine.stop(); // idempotent; keeps a failing assert from leaking the timer
  }
});

test("once mode natural end lets ringing sources decay instead of chopping them", async () => {
  const ctx = fakeCtx();
  const engine = createEngine(ctx, emptyBank, { tickMs: 1e9, lookaheadS: 1.0 });
  let ended = 0;
  engine.onEnded = () => { ended += 1; };
  await engine.play(twoAgainstThree, { loop: false });
  engine.tick(); // schedules the once-through hits; each oscillator gets its 1 decay stop()
  assert.ok(ctx.oscillators.length >= 2);
  for (const osc of ctx.oscillators) {
    assert.equal(osc.stopped.length, 1, "oscillator should have exactly its scheduled decay stop()");
  }
  ctx.currentTime = 0.5; // past patternDuration: natural end
  engine.tick();
  assert.equal(ended, 1);
  assert.equal(engine.playing, false);
  for (const osc of ctx.oscillators) {
    assert.equal(osc.stopped.length, 1, "natural end must not add a second, silencing stop()");
  }
});

function ganganPattern(strokeOver = {}) {
  return pattern([
    { instrument_role: "gangan", pulse_unit: "semiquaver", metric_cycle_length: 2,
      stroke_events: [{ pulse_position: 1, stroke_type: "open", pitch_register: "mid", ...strokeOver }] }
  ]);
}

test("synth voice lands on the drum's own register with a membrane pitch drop", async () => {
  const ctx = fakeCtx();
  const engine = createEngine(ctx, emptyBank, { tickMs: 1e9, lookaheadS: 0.1 });
  await engine.play(ganganPattern(), { loop: false });
  try {
    const target = registerFreq("gangan", "mid"); // NOT the generic 170 Hz anchor
    const events = ctx.oscillators[0].frequency.events;
    const attack = events.find(e => e.type === "setValueAtTime");
    const drop = events.find(e => e.type === "exponentialRampToValueAtTime");
    assert.ok(drop, "membrane voice must sweep down onto the target pitch");
    assert.equal(drop.value, target, "pitch drop must land on the drum's register frequency");
    assert.ok(attack.value > drop.value, "attack must start above where the pitch lands");
  } finally {
    engine.stop();
  }
});

test("synth strokes carry a filtered noise attack transient", async () => {
  const ctx = fakeCtx();
  const engine = createEngine(ctx, emptyBank, { tickMs: 1e9, lookaheadS: 0.1 });
  await engine.play(ganganPattern({ stroke_type: "slap", pitch_register: "low" }), { loop: false });
  try {
    assert.ok(ctx.sources.length >= 1, "a noise burst buffer source must be scheduled");
    assert.ok(ctx.filters.length >= 1, "the noise must pass through a filter, not raw white noise");
    assert.equal(ctx.sources[0].started.length, 1);
  } finally {
    engine.stop();
  }
});

test("register-agnostic samples are rate-shifted within the drum's register range", async () => {
  const ctx = fakeCtx();
  const bank = { preload: async () => {}, getSync: () => ({ buffer: { fake: true }, registerExact: false }) };
  const engine = createEngine(ctx, bank, { tickMs: 1e9, lookaheadS: 0.1 });
  await engine.play(ganganPattern({ pitch_register: "low" }), { loop: false });
  try {
    const g = ROLE_REGISTER_FREQ.gangan;
    const set = ctx.sources[0].playbackRate.events.find(e => e.type === "setValueAtTime");
    assert.equal(set.value, g.low / g.mid, "rate shift must use gangan's own registers, not the generic anchors");
  } finally {
    engine.stop();
  }
});

test("positionsAt reports one position per layer while playing", async () => {
  const ctx = fakeCtx();
  const engine = createEngine(ctx, emptyBank, { tickMs: 1e9, lookaheadS: 0.3 });
  await engine.play(twoAgainstThree, { loop: true });
  const positions = engine.positionsAt(0.125); // 1 pulse in
  assert.equal(positions.length, 2);
  assert.equal(positions[0].pulseIndex, 1); // 3-cycle layer on pulse 2
  assert.equal(positions[1].pulseIndex, 1); // 2-cycle layer on pulse 2
  engine.stop();
});
