# YorubaDrum Notation Language (YDNL)

An open, machine readable framework for encoding and preserving Yoruba Dùndún and Bàtá polyrhythmic drum music. YDNL is a data schema and file format designed from the music outward, so that it can represent the structural properties that Western standards such as MusicXML and MEI cannot: independent metric cycles, continuously gliding pitch used as a linguistic surrogate, stroke timbre as semantic content, relational ensemble structure, and mandatory cultural metadata.

This repository is the reference prototype that accompanies the paper *YorubaDrum Notation Language (YDNL): A Software Framework for Encoding and Preserving Yoruba Polyrhythmic Music*.

## What is inside

```
ydnl/
├── core/      ydnl-core: data model, validation, XML/JSON serialisation,
│              MusicXML benchmark encoder, and the ECS/BPR metrics. No UI, no server.
├── server/    Express API. Endpoints map directly to schema operations.
│              Ships with a JSON file store; db/schema.sql is the PostgreSQL layer.
├── web/       React + Vite frontend: encoder, renderer, library, benchmark view.
└── schema/    Formal ydnl.xsd and ydnl.schema.json plus worked examples.
```

## Requirements

Node.js 18 or newer (the core library uses native ES modules and the built in `node:test` runner).

## Setup

This is an npm workspaces monorepo, so a single install at the root wires up all three packages.

```bash
npm install
```

## Running the prototype

Open two terminals from the repository root.

```bash
# terminal 1 - API on http://localhost:4000
npm run server

# terminal 2 - web app on http://localhost:5173 (proxies /api to the server)
npm run web
```

Then open http://localhost:5173. The app has three tabs:

- **Library**: faceted search across the seeded Drum Pattern Corpus by Orisha, ceremony, instrument, and keyword, with a live polyrhythmic rendering and XML/JSON export.
- **Encoder**: build a new pattern layer by layer, place stroke events, preview the rendering, and save it through schema validation.
- **Benchmark**: encode any pattern as MusicXML and see the Benchmark Parity Ratio plus the exact list of features lost in translation.

## Tests

```bash
npm test
```

The core test suite covers validation, XML and JSON round trips, feature detection, the ECS and BPR metrics, and the MusicXML benchmark encoder.

## The data model

A `DrumPattern` is the root aggregate and the unit of exchange. It owns one or more `RhythmicLayer` entities, each running its own metric cycle and owning an ordered list of `StrokeEvent` entities, where a continuous transition is carried by a `PitchGlide` child. `EnsembleConfig` is referenced; `CulturalAnnotation` is embedded and mandatory. A file without a cultural annotation fails validation by design.

## API summary

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness check |
| GET | `/api/vocabulary` | Controlled vocabularies for the UI |
| GET | `/api/patterns` | Faceted search (`?orisha=&ceremony=&instrument=&q=`) |
| GET | `/api/patterns/:id` | Fetch one pattern |
| POST | `/api/patterns` | Validate and store a pattern |
| PUT | `/api/patterns/:id` | Update a pattern |
| DELETE | `/api/patterns/:id` | Remove a pattern |
| POST | `/api/files/export` | Export a pattern as XML or JSON |
| POST | `/api/files/import` | Parse and validate an uploaded file |
| POST | `/api/benchmark` | Generate MusicXML and the comparative metrics |

## Using PostgreSQL instead of the file store

The prototype defaults to a JSON file store at `server/data/corpus.json` so it runs with no database setup. `server/db/schema.sql` is the production schema and mirrors the entity model one to one. To switch, create the schema in a Postgres database and replace the read and write functions in `server/store.js` with a `pg` client; nothing else changes.

## License

Released under the Creative Commons Attribution 4.0 International License (CC BY 4.0). The corpus, schema, and prototype are intended as open, shared preservation infrastructure.
# ydnl
