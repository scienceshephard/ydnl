// PatternRenderer.jsx
// Draws an encoded pattern as a colour coded polyrhythmic grid. Each layer is a
// row; each stroke event is a symbol whose shape encodes the stroke type and
// whose position encodes the pulse within that layer's own cycle. Pitch glides
// are drawn as gradient arrows. The independent metric cycles are visible at a
// glance, which is the point. A transport bar plays the pattern; during
// playback each row carries its own playhead wrapping at its own cycle length,
// so the polymeter is audible and visible at once.
import React from "react";
import usePlayback from "../audio/usePlayback.js";

const COLORS = { low: "#b45309", mid: "#2563eb", high: "#16a34a", glide: "#9333ea" };
const W = 720, ROW_H = 64, PAD_L = 140, PAD_R = 24, PAD_T = 28;

function Symbol({ x, y, type, color, sounding }) {
  const r = sounding ? 12 : 9;
  const common = { opacity: sounding ? 1 : 0.85 };
  switch (type) {
    case "open": return <circle cx={x} cy={y} r={r} fill={color} {...common} />;
    case "muted": return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} fill={color} {...common} />;
    case "slap": return <polygon points={`${x},${y - r} ${x + r},${y + r} ${x - r},${y + r}`} fill={color} {...common} />;
    case "heel-toe": return <polygon points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`} fill={color} {...common} />;
    case "rim": return <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={3} {...common} />;
    case "combined": return <g {...common}><circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={3} /><circle cx={x} cy={y} r={3} fill={color} /></g>;
    default: return <circle cx={x} cy={y} r={r} fill={color} {...common} />;
  }
}

export default function PatternRenderer({ pattern }) {
  const { supported, playing, loop, setLoop, toggle, positions } = usePlayback();
  if (!pattern) return null;
  const layers = pattern.rhythmic_layers || [];
  const height = PAD_T * 2 + layers.length * ROW_H;
  const trackW = W - PAD_L - PAD_R;

  return (
    <div className="renderer">
      {supported && layers.length > 0 && (
        <div className="transport">
          <button className="transport-play" onClick={() => toggle(pattern)}>
            {playing ? "■ Stop" : "▶ Play"}
          </button>
          <label className="transport-loop">
            <input type="checkbox" checked={loop} disabled={playing}
              onChange={e => setLoop(e.target.checked)} /> loop
          </label>
          <span className="transport-meta">{pattern.tempo_bpm} bpm</span>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Polyrhythmic grid">
        <defs>
          <linearGradient id="glide" x1="0" x2="1">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#7c3aed" />
          </marker>
        </defs>
        {layers.map((layer, li) => {
          const y = PAD_T + li * ROW_H + ROW_H / 2;
          const cells = layer.metric_cycle_length;
          const step = trackW / cells;
          const pos = positions ? positions[li] : null;
          return (
            <g key={layer.layer_id || li}>
              <text x={12} y={y - 6} className="lyr-name">{layer.instrument_role}</text>
              <text x={12} y={y + 12} className="lyr-meta">{cells}-pulse / {layer.pulse_unit}</text>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e2e8f0" strokeWidth={2} />
              {Array.from({ length: cells }).map((_, c) => (
                <line key={c} x1={PAD_L + c * step} y1={y - 10} x2={PAD_L + c * step} y2={y + 10} stroke="#eef2f7" />
              ))}
              {(layer.stroke_events || []).map((ev, ei) => {
                const x = PAD_L + (ev.pulse_position - 1) * step + step / 2;
                const color = COLORS[ev.pitch_register] || COLORS.mid;
                const sounding = Boolean(pos && !pos.done && pos.pulseIndex === ev.pulse_position - 1);
                if (ev.pitch_glide) {
                  const span = (ev.pitch_glide.duration_pulses || 1) * step;
                  const up = ev.pitch_glide.glide_direction === "ascending";
                  return (
                    <g key={ei}>
                      <line x1={x} y1={up ? y + 12 : y - 12} x2={x + span} y2={up ? y - 12 : y + 12}
                        stroke="url(#glide)" strokeWidth={5} markerEnd="url(#arrow)" />
                      <Symbol x={x} y={y} type={ev.stroke_type} color={COLORS.glide} sounding={sounding} />
                    </g>
                  );
                }
                return <Symbol key={ei} x={x} y={y} type={ev.stroke_type} color={color} sounding={sounding} />;
              })}
              {pos && !pos.done && (
                <line className="playhead"
                  x1={PAD_L + pos.fraction * trackW} y1={y - ROW_H / 2 + 8}
                  x2={PAD_L + pos.fraction * trackW} y2={y + ROW_H / 2 - 8}
                  stroke="#ef4444" strokeWidth={2} />
              )}
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i className="sym circle" /> open</span>
        <span><i className="sym square" /> muted</span>
        <span><i className="sym tri" /> slap</span>
        <span><i className="sym ring" /> rim</span>
        <span><i className="sym glide" /> pitch glide</span>
        <span className="reg low">low</span>
        <span className="reg mid">mid</span>
        <span className="reg high">high</span>
      </div>
    </div>
  );
}
