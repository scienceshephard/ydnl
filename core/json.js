// json.js
// The JSON serialisation is the canonical in memory shape itself, so these are
// thin wrappers that keep the API symmetric with the XML module.

import { createDrumPattern } from "./model.js";

export function toJSON(pattern, pretty = true) {
  return JSON.stringify(pattern, null, pretty ? 2 : 0);
}

export function fromJSON(text) {
  const obj = typeof text === "string" ? JSON.parse(text) : text;
  return createDrumPattern(obj);
}
