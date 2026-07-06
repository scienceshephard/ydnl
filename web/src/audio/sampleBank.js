// sampleBank.js
// Loads and caches the user-provided drum recordings. Files follow
// public/samples/<instrument_role>/<stroke_type>_<register>.wav with a
// register-agnostic <stroke_type>.wav fallback; a missing or undecodable file
// caches null so the engine falls back to synthesis without refetching.
// fetch and decode are injectable for tests.

import { sampleCandidates } from "./timing.js";

export function createSampleBank(audioCtx, { fetchFn = (...a) => fetch(...a), baseUrl = "/" } = {}) {
  const cache = new Map(); // relative path -> AudioBuffer | null

  async function load(path) {
    if (cache.has(path)) return cache.get(path);
    let buffer = null;
    try {
      const res = await fetchFn(baseUrl + path);
      if (res.ok) buffer = await audioCtx.decodeAudioData(await res.arrayBuffer());
      else console.warn(`YDNL playback: no sample at ${path}, using synth fallback.`);
    } catch (err) {
      console.warn(`YDNL playback: could not decode ${path} (${err.message}), using synth fallback.`);
    }
    cache.set(path, buffer);
    return buffer;
  }

  // The register a stroke event actually needs a file for: glides play the
  // start-register sample and bend it.
  function fileRegister(ev) {
    return ev.pitch_register === "glide" ? (ev.pitch_glide?.start_register || "mid") : ev.pitch_register;
  }

  async function preload(pattern) {
    const jobs = [];
    for (const l of pattern.rhythmic_layers || []) {
      for (const ev of l.stroke_events || []) {
        for (const path of sampleCandidates(l.instrument_role, ev.stroke_type, fileRegister(ev))) {
          jobs.push(load(path));
        }
      }
    }
    await Promise.all(jobs);
  }

  function getSync(role, strokeType, register) {
    const candidates = sampleCandidates(role, strokeType, register);
    for (let i = 0; i < candidates.length; i++) {
      const buffer = cache.get(candidates[i]);
      if (buffer) {
        const registerExact = Boolean(register) && register !== "glide" && i === 0;
        return { buffer, registerExact };
      }
    }
    return null;
  }

  return { preload, getSync };
}
