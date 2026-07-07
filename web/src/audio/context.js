// context.js
// One AudioContext for the whole session. Browsers cap how many contexts can
// run at once, so every consumer (playback, upload decoding) shares this one.
// Created lazily - for playback that first call happens inside a user
// gesture, satisfying autoplay policy; decodeAudioData works even while the
// context is suspended. Never closed: it outlives any component mount.

const AudioCtx = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;

let sharedCtx = null;

export function audioSupported() {
  return Boolean(AudioCtx);
}

export function getAudioContext() {
  if (!sharedCtx) sharedCtx = new AudioCtx();
  return sharedCtx;
}
