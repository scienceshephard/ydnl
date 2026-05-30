-- schema.sql
-- PostgreSQL DDL that mirrors the YDNL entity model one to one. The prototype
-- ships with a JSON file store for zero setup running; this schema is the
-- production storage layer referenced in the paper. The relational structure
-- propagates directly from the YDNL specification.

CREATE TABLE ensemble_config (
    ensemble_id          TEXT PRIMARY KEY,
    instrument_nodes     JSONB NOT NULL DEFAULT '[]',
    interdependency_rules JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE drum_pattern (
    pattern_id    TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    tempo_bpm     INTEGER NOT NULL CHECK (tempo_bpm > 0),
    metric_ratio  TEXT,
    ensemble_ref  TEXT REFERENCES ensemble_config (ensemble_id)
);

-- CulturalAnnotation is mandatory: enforced by NOT NULL one to one row.
CREATE TABLE cultural_annotation (
    pattern_id        TEXT PRIMARY KEY REFERENCES drum_pattern (pattern_id) ON DELETE CASCADE,
    orisha_id         TEXT NOT NULL,
    ceremony_type     TEXT NOT NULL,
    regional_variant  TEXT,
    source_drummer_id TEXT,
    validation_status TEXT NOT NULL DEFAULT 'draft',
    recording_uri     TEXT
);

CREATE TABLE rhythmic_layer (
    layer_id           TEXT PRIMARY KEY,
    pattern_id         TEXT NOT NULL REFERENCES drum_pattern (pattern_id) ON DELETE CASCADE,
    instrument_role    TEXT NOT NULL,
    pulse_unit         TEXT NOT NULL,
    metric_cycle_length INTEGER NOT NULL CHECK (metric_cycle_length > 0),
    offset_pulses      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE stroke_event (
    event_id       TEXT PRIMARY KEY,
    layer_id       TEXT NOT NULL REFERENCES rhythmic_layer (layer_id) ON DELETE CASCADE,
    pulse_position INTEGER NOT NULL,
    stroke_type    TEXT NOT NULL,
    pitch_register TEXT NOT NULL,
    duration_pulses INTEGER NOT NULL DEFAULT 1,
    dynamics       TEXT DEFAULT 'mf'
);

CREATE TABLE pitch_glide (
    event_id        TEXT PRIMARY KEY REFERENCES stroke_event (event_id) ON DELETE CASCADE,
    start_register  TEXT NOT NULL,
    end_register    TEXT NOT NULL,
    glide_direction TEXT NOT NULL,
    duration_pulses INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_layer_pattern ON rhythmic_layer (pattern_id);
CREATE INDEX idx_event_layer ON stroke_event (layer_id);
CREATE INDEX idx_ca_orisha ON cultural_annotation (orisha_id);
CREATE INDEX idx_ca_ceremony ON cultural_annotation (ceremony_type);
