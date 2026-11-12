// The person's look for the diff tints, kept in herdr's shared(CFG_KEY) and set from the gear's
// window. Pure: no Herdr imports.
// font: the code's size in px (FONT_MIN to FONT_MAX); the rows, gutters and counts scale with it.
//   { "added": "#a6e3a1", "removed": "#f38ba8", "modified": "#f9e2af", "line": 0.09, "word": 0.40 }
// added / removed: the color of the + and − lines (default: the theme's green and red).
// line: how strong the tint of a whole changed line is (0 to 1).
// word: how strong the tint of the exact words that changed is (0 to 1).
export const CFG_KEY = "gitdiff.cfg";
export const DEFAULTS = { added: null, removed: null, modified: null, line: 0.09, word: 0.38, font: 12 };

export const FONT_MIN = 9, FONT_MAX = 24;
const hex = (v) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : null);
const amount = (v, d) => (typeof v === "number" && v >= 0 && v <= 1 ? v : d);

// `value`: the object from shared(), or JSON text; anything else gives the defaults.
const clampFont = (v) => (Number.isFinite(v) ? Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(v))) : DEFAULTS.font);

export function parseConfig(value) {
  let raw = value;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = {}; } }
  if (!raw || typeof raw !== "object") raw = {};
  return {
    added: hex(raw.added), removed: hex(raw.removed), modified: hex(raw.modified),
    line: amount(raw.line, DEFAULTS.line), font: clampFont(raw.font), word: amount(raw.word, DEFAULTS.word),
  };
}

// "#rrggbb" + 0..1 -> "#rrggbbaa"
export const tint = (color, alpha) => color + Math.round(alpha * 255).toString(16).padStart(2, "0");

// "#rrggbb" times k (0..1) per channel: a darker shade of the same gray. Anything that is not
// "#rrggbb" comes back as it is.
export const shade = (color, k) => {
  if (!hex(color)) return color;
  return "#" + [1, 3, 5].map((i) => Math.round(parseInt(color.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("");
};

// One 5% step up or down, kept in 0..1 and free of float noise.
export const stepAmount = (v, dir) => Math.min(1, Math.max(0, Math.round((v + dir * 0.05) * 100) / 100));

// The views the panel shows (split, tree, wrap): one shared choice, set from the header or the menu,
// so the panel and its full-screen copy agree. Pure: no Herdr imports.
export const VIEW_KEY = "gitdiff.view";
export function parseView(value) {
  let raw = value;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = {}; } }
  if (!raw || typeof raw !== "object") raw = {};
  return { side: raw.side === true, tree: raw.tree === true, wrap: raw.wrap === true };
}
