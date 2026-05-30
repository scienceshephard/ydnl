// routes/files.js
import { Router } from "express";
import { toXML, fromXML, toJSON, fromJSON, validatePattern } from "ydnl-core";

const router = Router();

// Export a pattern to a schema valid file in the requested format.
router.post("/export", (req, res) => {
  const { pattern, format = "xml" } = req.body || {};
  if (!pattern) return res.status(400).json({ error: "A 'pattern' object is required." });
  const { valid, errors } = validatePattern(pattern);
  if (!valid) return res.status(422).json({ error: "Will not export a non compliant pattern.", errors });

  if (format === "json") {
    const body = toJSON(pattern);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${pattern.pattern_id}.json"`);
    return res.send(body);
  }
  const body = toXML(pattern);
  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Content-Disposition", `attachment; filename="${pattern.pattern_id}.ydnl.xml"`);
  res.send(body);
});

// Import a file, parse it, validate it, and return the parsed pattern with the
// validation report so the client can show element level errors.
router.post("/import", (req, res) => {
  const { content, format = "xml" } = req.body || {};
  if (!content) return res.status(400).json({ error: "A 'content' string is required." });
  let pattern;
  try {
    pattern = format === "json" ? fromJSON(content) : fromXML(content);
  } catch (err) {
    return res.status(400).json({ error: `Could not parse ${format.toUpperCase()}: ${err.message}` });
  }
  const report = validatePattern(pattern);
  res.json({ pattern, valid: report.valid, errors: report.errors });
});

export default router;
