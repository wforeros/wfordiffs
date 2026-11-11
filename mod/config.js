// The person's look for the diff tints, read from <app home>/gitdiff.json. Pure: no Herdr imports.
//   { "added": "#a6e3a1", "removed": "#f38ba8", "line": 0.09, "word": 0.40 }
// added / removed: the color of the + and − lines (default: the theme's green and red).
// line: how strong the tint of a whole changed line is (0 to 1).
// word: how strong the tint of the exact words that changed is (0 to 1).
export const DEFAULTS = { added: null, removed: null, line: 0.09, word: 0.38 };

const hex = (v) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : null);
const amount = (v, d) => (typeof v === "number" && v >= 0 && v <= 1 ? v : d);

export function parseConfig(text) {
  let raw = {};
  try { raw = JSON.parse(text ?? "{}") ?? {}; } catch { /* a broken file: defaults */ }
  return {
    added: hex(raw.added), removed: hex(raw.removed),
    line: amount(raw.line, DEFAULTS.line), word: amount(raw.word, DEFAULTS.word),
  };
}

// "#rrggbb" + 0..1 -> "#rrggbbaa"
export const tint = (color, alpha) => color + Math.round(alpha * 255).toString(16).padStart(2, "0");
