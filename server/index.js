// index.js  - YDNL prototype API server.
import express from "express";
import cors from "cors";
import {
  STROKE_TYPES, PITCH_REGISTERS, GLIDE_DIRECTIONS, PULSE_UNITS,
  ORISHA, CEREMONY_TYPES, REGIONAL_VARIANTS, INSTRUMENT_ROLES,
  GLIDE_CAPABLE_ROLES, VALIDATION_STATUS
} from "ydnl-core";
import patterns from "./routes/patterns.js";
import files from "./routes/files.js";
import benchmark from "./routes/benchmark.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "ydnl-server" }));

// Controlled vocabulary, so the frontend never hard codes term lists.
app.get("/api/vocabulary", (_req, res) => res.json({
  stroke_types: STROKE_TYPES,
  pitch_registers: PITCH_REGISTERS,
  glide_directions: GLIDE_DIRECTIONS,
  pulse_units: PULSE_UNITS,
  orisha: ORISHA,
  ceremony_types: CEREMONY_TYPES,
  regional_variants: REGIONAL_VARIANTS,
  instrument_roles: INSTRUMENT_ROLES,
  glide_capable_roles: GLIDE_CAPABLE_ROLES,
  validation_status: VALIDATION_STATUS
}));

app.use("/api/patterns", patterns);
app.use("/api/files", files);
app.use("/api/benchmark", benchmark);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`YDNL server listening on http://localhost:${PORT}`));
