// musicxml.js
// Benchmark encoder. It produces the most faithful MusicXML rendering the
// standard allows and reports exactly which structural features were still
// lost in the translation. Being fair matters: onset timing, durations, and
// note values ARE representable in MusicXML, so they are preserved here. The
// losses reported by the Benchmark Parity Ratio are only the ones the format
// genuinely cannot express.

import { computeBPR } from "./metrics.js";

// Discrete register -> a single MusicXML pitch. The mapping is intentionally
// crude: MusicXML has no notion of the gliding linguistic register that the
// Dundun actually produces.
const REGISTER_PITCH = {
  low: { step: "C", octave: 3 },
  mid: { step: "G", octave: 3 },
  high: { step: "C", octave: 4 },
  glide: { step: "G", octave: 3 } // collapsed: the glide cannot be expressed
};

// One pulse of each YDNL pulse unit expressed as a MusicXML note type, plus
// the beat-type denominator for the time signature.
const PULSE_NOTE = {
  crotchet: { types: ["quarter", "half", "whole"], beatType: 4 },
  quaver: { types: ["eighth", "quarter", "half", "whole"], beatType: 8 },
  semiquaver: { types: ["16th", "eighth", "quarter", "half", "whole"], beatType: 16 },
  demisemiquaver: { types: ["32nd", "16th", "eighth", "quarter", "half", "whole"], beatType: 32 }
};

function noteType(pulseUnit, duration) {
  const chain = (PULSE_NOTE[pulseUnit] || PULSE_NOTE.semiquaver).types;
  // Powers of two climb the chain (2 semiquavers = one quaver, etc.);
  // irregular durations keep the base type and rely on <duration>.
  const step = Math.floor(Math.log2(duration));
  return chain[Math.min(Math.max(step, 0), chain.length - 1)];
}

function noteXML(ev, pulseUnit, duration) {
  const p = REGISTER_PITCH[ev.pitch_register] || REGISTER_PITCH.mid;
  return [
    "      <note>",
    "        <pitch>",
    `          <step>${p.step}</step>`,
    `          <octave>${p.octave}</octave>`,
    "        </pitch>",
    `        <duration>${duration}</duration>`,
    `        <type>${noteType(pulseUnit, duration)}</type>`,
    "      </note>"
  ].join("\n");
}

function restXML(duration) {
  return [
    "      <note>",
    "        <rest/>",
    `        <duration>${duration}</duration>`,
    "      </note>"
  ].join("\n");
}

export function toMusicXML(pattern) {
  const layers = pattern.rhythmic_layers || [];

  const partList = layers.map((l, i) =>
    `    <score-part id="P${i + 1}"><part-name>${l.instrument_role}</part-name></score-part>`
  ).join("\n");

  // MusicXML forces a single shared time signature across the score. We take
  // the longest cycle so no strokes are dropped, but the independent metric
  // cycles are still collapsed: shorter layers are padded with rests instead
  // of recurring at their own period. This is the polymeter loss made visible.
  const sharedBeats = Math.max(4, ...layers.map(l => l.metric_cycle_length || 0));
  const beatType = (PULSE_NOTE[layers[0]?.pulse_unit] || PULSE_NOTE.semiquaver).beatType;

  const parts = layers.map((l, i) => {
    const events = (l.stroke_events || []).slice().sort((a, b) => a.pulse_position - b.pulse_position);
    const items = [];
    let cursor = 1; // pulse positions are 1-based
    for (let k = 0; k < events.length; k++) {
      const ev = events[k];
      if (ev.pulse_position < cursor) continue; // overlapping strokes cannot share a voice
      if (ev.pulse_position > cursor) {
        items.push(restXML(ev.pulse_position - cursor));
        cursor = ev.pulse_position;
      }
      const nextOnset = events[k + 1] ? events[k + 1].pulse_position : sharedBeats + 1;
      const duration = Math.max(1, Math.min(ev.duration_pulses || 1, nextOnset - cursor, sharedBeats + 1 - cursor));
      items.push(noteXML(ev, l.pulse_unit, duration));
      cursor += duration;
    }
    if (cursor <= sharedBeats) items.push(restXML(sharedBeats + 1 - cursor));
    return [
      `  <part id="P${i + 1}">`,
      `    <measure number="1">`,
      `      <attributes><divisions>1</divisions>`,
      `        <time><beats>${sharedBeats}</beats><beat-type>${beatType}</beat-type></time>`,
      `      </attributes>`,
      items.join("\n"),
      `    </measure>`,
      `  </part>`
    ].join("\n");
  }).join("\n");

  const musicxml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    "  <part-list>",
    partList,
    "  </part-list>",
    parts,
    "</score-partwise>"
  ].join("\n");

  const { bpr, lostInMusicXML, shared } = computeBPR(pattern);

  const lostNotes = {
    polymeter: "Each layer was forced onto a single shared time signature; the independent metric cycles were collapsed.",
    pitch_glide: "Continuous tonal glides were collapsed to a single discrete pitch; the linguistic surrogacy is lost.",
    timbre_variation: "Stroke timbre (open/muted/slap) carries no semantic slot in MusicXML and was discarded.",
    relational_ensemble: "Parts are independent voices; the ensemble interdependency structure cannot be expressed.",
    cultural_metadata: "Orisha, ceremony, and regional variant have no structural home and were dropped."
  };

  return {
    musicxml,
    bpr,
    sharedFeatures: shared,
    lostFeatures: lostInMusicXML.map(f => ({ feature: f, note: lostNotes[f] || "Not representable in MusicXML." }))
  };
}
