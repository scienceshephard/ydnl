# Drum Pattern Corpus: provenance and status

This file documents exactly what the corpus in `server/data/corpus.json` is, so
there is no ambiguity for anyone reading the repository or the paper.

## Status

The twelve patterns shipped here (six Dùndún, six Bàtá) are **illustrative
synthetic examples**. They were constructed to exercise every feature of the
YDNL schema: independent metric cycles, register tones, continuous pitch glides,
timbre variation, relational ensemble structure, and mandatory cultural
metadata. They are **not** transcriptions of recorded performances and they are
**not** the product of fieldwork.

To be explicit:

- There are no audio recordings. The `recording_uri` field is empty in every
  pattern.
- No `source_drummer_id` is attributed, because no drummer has been recorded or
  consulted for these specific encodings. The field is empty by design.
- Every pattern carries `validation_status: "draft"`. None has been reviewed by
  a faculty member or validated by a master drummer.
- The musical content is plausible and schema correct, but it is constructed to
  illustrate the format, not to assert a specific canonical performance.

## What the metrics over this corpus do and do not show

Three metrics are computed directly from this corpus and are reported as
measured values:

- **Encoding Completeness Score (mean 1.00)** and **Retrieval Precision (mean
  1.00)** are verification, not discovery. YDNL is defined to cover the whole
  feature taxonomy and faceted search runs over a controlled vocabulary, so
  these values confirm the implementation does what the schema specifies.
- **Benchmark Parity Ratio (mean 2.08)** and the **MusicXML completeness
  contrast (mean 0.33, average 4.2 of 7 features lost)** are the substantive
  findings: they quantify the structural gap between YDNL and the dominant
  Western standard over the same patterns. Reproduce them with
  `node scripts/compute-metrics.mjs`. Pitch glides appear only in the Dùndún
  patterns: bàtá drums are fixed-pitch and render speech through stroke
  timbre, and the schema now rejects a glide on any fixed-pitch role.

These structural measurements do not depend on provenance. They measure what an
encoding can represent, not whether a pattern was field recorded.

## The corpus the framework is designed for

The paper describes a target corpus of canonical Dùndún and Bàtá patterns to be
collected through fieldwork with master drummers and a university music
department, captured in three independent forms before encoding. That collection
is **future work**. When real patterns are captured they replace these synthetic
patterns, the provenance fields are populated with genuine attributions and
recordings, and `validation_status` advances from `draft` only after the
corresponding human review has taken place.

## Why this matters

Populating provenance or validation fields with values that do not correspond to
real people, recordings, or review events would be data fabrication. The schema
deliberately distinguishes a `draft` encoding from a validated one so the
integrity of the record is visible in the data itself.
