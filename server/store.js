// store.js
// A simple JSON file backed store so the prototype runs without a database.
// The PostgreSQL schema in db/schema.sql mirrors this exact entity model for a
// production deployment; swapping the store for a pg client is a localised
// change.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "corpus.json");

let patterns = [];

function load() {
  try {
    patterns = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    patterns = [];
  }
}
function persist() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(patterns, null, 2));
}
load();

export function list(filters = {}) {
  const { orisha, ceremony, instrument, metric_ratio, region, drummer, q } = filters;
  return patterns.filter(p => {
    const ca = p.cultural_annotation || {};
    if (orisha && ca.orisha_id !== orisha) return false;
    if (ceremony && ca.ceremony_type !== ceremony) return false;
    if (region && ca.regional_variant !== region) return false;
    if (drummer && !(ca.source_drummer_id || "").toLowerCase().includes(drummer.toLowerCase())) return false;
    if (metric_ratio && p.metric_ratio !== metric_ratio) return false;
    if (instrument && !p.rhythmic_layers.some(l => l.instrument_role === instrument)) return false;
    if (q) {
      const hay = `${p.title} ${ca.orisha_id} ${ca.ceremony_type} ${ca.source_drummer_id}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });
}

export function get(id) {
  return patterns.find(p => p.pattern_id === id) || null;
}

export function upsert(pattern) {
  const idx = patterns.findIndex(p => p.pattern_id === pattern.pattern_id);
  if (idx >= 0) patterns[idx] = pattern;
  else patterns.push(pattern);
  persist();
  return pattern;
}

export function remove(id) {
  const before = patterns.length;
  patterns = patterns.filter(p => p.pattern_id !== id);
  persist();
  return patterns.length < before;
}
