// routes/benchmark.js
import { Router } from "express";
import { toMusicXML, computeECS, computeBPR, detectFeatures } from "ydnl-core";

const router = Router();

// Generate a parallel MusicXML encoding and the comparative metrics for a
// single pattern.
router.post("/", (req, res) => {
  const { pattern } = req.body || {};
  if (!pattern) return res.status(400).json({ error: "A 'pattern' object is required." });

  const benchmark = toMusicXML(pattern);
  const ecs = computeECS(pattern);
  const ecsMusicXML = computeECS(pattern, ["multi_layer", "register_tones"]);

  res.json({
    featuresPresent: detectFeatures(pattern),
    ecs_ydnl: Number(ecs.ecs.toFixed(3)),
    ecs_musicxml: Number(ecsMusicXML.ecs.toFixed(3)),
    bpr: Number(benchmark.bpr.toFixed(3)),
    sharedFeatures: benchmark.sharedFeatures,
    lostFeatures: benchmark.lostFeatures,
    musicxml: benchmark.musicxml
  });
});

export default router;
