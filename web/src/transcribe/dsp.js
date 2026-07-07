// dsp.js
// Dependency-free signal processing for assisted transcription: RMS envelope,
// onset detection by envelope rise, autocorrelation pitch estimation, and
// decay measurement. Everything operates on plain Float32Arrays so it runs
// identically in the browser and in Node tests with synthesized audio.

export function rmsEnvelope(samples, sampleRate, { frameSize = 1024, hop = 512 } = {}) {
  const count = Math.max(0, Math.floor((samples.length - frameSize) / hop) + 1);
  const frames = new Float32Array(count);
  for (let f = 0; f < count; f++) {
    const start = f * hop;
    let sum = 0;
    for (let i = start; i < start + frameSize; i++) sum += samples[i] * samples[i];
    frames[f] = Math.sqrt(sum / frameSize);
  }
  return { frames, hopSeconds: hop / sampleRate };
}

// An onset is the envelope rising through 1.5x its local median (with an
// absolute floor so silence cannot trigger). The refractory period stops a
// single attack from firing on consecutive frames. Frame 0 has no previous
// frame to rise from, so it is checked directly against its own threshold:
// a clip trimmed tight to the first hit still yields that onset.
export function detectOnsets(envelope, { medianWindowSeconds = 0.5, riseFactor = 1.5, refractorySeconds = 0.05, floor = 0.01 } = {}) {
  const { frames, hopSeconds } = envelope;
  const half = Math.max(1, Math.round(medianWindowSeconds / hopSeconds / 2));
  const onsets = [];
  let last = -Infinity;
  if (frames.length > 0) {
    const sorted = Array.from(frames.slice(0, Math.min(frames.length, half))).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const threshold = Math.max(median * riseFactor, floor);
    if (frames[0] >= threshold) {
      onsets.push(0);
      last = 0;
    }
  }
  for (let i = 1; i < frames.length; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(frames.length, i + half);
    const sorted = Array.from(frames.slice(lo, hi)).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const threshold = Math.max(median * riseFactor, floor);
    const t = i * hopSeconds;
    if (frames[i] >= threshold && frames[i - 1] < threshold && t - last >= refractorySeconds) {
      onsets.push(t);
      last = t;
    }
  }
  return onsets;
}

// Autocorrelation pitch estimate over a short window. Returns null when no
// candidate period is convincing (noise, silence, or a window past the clip).
// Each lag's sum has n - lag terms, so it is length-normalized before dividing
// by the full-window energy; otherwise long lags (low frequencies) are
// penalized by up to ~28% and real low drum strokes fall under the floor.
export function estimatePitch(samples, sampleRate, startSeconds, { windowSeconds = 0.06, minHz = 60, maxHz = 500, minCorrelation = 0.5 } = {}) {
  const start = Math.max(0, Math.round(startSeconds * sampleRate));
  const n = Math.min(Math.round(windowSeconds * sampleRate), samples.length - start);
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.ceil(sampleRate / minHz);
  if (n < maxLag + 8) return null;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += samples[start + i] * samples[start + i];
  if (energy < 1e-6) return null;
  let bestLag = 0;
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < n; i++) sum += samples[start + i] * samples[start + i + lag];
    const corr = (sum * n) / ((n - lag) * energy);
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }
  if (bestLag === 0 || bestCorr < minCorrelation) return null;
  return sampleRate / bestLag;
}

// Seconds for the envelope to fall to half its post-onset peak. Feeds the
// open-vs-muted call: a choked stroke dies fast, an open one rings.
export function decayHalfLife(envelope, onsetSeconds) {
  const { frames, hopSeconds } = envelope;
  const start = Math.max(0, Math.round(onsetSeconds / hopSeconds));
  let peakIdx = start;
  let peak = 0;
  for (let i = start; i < Math.min(frames.length, start + 4); i++) {
    if (frames[i] > peak) { peak = frames[i]; peakIdx = i; }
  }
  if (peak <= 0) return 0;
  for (let i = peakIdx + 1; i < frames.length; i++) {
    if (frames[i] <= peak / 2) return (i - peakIdx) * hopSeconds;
  }
  return (frames.length - 1 - peakIdx) * hopSeconds;
}
