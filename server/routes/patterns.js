// routes/patterns.js
import { Router } from "express";
import { createDrumPattern, validatePattern, deriveMetricRatio } from "ydnl-core";
import * as store from "../store.js";

const router = Router();

// Faceted search.
router.get("/", (req, res) => {
  res.json(store.list(req.query));
});

router.get("/:id", (req, res) => {
  const p = store.get(req.params.id);
  if (!p) return res.status(404).json({ error: "Pattern not found." });
  res.json(p);
});

// Create or update. The pattern is normalised and validated before storage.
function save(req, res) {
  const pattern = createDrumPattern(req.body);
  if (!pattern.metric_ratio) pattern.metric_ratio = deriveMetricRatio(pattern);
  const { valid, errors } = validatePattern(pattern);
  if (!valid) return res.status(422).json({ error: "Schema validation failed.", errors });
  store.upsert(pattern);
  res.status(201).json(pattern);
}

router.post("/", save);
router.put("/:id", (req, res) => save({ ...req, body: { ...req.body, pattern_id: req.params.id } }, res));

router.delete("/:id", (req, res) => {
  const ok = store.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Pattern not found." });
  res.status(204).end();
});

export default router;
