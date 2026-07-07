// usePlayback.js
// React bridge to the playback engine. The AudioContext is created lazily on
// the first Play click (browser autoplay policy requires a user gesture) and
// shared for the whole session. Playhead positions are driven by
// requestAnimationFrame reading the audio hardware clock, so the visuals
// cannot drift from the sound.

import { useEffect, useRef, useState } from "react";
import { createEngine } from "./engine.js";
import { createSampleBank } from "./sampleBank.js";

const AudioCtx = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;

export default function usePlayback() {
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [positions, setPositions] = useState(null);
  const ref = useRef({ ctx: null, engine: null, raf: 0 });

  function stopUi() {
    cancelAnimationFrame(ref.current.raf);
    setPositions(null);
    setPlaying(false);
  }

  async function toggle(pattern) {
    const r = ref.current;
    if (r.engine && r.engine.playing) {
      r.engine.stop();
      stopUi();
      return;
    }
    if (!r.ctx) {
      r.ctx = new AudioCtx();
      r.engine = createEngine(r.ctx, createSampleBank(r.ctx));
      r.engine.onEnded = stopUi;
    }
    await r.engine.play(pattern, { loop });
    setPlaying(true);
    const frame = () => {
      if (!r.engine.playing) return;
      setPositions(r.engine.positionsAt(r.ctx.currentTime));
      r.raf = requestAnimationFrame(frame);
    };
    r.raf = requestAnimationFrame(frame);
  }

  useEffect(() => () => { // unmount: stop sound and animation
    const r = ref.current;
    if (r.engine) r.engine.stop();
    cancelAnimationFrame(r.raf);
  }, []);

  return { supported: Boolean(AudioCtx), playing, loop, setLoop, toggle, positions };
}
