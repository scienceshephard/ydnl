// usePlayback.js
// React bridge to the playback engine. The AudioContext is created lazily on
// the first Play click (browser autoplay policy requires a user gesture) and
// shared for the whole session. Playhead positions are driven by
// requestAnimationFrame reading the audio hardware clock, so the visuals
// cannot drift from the sound.

import { useEffect, useRef, useState } from "react";
import { createEngine } from "./engine.js";
import { createSampleBank } from "./sampleBank.js";
import { getAudioContext, audioSupported } from "./context.js";

export default function usePlayback() {
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [positions, setPositions] = useState(null);
  const ref = useRef({ ctx: null, engine: null, raf: 0, starting: false, unmounted: false });

  function stopUi() {
    cancelAnimationFrame(ref.current.raf);
    setPositions(null);
    setPlaying(false);
  }

  async function toggle(pattern) {
    const r = ref.current;
    if (r.starting) return; // a play() is already in flight; ignore re-entrant clicks
    if (r.engine && r.engine.playing) {
      r.engine.stop();
      stopUi();
      return;
    }
    if (!r.ctx) {
      r.ctx = getAudioContext();
      r.engine = createEngine(r.ctx, createSampleBank(r.ctx));
      r.engine.onEnded = stopUi;
    }
    r.starting = true;
    try {
      await r.engine.play(pattern, { loop });
    } catch (err) {
      console.warn("YDNL playback: could not start playback.", err);
      stopUi();
      return;
    } finally {
      r.starting = false;
    }
    if (r.unmounted) { // unmounted while play() was pending: silence and bail
      r.engine.stop();
      return;
    }
    setPlaying(true);
    const frame = () => {
      if (!r.engine.playing) return;
      setPositions(r.engine.positionsAt(r.ctx.currentTime));
      r.raf = requestAnimationFrame(frame);
    };
    r.raf = requestAnimationFrame(frame);
  }

  useEffect(() => {
    // StrictMode mounts, unmounts, then remounts the same ref in dev; without
    // this reset a remounted hook would stay permanently "unmounted" and
    // silently no-op every future toggle().
    ref.current.unmounted = false;
    return () => { // unmount: stop sound and animation
      const r = ref.current;
      r.unmounted = true;
      if (r.engine) r.engine.stop();
      cancelAnimationFrame(r.raf);
    };
  }, []);

  return { supported: audioSupported(), playing, loop, setLoop, toggle, positions };
}
