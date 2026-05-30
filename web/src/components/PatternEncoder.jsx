// PatternEncoder.jsx
// A compact graphical encoder. Users define the cultural annotation and one or
// more layers, place stroke events, preview the rendering live, and save the
// pattern through the schema validated API.
import React, { useState } from "react";
import { api } from "../api.js";
import PatternRenderer from "./PatternRenderer.jsx";

const blankLayer = (vocab) => ({
  instrument_role: vocab.instrument_roles?.[0] || "iya-ilu",
  pulse_unit: "semiquaver",
  metric_cycle_length: 8,
  offset_pulses: 0,
  stroke_events: []
});

export default function PatternEncoder({ vocab, onSaved }) {
  const [title, setTitle] = useState("New pattern");
  const [tempo, setTempo] = useState(120);
  const [ca, setCa] = useState({
    orisha_id: vocab.orisha?.[0] || "Sango",
    ceremony_type: vocab.ceremony_types?.[0] || "festival",
    regional_variant: vocab.regional_variants?.[0] || "Oyo",
    source_drummer_id: "",
    validation_status: "draft"
  });
  const [layers, setLayers] = useState([blankLayer(vocab)]);
  const [msg, setMsg] = useState(null);

  const pattern = {
    title, tempo_bpm: Number(tempo),
    cultural_annotation: ca,
    rhythmic_layers: layers
  };

  function updateLayer(i, patch) {
    setLayers(layers.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function addEvent(i) {
    const l = layers[i];
    const ev = { pulse_position: 1, stroke_type: vocab.stroke_types?.[0] || "open", pitch_register: "mid", duration_pulses: 1, dynamics: "mf", pitch_glide: null };
    updateLayer(i, { stroke_events: [...l.stroke_events, ev] });
  }
  function updateEvent(i, j, patch) {
    const l = layers[i];
    const events = l.stroke_events.map((e, idx) => {
      if (idx !== j) return e;
      const next = { ...e, ...patch };
      if (patch.pitch_register === "glide" && !next.pitch_glide) {
        next.pitch_glide = { start_register: "mid", end_register: "high", glide_direction: "ascending", duration_pulses: 1 };
      }
      if (patch.pitch_register && patch.pitch_register !== "glide") next.pitch_glide = null;
      return next;
    });
    updateLayer(i, { stroke_events: events });
  }

  async function save() {
    try {
      setMsg(null);
      const saved = await api.savePattern(pattern);
      setMsg({ ok: true, text: `Saved ${saved.pattern_id} (metric ratio ${saved.metric_ratio}).` });
      onSaved && onSaved(saved);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    }
  }

  return (
    <div className="grid">
      <aside className="panel">
        <h3>Pattern</h3>
        <label>Title <input value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label>Tempo (bpm) <input type="number" value={tempo} onChange={e => setTempo(e.target.value)} /></label>

        <h3>Cultural annotation (mandatory)</h3>
        <label>Orisha
          <select value={ca.orisha_id} onChange={e => setCa({ ...ca, orisha_id: e.target.value })}>
            {vocab.orisha?.map(o => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label>Ceremony
          <select value={ca.ceremony_type} onChange={e => setCa({ ...ca, ceremony_type: e.target.value })}>
            {vocab.ceremony_types?.map(o => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label>Region
          <select value={ca.regional_variant} onChange={e => setCa({ ...ca, regional_variant: e.target.value })}>
            {vocab.regional_variants?.map(o => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label>Source drummer <input value={ca.source_drummer_id} onChange={e => setCa({ ...ca, source_drummer_id: e.target.value })} /></label>

        <button className="primary" onClick={save}>Validate and save</button>
        {msg && <p className={msg.ok ? "ok" : "error"}>{msg.text}</p>}
      </aside>

      <section className="panel wide">
        <div className="head-row">
          <h2>Layers</h2>
          <button onClick={() => setLayers([...layers, blankLayer(vocab)])}>Add layer</button>
        </div>

        {layers.map((l, i) => (
          <div className="layer-card" key={i}>
            <div className="layer-head">
              <select value={l.instrument_role} onChange={e => updateLayer(i, { instrument_role: e.target.value })}>
                {vocab.instrument_roles?.map(o => <option key={o}>{o}</option>)}
              </select>
              <label>cycle <input type="number" min="1" value={l.metric_cycle_length}
                onChange={e => updateLayer(i, { metric_cycle_length: Number(e.target.value) })} /></label>
              <select value={l.pulse_unit} onChange={e => updateLayer(i, { pulse_unit: e.target.value })}>
                {vocab.pulse_units?.map(o => <option key={o}>{o}</option>)}
              </select>
              <button onClick={() => addEvent(i)}>+ stroke</button>
              {layers.length > 1 && <button className="danger" onClick={() => setLayers(layers.filter((_, idx) => idx !== i))}>remove layer</button>}
            </div>
            <div className="events">
              {l.stroke_events.map((ev, j) => (
                <div className="event-row" key={j}>
                  <label>pulse <input type="number" min="1" max={l.metric_cycle_length} value={ev.pulse_position}
                    onChange={e => updateEvent(i, j, { pulse_position: Number(e.target.value) })} /></label>
                  <select value={ev.stroke_type} onChange={e => updateEvent(i, j, { stroke_type: e.target.value })}>
                    {vocab.stroke_types?.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <select value={ev.pitch_register} onChange={e => updateEvent(i, j, { pitch_register: e.target.value })}>
                    {vocab.pitch_registers?.map(o => <option key={o}>{o}</option>)}
                  </select>
                  {ev.pitch_register === "glide" && ev.pitch_glide && (
                    <span className="glide-fields">
                      <select value={ev.pitch_glide.glide_direction}
                        onChange={e => updateEvent(i, j, { pitch_glide: { ...ev.pitch_glide, glide_direction: e.target.value } })}>
                        {vocab.glide_directions?.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </span>
                  )}
                  <button className="danger" onClick={() => updateLayer(i, { stroke_events: l.stroke_events.filter((_, idx) => idx !== j) })}>×</button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <h3>Live preview</h3>
        <PatternRenderer pattern={pattern} />
      </section>
    </div>
  );
}
