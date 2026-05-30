// musicxml.js
// Benchmark encoder. It produces a deliberately degraded MusicXML rendering of
// a YDNL pattern and reports exactly which structural features were lost in the
// translation. This is the data source for the Benchmark Parity Ratio and it
// makes the encoding gap concrete for non technical users.

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

export function toMusicXML(pattern) {
  const layers = pattern.rhythmic_layers || [];

  const partList = layers.map((l, i) =>
    `    <score-part id="P${i + 1}"><part-name>${l.instrument_role}</part-name></score-part>`
  ).join("\n");

  // MusicXML forces a single shared time signature. We pick the first layer's
  // cycle length, which already discards the polymetric independence.
  const sharedBeats = layers[0]?.metric_cycle_length || 4;

  const parts = layers.map((l, i) => {
    const notes = (l.stroke_events || []).slice().sort((a, b) => a.pulse_position - b.pulse_position).map(ev => {
      const p = REGISTER_PITCH[ev.pitch_register] || REGISTER_PITCH.mid;
      return [
        "      <note>",
        "        <pitch>",
        `          <step>${p.step}</step>`,
        `          <octave>${p.octave}</octave>`,
        "        </pitch>",
        "        <duration>1</duration>",
        "        <type>16th</type>",
        "      </note>"
      ].join("\n");
    }).join("\n");
    return [
      `  <part id="P${i + 1}">`,
      `    <measure number="1">`,
      `      <attributes><divisions>1</divisions>`,
      `        <time><beats>${sharedBeats}</beats><beat-type>16</beat-type></time>`,
      `      </attributes>`,
      notes,
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
