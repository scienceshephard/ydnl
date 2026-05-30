// model.js
// Factory helpers and normalisation for the YDNL data model. The model mirrors
// the entities described in the YDNL specification: DrumPattern is the root
// aggregate that owns RhythmicLayers, which own StrokeEvents, which may carry a
// PitchGlide. CulturalAnnotation is embedded directly in the pattern; the
// EnsembleConfig is referenced.

let counter = 0;
function uid(prefix) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function createPitchGlide({ start_register, end_register, glide_direction = "ascending", duration_pulses = 1 }) {
  return { start_register, end_register, glide_direction, duration_pulses };
}

export function createStrokeEvent({
  event_id, pulse_position, stroke_type, pitch_register = "mid",
  duration_pulses = 1, dynamics = "mf", pitch_glide = null
}) {
  return {
    event_id: event_id || uid("EV"),
    pulse_position,
    stroke_type,
    pitch_register: pitch_glide ? "glide" : pitch_register,
    duration_pulses,
    dynamics,
    pitch_glide: pitch_glide || null
  };
}

export function createRhythmicLayer({
  layer_id, instrument_role, pulse_unit = "semiquaver",
  metric_cycle_length, offset_pulses = 0, stroke_events = []
}) {
  return {
    layer_id: layer_id || uid("LY"),
    instrument_role,
    pulse_unit,
    metric_cycle_length,
    offset_pulses,
    stroke_events: stroke_events.map(createStrokeEvent)
  };
}

export function createCulturalAnnotation({
  orisha_id, ceremony_type, regional_variant,
  source_drummer_id = "", validation_status = "draft", recording_uri = ""
}) {
  return { orisha_id, ceremony_type, regional_variant, source_drummer_id, validation_status, recording_uri };
}

export function createEnsembleConfig({ ensemble_id, instrument_nodes = [], interdependency_rules = [] }) {
  return { ensemble_id: ensemble_id || uid("ENS"), instrument_nodes, interdependency_rules };
}

export function createDrumPattern({
  pattern_id, title, tempo_bpm = 120, metric_ratio = "",
  ensemble_ref = "", cultural_annotation, rhythmic_layers = []
}) {
  return {
    pattern_id: pattern_id || uid("DP"),
    title: title || "Untitled pattern",
    tempo_bpm,
    metric_ratio,
    ensemble_ref,
    cultural_annotation: cultural_annotation ? createCulturalAnnotation(cultural_annotation) : null,
    rhythmic_layers: rhythmic_layers.map(createRhythmicLayer)
  };
}

// Derive the polymetric ratio string from the layers (e.g. "12:8").
export function deriveMetricRatio(pattern) {
  const lengths = [...new Set(pattern.rhythmic_layers.map(l => l.metric_cycle_length))];
  return lengths.join(":");
}
