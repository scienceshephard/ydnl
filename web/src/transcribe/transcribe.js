// transcribe.js
// The assisted-transcription pipeline: onsets -> pitches -> registers/glides
// -> quantized stroke events -> a draft DrumPattern for the Encoder. Pure
// (no browser APIs); tempo, pulse unit, and cycle length come from the user,
// so quantization is deterministic arithmetic. Detection is deliberately
// conservative: anything uncertain defaults to a value that is cheap for a
// human to correct, and the output is always a draft with empty provenance -
// asserting who played what is the human's job (see DATA.md).

import { secondsPerPulse, ROLE_REGISTER_FREQ, REGISTER_FREQ } from "../audio/timing.js";
import { rmsEnvelope, detectOnsets, estimatePitch, decayHalfLife } from "./dsp.js";

const GLIDE_CENTS = 200;          // two semitones: above jitter, below real dundun sweeps
const MUTED_HALF_LIFE_S = 0.09;   // choked strokes die faster than this
const PITCH_A_OFFSET_S = 0.03;    // skip the attack transient (membrane settle)
const PITCH_B_MAX_OFFSET_S = 0.25;

function nearestRegister(role, hz) {
  const table = ROLE_REGISTER_FREQ[role] || REGISTER_FREQ;
  let best = "mid";
  let bestDist = Infinity;
  for (const reg of ["low", "mid", "high"]) {
    const dist = Math.abs(Math.log2(hz / table[reg]));
    if (dist < bestDist) { bestDist = dist; best = reg; }
  }
  return best;
}

export function transcribe(samples, sampleRate, { role, tempoBpm, pulseUnit = "semiquaver", cycleLength, glideCapable = false }) {
  const envelope = rmsEnvelope(samples, sampleRate);
  const onsets = detectOnsets(envelope);
  if (onsets.length === 0) {
    return { pattern: null, report: { error: "no-onsets", rows: [], skipped: 0, onsets: 0 } };
  }

  const spp = secondsPerPulse(tempoBpm, pulseUnit);
  const t0 = onsets[0];
  const usedPulses = new Set();
  const events = [];
  const rows = [];
  let skipped = 0;

  for (let k = 0; k < onsets.length; k++) {
    const t = onsets[k];
    const pulse = Math.round((t - t0) / spp) + 1;
    if (pulse > cycleLength || usedPulses.has(pulse)) { skipped++; continue; }

    const gap = (onsets[k + 1] ?? t + 0.4) - t;
    const fA = estimatePitch(samples, sampleRate, t + PITCH_A_OFFSET_S);
    const fB = estimatePitch(samples, sampleRate, t + Math.min(PITCH_B_MAX_OFFSET_S, gap * 0.6));
    const strokeType = decayHalfLife(envelope, t) < MUTED_HALF_LIFE_S ? "muted" : "open";

    let register;
    let glide = null;
    let uncertain = false;
    if (glideCapable && fA !== null && fB !== null && Math.abs(1200 * Math.log2(fB / fA)) > GLIDE_CENTS) {
      glide = {
        start_register: nearestRegister(role, fA),
        end_register: nearestRegister(role, fB),
        glide_direction: fB > fA ? "ascending" : "descending",
        duration_pulses: Math.min(4, Math.max(1, Math.round(gap / spp)))
      };
      register = "glide";
    } else if (fA === null && fB === null) {
      register = "mid"; // nothing confident to read: flag it for the human
      uncertain = true;
    } else {
      // Geometric mean = the midpoint in log-frequency space, which is the
      // space registers live in.
      const hz = fA !== null && fB !== null ? Math.sqrt(fA * fB) : (fA ?? fB);
      register = nearestRegister(role, hz);
    }

    usedPulses.add(pulse);
    events.push({
      event_id: `EV-tr-${k + 1}`,
      pulse_position: pulse,
      stroke_type: strokeType,
      pitch_register: register,
      duration_pulses: 1,
      dynamics: "mf",
      pitch_glide: glide
    });
    rows.push({ pulse, strokeType, register, glide: glide ? glide.glide_direction : null, uncertain });
  }

  const pattern = {
    pattern_id: `DP-draft-${Date.now().toString(36)}`,
    title: "Transcribed pattern (draft)",
    tempo_bpm: tempoBpm,
    metric_ratio: String(cycleLength),
    ensemble_ref: "",
    cultural_annotation: {
      orisha_id: "", ceremony_type: "", regional_variant: "",
      source_drummer_id: "", validation_status: "draft", recording_uri: ""
    },
    rhythmic_layers: [{
      layer_id: "LY-transcribed-1",
      instrument_role: role,
      pulse_unit: pulseUnit,
      metric_cycle_length: cycleLength,
      offset_pulses: 0,
      stroke_events: events
    }]
  };

  return { pattern, report: { rows, skipped, onsets: onsets.length } };
}
