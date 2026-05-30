// PatternLibrary.jsx
import React, { useEffect, useState } from "react";
import { api, exportFile } from "../api.js";
import PatternRenderer from "./PatternRenderer.jsx";

export default function PatternLibrary({ vocab, onBenchmark }) {
  const [filters, setFilters] = useState({ orisha: "", ceremony: "", instrument: "", q: "" });
  const [patterns, setPatterns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setError("");
      const list = await api.listPatterns(filters);
      setPatterns(list);
      if (list.length && (!selected || !list.find(p => p.pattern_id === selected.pattern_id))) {
        setSelected(list[0]);
      }
      if (!list.length) setSelected(null);
    } catch (e) { setError(e.message); }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [filters]);

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div className="grid">
      <aside className="panel">
        <h3>Search the corpus</h3>
        <label>Orisha
          <select value={filters.orisha} onChange={set("orisha")}>
            <option value="">any</option>
            {vocab.orisha?.map(o => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label>Ceremony
          <select value={filters.ceremony} onChange={set("ceremony")}>
            <option value="">any</option>
            {vocab.ceremony_types?.map(o => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label>Instrument
          <select value={filters.instrument} onChange={set("instrument")}>
            <option value="">any</option>
            {vocab.instrument_roles?.map(o => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label>Keyword
          <input value={filters.q} onChange={set("q")} placeholder="title or drummer" />
        </label>

        <h3>Results ({patterns.length})</h3>
        {error && <p className="error">{error}</p>}
        <ul className="list">
          {patterns.map(p => (
            <li key={p.pattern_id}
                className={selected?.pattern_id === p.pattern_id ? "active" : ""}
                onClick={() => setSelected(p)}>
              <strong>{p.title}</strong>
              <span>{p.cultural_annotation?.orisha_id} · {p.cultural_annotation?.ceremony_type} · {p.metric_ratio}</span>
            </li>
          ))}
        </ul>
      </aside>

      <section className="panel wide">
        {selected ? (
          <>
            <div className="head-row">
              <div>
                <h2>{selected.title}</h2>
                <p className="muted">
                  {selected.pattern_id} · {selected.cultural_annotation?.orisha_id} worship ·
                  {" "}{selected.cultural_annotation?.regional_variant} · {selected.tempo_bpm} bpm ·
                  {" "}drummer: {selected.cultural_annotation?.source_drummer_id} ·
                  {" "}{selected.cultural_annotation?.validation_status}
                </p>
              </div>
              <div className="actions">
                <button onClick={() => exportFile(selected, "xml")}>Export XML</button>
                <button onClick={() => exportFile(selected, "json")}>Export JSON</button>
                <button className="primary" onClick={() => onBenchmark(selected)}>Benchmark vs MusicXML</button>
              </div>
            </div>
            <PatternRenderer pattern={selected} />
          </>
        ) : <p className="muted">No patterns match the current filters.</p>}
      </section>
    </div>
  );
}
