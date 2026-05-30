// vocabulary.js
// Controlled vocabularies for the YorubaDrum Notation Language (YDNL).
// Every value here maps to a documented musicological feature. The lists are
// designed to be extensible: new entries are added here and in the schema, not
// invented ad hoc inside encoded files.

export const STROKE_TYPES = ["open", "muted", "slap", "heel-toe", "rim", "combined"];

export const PITCH_REGISTERS = ["low", "mid", "high", "glide"];

export const GLIDE_DIRECTIONS = ["ascending", "descending", "level"];

export const PULSE_UNITS = ["crotchet", "quaver", "semiquaver", "demisemiquaver"];

// Principal Orisha whose worship involves Dundun or Bata drumming.
export const ORISHA = [
  "Sango", "Ogun", "Yemoja", "Obatala", "Oya",
  "Egungun", "Osun", "Orunmila", "Eshu"
];

export const CEREMONY_TYPES = [
  "naming", "funeral", "initiation", "festival", "palace", "secular"
];

export const REGIONAL_VARIANTS = ["Oyo", "Ondo", "Ekiti", "Ijebu", "diaspora"];

// Instrument roles for the two ensemble families.
export const INSTRUMENT_ROLES = [
  "iya-ilu", "omele-abo", "omele-ako", "kudi",   // Bata
  "iya-ilu-dundun", "gangan", "kerikeri", "gudugudu" // Dundun
];

export const VALIDATION_STATUS = ["draft", "faculty-reviewed", "master-validated"];

export function isMember(list, value) {
  return list.includes(value);
}
