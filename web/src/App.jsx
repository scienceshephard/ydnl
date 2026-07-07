// App.jsx
import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import PatternLibrary from "./components/PatternLibrary.jsx";
import PatternEncoder from "./components/PatternEncoder.jsx";
import BenchmarkView from "./components/BenchmarkView.jsx";
import TranscribeView from "./transcribe/TranscribeView.jsx";

export default function App() {
  const [tab, setTab] = useState("library");
  const [vocab, setVocab] = useState({});
  const [benchPattern, setBenchPattern] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [down, setDown] = useState(false);
  const [encoderSeed, setEncoderSeed] = useState(null);

  useEffect(() => {
    api.vocabulary().then(setVocab).catch(() => setDown(true));
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>YorubaDrum Notation Language</h1>
          <p className="tagline">An open framework for encoding Yoruba Dùndún and Bàtá polyrhythmic music</p>
        </div>
        <nav>
          <button className={tab === "library" ? "tab active" : "tab"} onClick={() => setTab("library")}>Library</button>
          <button className={tab === "encoder" ? "tab active" : "tab"} onClick={() => setTab("encoder")}>Encoder</button>
          <button className={tab === "transcribe" ? "tab active" : "tab"} onClick={() => setTab("transcribe")}>Transcribe</button>
          <button className={tab === "benchmark" ? "tab active" : "tab"} onClick={() => setTab("benchmark")}>Benchmark</button>
        </nav>
      </header>

      {down && (
        <p className="error banner">Cannot reach the API. Start it with <code>npm run server</code> on port 4000.</p>
      )}

      <main>
        {tab === "library" && (
          <PatternLibrary
            key={refreshKey}
            vocab={vocab}
            onBenchmark={(p) => { setBenchPattern(p); setTab("benchmark"); }}
          />
        )}
        {tab === "encoder" && (
          <PatternEncoder
            key={encoderSeed ? encoderSeed.pattern_id : "blank"}
            vocab={vocab}
            seed={encoderSeed}
            onSaved={() => { setEncoderSeed(null); setRefreshKey(k => k + 1); setTab("library"); }}
          />
        )}
        {tab === "transcribe" && (
          <TranscribeView
            vocab={vocab}
            onOpenInEncoder={(p) => { setEncoderSeed(p); setTab("encoder"); }}
          />
        )}
        {tab === "benchmark" && <BenchmarkView pattern={benchPattern} />}
      </main>

      <footer className="foot">
        YDNL prototype · released under CC BY 4.0 · corpus and schema are open artefacts
      </footer>
    </div>
  );
}
