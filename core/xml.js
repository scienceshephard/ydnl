// xml.js
// Serialisation to and from the YDNL XML format. Serialisation is written by
// hand for full control over the output shape; parsing uses fast-xml-parser.

import { XMLParser } from "fast-xml-parser";
import { createDrumPattern } from "./model.js";

const NS = "https://ydnl.org/schema/v1";

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function toXML(pattern) {
  const ca = pattern.cultural_annotation || {};
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<ydnl version="1.0" xmlns="${NS}">`);
  lines.push(`  <drumPattern id="${esc(pattern.pattern_id)}" title="${esc(pattern.title)}" tempo_bpm="${esc(pattern.tempo_bpm)}" metric_ratio="${esc(pattern.metric_ratio || "")}">`);
  lines.push(`    <culturalAnnotation>`);
  lines.push(`      <orisha>${esc(ca.orisha_id || "")}</orisha>`);
  lines.push(`      <ceremony_type>${esc(ca.ceremony_type || "")}</ceremony_type>`);
  lines.push(`      <regional_variant>${esc(ca.regional_variant || "")}</regional_variant>`);
  lines.push(`      <source_drummer>${esc(ca.source_drummer_id || "")}</source_drummer>`);
  lines.push(`      <validation_status>${esc(ca.validation_status || "draft")}</validation_status>`);
  if (ca.recording_uri) lines.push(`      <recording_uri>${esc(ca.recording_uri)}</recording_uri>`);
  lines.push(`    </culturalAnnotation>`);
  if (pattern.ensemble_ref) lines.push(`    <ensembleRef id="${esc(pattern.ensemble_ref)}" />`);
  lines.push(`    <rhythmicLayers>`);
  for (const layer of pattern.rhythmic_layers) {
    lines.push(`      <layer layer_id="${esc(layer.layer_id)}" instrument_role="${esc(layer.instrument_role)}" metric_cycle_length="${esc(layer.metric_cycle_length)}" pulse_unit="${esc(layer.pulse_unit)}" offset_pulses="${esc(layer.offset_pulses || 0)}">`);
    for (const ev of layer.stroke_events) {
      if (ev.pitch_glide) {
        lines.push(`        <strokeEvent event_id="${esc(ev.event_id)}" pulse="${esc(ev.pulse_position)}" stroke_type="${esc(ev.stroke_type)}" pitch_register="glide" dynamics="${esc(ev.dynamics)}">`);
        const g = ev.pitch_glide;
        lines.push(`          <pitchGlide start="${esc(g.start_register)}" end="${esc(g.end_register)}" direction="${esc(g.glide_direction)}" duration_pulses="${esc(g.duration_pulses)}" />`);
        lines.push(`        </strokeEvent>`);
      } else {
        lines.push(`        <strokeEvent event_id="${esc(ev.event_id)}" pulse="${esc(ev.pulse_position)}" stroke_type="${esc(ev.stroke_type)}" pitch_register="${esc(ev.pitch_register)}" duration_pulses="${esc(ev.duration_pulses)}" dynamics="${esc(ev.dynamics)}" />`);
      }
    }
    lines.push(`      </layer>`);
  }
  lines.push(`    </rhythmicLayers>`);
  lines.push(`  </drumPattern>`);
  lines.push(`</ydnl>`);
  return lines.join("\n");
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => ["layer", "strokeEvent"].includes(name)
});

export function fromXML(xml) {
  const tree = parser.parse(xml);
  const dp = tree?.ydnl?.drumPattern;
  if (!dp) throw new Error("Invalid YDNL XML: missing <drumPattern>.");
  const ca = dp.culturalAnnotation || {};
  const layersRaw = dp.rhythmicLayers?.layer || [];

  const rhythmic_layers = layersRaw.map((layer) => {
    const eventsRaw = layer.strokeEvent || [];
    const stroke_events = eventsRaw.map((ev) => {
      const glide = ev.pitchGlide;
      return {
        event_id: ev["@_event_id"],
        pulse_position: Number(ev["@_pulse"]),
        stroke_type: ev["@_stroke_type"],
        pitch_register: ev["@_pitch_register"] || "mid",
        duration_pulses: Number(ev["@_duration_pulses"] || 1),
        dynamics: ev["@_dynamics"] || "mf",
        pitch_glide: glide ? {
          start_register: glide["@_start"],
          end_register: glide["@_end"],
          glide_direction: glide["@_direction"],
          duration_pulses: Number(glide["@_duration_pulses"] || 1)
        } : null
      };
    });
    return {
      layer_id: layer["@_layer_id"],
      instrument_role: layer["@_instrument_role"],
      pulse_unit: layer["@_pulse_unit"],
      metric_cycle_length: Number(layer["@_metric_cycle_length"]),
      offset_pulses: Number(layer["@_offset_pulses"] || 0),
      stroke_events
    };
  });

  return createDrumPattern({
    pattern_id: dp["@_id"],
    title: dp["@_title"],
    tempo_bpm: Number(dp["@_tempo_bpm"] || 120),
    metric_ratio: dp["@_metric_ratio"] || "",
    ensemble_ref: dp.ensembleRef?.["@_id"] || "",
    cultural_annotation: {
      orisha_id: ca.orisha,
      ceremony_type: ca.ceremony_type,
      regional_variant: ca.regional_variant,
      source_drummer_id: ca.source_drummer,
      validation_status: ca.validation_status,
      recording_uri: ca.recording_uri || ""
    },
    rhythmic_layers
  });
}
