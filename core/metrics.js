// metrics.js
// Structural feature taxonomy plus the Encoding Completeness Score (ECS) and
// Benchmark Parity Ratio (BPR) from the evaluation framework. The taxonomy is
// the agreed feature set against which encodings are scored.

export const TAXONOMY = [
  "multi_layer",          // more than one concurrent rhythmic layer
  "polymeter",            // layers with differing metric cycle lengths
  "register_tones",       // discrete low/mid/high tonal registers
  "pitch_glide",          // continuous gliding pitch (speech surrogacy)
  "timbre_variation",     // more than one stroke timbre carrying meaning
  "relational_ensemble",  // ensemble modelled as related role nodes
  "cultural_metadata"     // ritual/cultural metadata as structural content
];

// What MusicXML can represent from the taxonomy, even if only in degraded form.
export const MUSICXML_CAPABLE = ["multi_layer", "register_tones"];

// YDNL is designed to represent every feature in the taxonomy.
export const YDNL_CAPABLE = [...TAXONOMY];

export function detectFeatures(pattern) {
  const present = new Set();
  const layers = pattern.rhythmic_layers || [];
  if (layers.length > 1) present.add("multi_layer");

  const cycleLengths = new Set(layers.map(l => l.metric_cycle_length));
  if (cycleLengths.size > 1) present.add("polymeter");

  const strokeTypes = new Set();
  let hasRegister = false;
  let hasGlide = false;
  for (const l of layers) {
    for (const ev of (l.stroke_events || [])) {
      strokeTypes.add(ev.stroke_type);
      if (["low", "mid", "high"].includes(ev.pitch_register)) hasRegister = true;
      if (ev.pitch_glide) hasGlide = true;
    }
  }
  if (hasRegister) present.add("register_tones");
  if (hasGlide) present.add("pitch_glide");
  if (strokeTypes.size > 1) present.add("timbre_variation");
  if (pattern.ensemble_ref || layers.length > 1) present.add("relational_ensemble");

  const ca = pattern.cultural_annotation;
  if (ca && ca.orisha_id && ca.ceremony_type) present.add("cultural_metadata");

  return [...present];
}

function intersect(a, b) { return a.filter(x => b.includes(x)); }

// ECS: fraction of present features that a given encoding capability can carry.
export function computeECS(pattern, capable = YDNL_CAPABLE) {
  const present = detectFeatures(pattern);
  if (present.length === 0) return { ecs: 1, present, encoded: [] };
  const encoded = intersect(present, capable);
  return { ecs: encoded.length / present.length, present, encoded };
}

// BPR over MusicXML: YDNL unique features divided by features shared with the
// competing standard.
export function computeBPR(pattern) {
  const present = detectFeatures(pattern);
  const shared = intersect(present, MUSICXML_CAPABLE);
  const ydnlUnique = present.filter(f => !MUSICXML_CAPABLE.includes(f));
  const bpr = ydnlUnique.length / Math.max(shared.length, 1);
  return { bpr, present, shared, lostInMusicXML: ydnlUnique };
}
