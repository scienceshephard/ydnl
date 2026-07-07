// validate.js
// Dependency free structural validator. It enforces the schema rules that make
// a YDNL file compliant, including the rule that a CulturalAnnotation is
// MANDATORY: a pattern without it is incomplete data, not complete data with
// optional metadata. Returns { valid, errors } with element level messages.

import {
  STROKE_TYPES, PITCH_REGISTERS, GLIDE_DIRECTIONS, PULSE_UNITS,
  ORISHA, CEREMONY_TYPES, REGIONAL_VARIANTS, INSTRUMENT_ROLES,
  GLIDE_CAPABLE_ROLES, isMember
} from "./vocabulary.js";

export function validatePattern(pattern) {
  const errors = [];
  const e = (path, msg) => errors.push({ path, message: msg });

  if (!pattern || typeof pattern !== "object") {
    return { valid: false, errors: [{ path: "/", message: "Pattern must be an object." }] };
  }

  if (!pattern.pattern_id) e("/pattern_id", "pattern_id is required.");
  if (!pattern.title) e("/title", "title is required.");
  if (typeof pattern.tempo_bpm !== "number" || pattern.tempo_bpm <= 0) {
    e("/tempo_bpm", "tempo_bpm must be a positive number.");
  }

  // Cultural annotation is mandatory.
  const ca = pattern.cultural_annotation;
  if (!ca) {
    e("/cultural_annotation", "CulturalAnnotation is mandatory. A pattern without it is schema non compliant.");
  } else {
    if (!isMember(ORISHA, ca.orisha_id)) e("/cultural_annotation/orisha_id", `orisha_id '${ca.orisha_id}' is not in the controlled vocabulary.`);
    if (!isMember(CEREMONY_TYPES, ca.ceremony_type)) e("/cultural_annotation/ceremony_type", `ceremony_type '${ca.ceremony_type}' is not in the controlled vocabulary.`);
    if (ca.regional_variant && !isMember(REGIONAL_VARIANTS, ca.regional_variant)) e("/cultural_annotation/regional_variant", `regional_variant '${ca.regional_variant}' is not in the controlled vocabulary.`);
  }

  // Layers.
  if (!Array.isArray(pattern.rhythmic_layers) || pattern.rhythmic_layers.length === 0) {
    e("/rhythmic_layers", "At least one RhythmicLayer is required.");
  } else {
    pattern.rhythmic_layers.forEach((layer, i) => {
      const lp = `/rhythmic_layers/${i}`;
      if (!isMember(INSTRUMENT_ROLES, layer.instrument_role)) e(`${lp}/instrument_role`, `instrument_role '${layer.instrument_role}' is not in the controlled vocabulary.`);
      if (!isMember(PULSE_UNITS, layer.pulse_unit)) e(`${lp}/pulse_unit`, `pulse_unit '${layer.pulse_unit}' is not in the controlled vocabulary.`);
      if (!Number.isInteger(layer.metric_cycle_length) || layer.metric_cycle_length < 1) e(`${lp}/metric_cycle_length`, "metric_cycle_length must be a positive integer.");

      if (!Array.isArray(layer.stroke_events)) {
        e(`${lp}/stroke_events`, "stroke_events must be an array.");
        return;
      }
      layer.stroke_events.forEach((ev, j) => {
        const ep = `${lp}/stroke_events/${j}`;
        if (!isMember(STROKE_TYPES, ev.stroke_type)) e(`${ep}/stroke_type`, `stroke_type '${ev.stroke_type}' is not in the controlled vocabulary.`);
        if (!isMember(PITCH_REGISTERS, ev.pitch_register)) e(`${ep}/pitch_register`, `pitch_register '${ev.pitch_register}' is not in the controlled vocabulary.`);
        if (!Number.isInteger(ev.pulse_position) || ev.pulse_position < 1 || ev.pulse_position > layer.metric_cycle_length) {
          e(`${ep}/pulse_position`, `pulse_position must be an integer within 1..${layer.metric_cycle_length}.`);
        }
        if (ev.pitch_register === "glide" && !ev.pitch_glide) {
          e(`${ep}/pitch_glide`, "A glide register requires a pitch_glide element.");
        }
        if (ev.pitch_glide) {
          const g = ev.pitch_glide;
          if (!isMember(GLIDE_DIRECTIONS, g.glide_direction)) e(`${ep}/pitch_glide/glide_direction`, `glide_direction '${g.glide_direction}' is not valid.`);
        }
        // Organological constraint: only Dundun tension drums can bend pitch.
        if ((ev.pitch_glide || ev.pitch_register === "glide") && !isMember(GLIDE_CAPABLE_ROLES, layer.instrument_role)) {
          e(`${ep}/pitch_glide`, `instrument_role '${layer.instrument_role}' is a fixed-pitch drum and cannot carry a pitch glide. Glide-capable roles: ${GLIDE_CAPABLE_ROLES.join(", ")}.`);
        }
      });
    });
  }

  return { valid: errors.length === 0, errors };
}
