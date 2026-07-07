# Drum sample recordings

Playback looks here for recordings of each stroke. Drop in `.wav` files and
they are used immediately; anything missing falls back to a synthesized
voice, so playback always works.

## Naming convention

    samples/<instrument_role>/<stroke_type>_<register>.wav   (register-exact)
    samples/<instrument_role>/<stroke_type>.wav              (fallback, treated as mid register)

Registers: `low`, `mid`, `high`. Glide strokes use the recording of their
start register and bend it, so no `_glide` files exist.

## Files the shipped corpus would use

- `iya-ilu/` — `open_high, open_mid, open_low, muted_mid, muted_low, slap_low, combined_high` (.wav)
- `omele-abo/` — `open_low, open_mid, slap_low, slap_mid` (.wav)
- `omele-ako/` — `open_mid, open_high, muted_mid` (.wav)
- `kudi/` — `open_low, open_mid, slap_low, slap_mid` (.wav)
- `iya-ilu-dundun/` — `open_high, open_mid, open_low, muted_mid, muted_low` (.wav)
- `gangan/` — `open_mid, open_low, open_high, muted_mid` (.wav)
- `kerikeri/` — `open_high, open_mid` (.wav)
- `gudugudu/` — `open_mid, muted_mid` (.wav)

A single `open.wav` etc. per drum also works while a collection is incomplete.
Provenance note: per `DATA.md`, recordings must be genuinely attributed when
added — do not ship placeholder audio as if it were fieldwork.
