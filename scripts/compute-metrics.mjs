import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
import { detectFeatures, computeECS, computeBPR, TAXONOMY, MUSICXML_CAPABLE } from "../core/metrics.js";
import { toMusicXML } from "../core/musicxml.js";
import { list } from "../server/store.js";

const corpus = JSON.parse(fs.readFileSync(path.join(ROOT,"server/data/corpus.json"), "utf8"));
console.log("Corpus size:", corpus.length, "patterns\n");

// ---- ECS + BPR per pattern ----
let ecsSum = 0, bprSum = 0, lostSum = 0, mxEcsSum = 0;
console.log("PER-PATTERN STRUCTURAL METRICS");
console.log("id        | feats present                          | YDNL ECS | MXML ECS | BPR  | lost in MXML");
for (const p of corpus) {
  const present = detectFeatures(p);
  const ydnl = computeECS(p);                       // YDNL capability
  const mx   = computeECS(p, MUSICXML_CAPABLE);     // MusicXML capability
  const { bpr, lostInMusicXML } = computeBPR(p);
  ecsSum += ydnl.ecs; mxEcsSum += mx.ecs; bprSum += bpr; lostSum += lostInMusicXML.length;
  console.log(
    p.pattern_id.padEnd(9), "|",
    present.join(",").padEnd(38), "|",
    ydnl.ecs.toFixed(2).padStart(7), " |",
    mx.ecs.toFixed(2).padStart(7), " |",
    bpr.toFixed(2).padStart(4), "|",
    lostInMusicXML.join(",")
  );
}
const n = corpus.length;
console.log("\nMEANS over", n, "patterns:");
console.log("  Mean YDNL ECS      :", (ecsSum/n).toFixed(3));
console.log("  Mean MusicXML ECS  :", (mxEcsSum/n).toFixed(3));
console.log("  Mean BPR           :", (bprSum/n).toFixed(3));
console.log("  Mean features lost in MusicXML per pattern:", (lostSum/n).toFixed(2), "of 7 taxonomy features");

// ---- Retrieval precision (faceted, exact-match) ----
console.log("\nRETRIEVAL PRECISION (faceted queries over the corpus)");
function precisionFor(filter, isRelevant) {
  const got = list(filter);
  const relevant = got.filter(isRelevant).length;
  return { retrieved: got.length, relevant, precision: got.length ? relevant/got.length : 1 };
}
const queries = [
  ["orisha=Sango",      {orisha:"Sango"},        p => (p.cultural_annotation||{}).orisha_id==="Sango"],
  ["ceremony=festival", {ceremony:"festival"},   p => (p.cultural_annotation||{}).ceremony_type==="festival"],
  ["instrument=iya-ilu",{instrument:"iya-ilu"},  p => p.rhythmic_layers.some(l=>l.instrument_role==="iya-ilu")],
  ["region=Oyo",        {region:"Oyo"},          p => (p.cultural_annotation||{}).regional_variant==="Oyo"],
];
let pSum=0;
for (const [label, filter, rel] of queries) {
  const r = precisionFor(filter, rel);
  pSum += r.precision;
  console.log(" ", label.padEnd(20), "retrieved", r.retrieved, "relevant", r.relevant, "precision", r.precision.toFixed(2));
}
console.log("  Mean Retrieval Precision:", (pSum/queries.length).toFixed(3));
