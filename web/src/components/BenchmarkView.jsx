// BenchmarkView.jsx
// Runs the MusicXML benchmark for a chosen pattern and shows the parity ratio,
// the features lost in translation, and the generated (degraded) MusicXML.
import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function BenchmarkView({ pattern }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    if (!pattern) return;
    setResult(null); setError("");
    api.benchmark(pattern)
      .then(r => { if (live) setResult(r); })
      .catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [pattern]);

  if (!pattern) return <p className="muted">Select a pattern in the Library, then click "Benchmark vs MusicXML".</p>;
  if (error) return <p className="error">{error}</p>;
  if (!result) return <p className="muted">Encoding {pattern.title} as MusicXML…</p>;

  return (
    <div className="panel wide">
      <h2>Benchmark: {pattern.title}</h2>
      <div className="metrics">
        <div className="metric"><span className="big">{result.ecs_ydnl}</span><label>ECS (YDNL)</label></div>
        <div className="metric"><span className="big">{result.ecs_musicxml}</span><label>ECS (MusicXML)</label></div>
        <div className="metric"><span className="big">{result.bpr}</span><label>Benchmark Parity Ratio</label></div>
      </div>

      <p className="muted">
        Of {result.featuresPresent.length} structural features present, MusicXML can carry only
        {" "}{result.sharedFeatures.length} ({result.sharedFeatures.join(", ") || "none"}). The rest are lost:
      </p>
      <ul className="lost">
        {result.lostFeatures.map(l => (
          <li key={l.feature}><strong>{l.feature}</strong>: {l.note}</li>
        ))}
      </ul>

      <h3>Generated MusicXML (degraded)</h3>
      <pre className="code">{result.musicxml}</pre>
    </div>
  );
}
