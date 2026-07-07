// TranscribeView.jsx
// Assisted transcription tab: upload a single-drum recording, tell the app
// what the drummer knew (drum, tempo, cycle), and get a draft pattern with a
// per-stroke report and a playable preview. "Open in Encoder" hands the
// draft over for human correction - it saves through the same validation as
// a hand-typed pattern, including the mandatory cultural annotation.
import React, { useState } from "react";
import PatternRenderer from "../components/PatternRenderer.jsx";
import { getAudioContext, audioSupported } from "../audio/context.js";
import { transcribe } from "./transcribe.js";

export default function TranscribeView({ vocab, onOpenInEncoder }) {
  const [file, setFile] = useState(null);
  const [role, setRole] = useState("iya-ilu-dundun");
  const [bpm, setBpm] = useState(120);
  const [pulseUnit, setPulseUnit] = useState("semiquaver");
  const [cycleLength, setCycleLength] = useState(12);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const ready = file && Number(bpm) > 0 && Number(cycleLength) > 0 && !busy;

  async function run() {
    if (!ready) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      let decoded;
      try {
        decoded = await getAudioContext().decodeAudioData(await file.arrayBuffer());
      } catch {
        setError("Couldn't read this audio file - try a WAV or MP3 export.");
        return; // early return is safe: the outer finally still resets busy
      }
      const mono = new Float32Array(decoded.length);
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const data = decoded.getChannelData(ch);
        for (let i = 0; i < mono.length; i++) mono[i] += data[i] / decoded.numberOfChannels;
      }
      const out = transcribe(mono, decoded.sampleRate, {
        role,
        tempoBpm: Number(bpm),
        pulseUnit,
        cycleLength: Number(cycleLength),
        glideCapable: (vocab.glide_capable_roles || []).includes(role)
      });
      if (!out.pattern) {
        setError("No drum strokes detected - check the recording level or trim leading silence.");
      } else if (out.report.rows.length === 0) {
        setError("Strokes were detected, but none landed inside the cycle - check the tempo and cycle length.");
      } else {
        setResult(out);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!audioSupported()) {
    return <section className="panel"><p>Transcription needs Web Audio, which this browser does not support.</p></section>;
  }

  return (
    <div className="transcribe">
      <section className="panel">
        <h2>Transcribe a recording</h2>
        <p className="hint">
          One drum per recording. You supply what the drummer knew - tempo and
          cycle length - and the analysis drafts the strokes for you to correct.
        </p>
        <div className="transcribe-form">
          <label>recording
            <input type="file" accept="audio/*" disabled={busy}
              onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); setError(""); }} />
          </label>
          <label>drum
            <select value={role} disabled={busy} onChange={e => setRole(e.target.value)}>
              {vocab.instrument_roles?.map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label>tempo (bpm)
            <input type="number" min="1" value={bpm} disabled={busy} onChange={e => setBpm(e.target.value)} />
          </label>
          <label>pulse
            <select value={pulseUnit} disabled={busy} onChange={e => setPulseUnit(e.target.value)}>
              {vocab.pulse_units?.map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label>cycle length
            <input type="number" min="1" value={cycleLength} disabled={busy} onChange={e => setCycleLength(e.target.value)} />
          </label>
          <button disabled={!ready} onClick={run}>{busy ? "Analyzing..." : "Transcribe"}</button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <section className="panel wide">
          <div className="head-row">
            <h2>Draft: {result.report.rows.length} strokes
              {result.report.skipped > 0 && <span className="hint"> ({result.report.skipped} onsets outside the cycle or colliding were skipped)</span>}
            </h2>
            <button onClick={() => onOpenInEncoder(result.pattern)}>Open in Encoder</button>
          </div>
          <table className="transcribe-table">
            <thead><tr><th>pulse</th><th>stroke</th><th>register</th><th>glide</th><th></th></tr></thead>
            <tbody>
              {result.report.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.pulse}</td>
                  <td>{r.strokeType}</td>
                  <td>{r.register}</td>
                  <td>{r.glide || "-"}</td>
                  <td>{r.uncertain ? "check me" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <PatternRenderer pattern={result.pattern} />
          <p className="hint">
            This is a draft: correct it in the Encoder, and complete the
            cultural annotation before saving - provenance is yours to assert,
            not the machine's.
          </p>
        </section>
      )}
    </div>
  );
}
