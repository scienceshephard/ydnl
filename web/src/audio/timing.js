// timing.js
// Pure playback math for the YDNL audio engine: pulse durations, per-layer
// playhead positions, scheduling windows, sample file resolution, and glide
// rate ratios. No Web Audio here, so everything is unit-testable in Node.
// A layer's clock: pulse p (1-based) sounds at (offset_pulses + p - 1) pulses
// from playback start; in loop mode it recurs every metric_cycle_length pulses.

export const PULSE_FRACTION = { crotchet: 1, quaver: 0.5, semiquaver: 0.25, demisemiquaver: 0.125 };

// Generic register anchors, used only for roles missing from
// ROLE_REGISTER_FREQ. Each drum otherwise speaks in its own range below.
export const REGISTER_FREQ = { low: 120, mid: 170, high: 240 };

// Per-drum register ranges (Hz). The mother drums (iya-ilu, iya-ilu-dundun)
// are the deep voices of their ensembles; gangan and kerikeri sit in a
// low-mid band; the small omele/kudi chatter up high; the gudugudu kettle
// is nearly fixed, so its range is deliberately narrow. Glide and
// register-shift ratios are computed within a drum's own range, so dundun
// speech surrogacy keeps its sweep regardless of how deep the drum sits.
export const ROLE_REGISTER_FREQ = {
  "iya-ilu":        { low: 70,  mid: 95,  high: 130 },
  "omele-abo":      { low: 130, mid: 170, high: 220 },
  "omele-ako":      { low: 200, mid: 260, high: 330 },
  "kudi":           { low: 230, mid: 300, high: 380 },
  "iya-ilu-dundun": { low: 75,  mid: 105, high: 150 },
  "gangan":         { low: 90,  mid: 130, high: 180 },
  "kerikeri":       { low: 80,  mid: 110, high: 150 },
  "gudugudu":       { low: 140, mid: 160, high: 180 }
};

export const DYNAMICS_GAIN = { pp: 0.3, p: 0.45, mp: 0.6, mf: 0.7, f: 0.85, ff: 1.0 };

export function secondsPerPulse(tempoBpm, pulseUnit) {
  return (60 / tempoBpm) * (PULSE_FRACTION[pulseUnit] ?? PULSE_FRACTION.semiquaver);
}

// The frequency a drum sounds for a register: the role's own range when we
// know the drum, the generic anchors otherwise.
export function registerFreq(role, register) {
  const table = ROLE_REGISTER_FREQ[role] || REGISTER_FREQ;
  return table[register] || table.mid;
}

export function glideRateRatio(startRegister, endRegister, role) {
  return registerFreq(role, endRegister) / registerFreq(role, startRegister);
}

export function registerRateRatio(register, role) {
  return registerFreq(role, register) / registerFreq(role, "mid");
}

// The register a stroke event actually needs a file/rate for: glides play
// (and preload) the start-register sample and bend it from there. Shared by
// preload and playback lookups so they always agree on which file a glide
// resolves to.
export function fileRegister(ev) {
  return ev.pitch_register === "glide" ? (ev.pitch_glide?.start_register || "mid") : ev.pitch_register;
}

// Ordered relative paths to try for a stroke's sample. "glide" is a pitch
// treatment, not a recordable register, so it never names a file; callers
// pass the glide's start register instead.
export function sampleCandidates(role, strokeType, register) {
  const paths = [];
  if (register && register !== "glide") paths.push(`samples/${role}/${strokeType}_${register}.wav`);
  paths.push(`samples/${role}/${strokeType}.wav`);
  return paths;
}

export function layerPosition(layer, tempoBpm, elapsedSeconds, loop) {
  const spp = secondsPerPulse(tempoBpm, layer.pulse_unit);
  const cycleSeconds = layer.metric_cycle_length * spp;
  // A zero/negative cycle length or tempo has no valid clock; report the
  // idle position rather than dividing by zero (NaN) or looping forever.
  if (!(spp > 0) || !(cycleSeconds > 0)) return { pulseIndex: 0, fraction: 0, done: false };
  const local = elapsedSeconds - (layer.offset_pulses || 0) * spp;
  if (local < 0) return { pulseIndex: 0, fraction: 0, done: false };
  if (!loop && local >= cycleSeconds) {
    return { pulseIndex: layer.metric_cycle_length - 1, fraction: 1, done: true };
  }
  const wrapped = loop ? local % cycleSeconds : local;
  return { pulseIndex: Math.floor(wrapped / spp), fraction: wrapped / cycleSeconds, done: false };
}

// All stroke onsets falling in the half-open window [fromSeconds, toSeconds),
// as seconds from playback start. Loop mode repeats each stroke at the
// layer's own cycle length - this is where the polymeter comes from.
export function strokeTimesInWindow(layer, tempoBpm, fromSeconds, toSeconds, loop) {
  const spp = secondsPerPulse(tempoBpm, layer.pulse_unit);
  const cycleSeconds = layer.metric_cycle_length * spp;
  const out = [];
  // A non-positive tempo or cycle length has no valid clock: `!(x > 0)` also
  // catches NaN, so this guards both bad inputs and avoids the `t += 0`
  // infinite loop below when cycleSeconds is 0.
  if (!(spp > 0) || !(cycleSeconds > 0)) return out;
  for (const ev of layer.stroke_events || []) {
    const base = ((layer.offset_pulses || 0) + ev.pulse_position - 1) * spp;
    if (!loop) {
      if (base >= fromSeconds && base < toSeconds) out.push({ ev, when: base });
      continue;
    }
    const firstCycle = Math.max(0, Math.ceil((fromSeconds - base) / cycleSeconds));
    for (let t = base + firstCycle * cycleSeconds; t < toSeconds; t += cycleSeconds) {
      out.push({ ev, when: t });
    }
  }
  return out.sort((a, b) => a.when - b.when);
}

// Once-mode playback length: every layer finishes exactly one cycle.
export function patternDuration(pattern) {
  let max = 0;
  for (const l of pattern.rhythmic_layers || []) {
    const spp = secondsPerPulse(pattern.tempo_bpm, l.pulse_unit);
    max = Math.max(max, ((l.offset_pulses || 0) + l.metric_cycle_length) * spp);
  }
  return max;
}
