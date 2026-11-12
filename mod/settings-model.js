// pure: what the settings window offers, as rows of cells, and how a cursor moves over them. The window draws
// the rows; a click or a key on a cell applies its `patch` to the config. No Herdr imports, so the tests cover it.
import { DEFAULTS, FONT_MIN, FONT_MAX, stepAmount } from "./config.js";

export const GREENS = ["#a6e3a1", "#7ee787", "#56d364", "#2ea043", "#40c057", "#00d084"];
export const AMBERS = ["#f9e2af", "#e3b341", "#d29922", "#fab387", "#ffa657", "#bf8700"];
export const REDS = ["#f38ba8", "#ff7b72", "#f85149", "#e5534b", "#ff6b6b", "#d1242f"];

/**
 * @typedef {object} Cell one thing to click, or to press Enter on
 * @property {string} id element id
 * @property {"swatch"|"step"|"option"|"reset"} kind
 * @property {object} patch what to merge into the config
 * @property {boolean} [chosen] swatch or option: it is the current choice
 * @property {string|null} [color] swatch: its color (null: the theme's own)
 * @property {string} [text] step: "−" or "+"; option: its words
 */

/**
 * @typedef {object} Row
 * @property {string} id
 * @property {string} title
 * @property {"palette"|"stepper"|"options"|"reset"} kind
 * @property {string} [key] the config field the row sets
 * @property {Cell[]} cells
 */

const palette = (cfg, key, title, colors) => ({
  id: key, title, kind: "palette", key,
  cells: [null, ...colors].map((color) => {
    const chosen = cfg[key] === color;
    // On the chosen color, Enter or a click goes back to the theme's own: that is how a color is let go.
    return { id: `sw-${key}-${color ?? "theme"}`, kind: "swatch", color, chosen, patch: { [key]: chosen ? null : color } };
  }),
});

const stepper = (cfg, key, title, next) => ({
  id: key, title, kind: "stepper", key,
  cells: [["less", "−", -1], ["more", "+", 1]].map(([id, text, dir]) => ({ id: `${key}-${id}`, kind: "step", text, patch: { [key]: next(cfg[key], dir) } })),
});

// Where a tool opens: over the panel's body (false) or in a big dialog (true).
const options = (cfg, key, title) => ({
  id: key, title, kind: "options", key,
  cells: [["panel", "In the panel", false], ["full", "Fullscreen", true]]
    .map(([id, text, full]) => ({ id: `${key}-${id}`, kind: "option", text, chosen: cfg[key] === full, patch: { [key]: full } })),
});

const fontStep = (font, dir) => Math.min(FONT_MAX, Math.max(FONT_MIN, font + dir));

/**
 * @param {object} cfg the config as it is now (config.js parseConfig)
 * @returns {Row[]} top to bottom, as the window draws them
 */
export function settingsRows(cfg) {
  return [
    palette(cfg, "added", "Added", GREENS),
    palette(cfg, "removed", "Removed", REDS),
    palette(cfg, "modified", "Modified", AMBERS),
    stepper(cfg, "line", "Line tint", stepAmount),
    stepper(cfg, "word", "Word tint", stepAmount),
    stepper(cfg, "font", "Font size", fontStep),
    options(cfg, "lazygitFull", "Lazygit"),
    options(cfg, "nvimFull", "Neovim"),
    { id: "reset", title: "Reset", kind: "reset", cells: [{ id: "cfg-reset", kind: "reset", patch: { ...DEFAULTS } }] },
  ];
}

const MOVES = { h: [0, -1], left: [0, -1], l: [0, 1], right: [0, 1], j: [1, 0], down: [1, 0], k: [-1, 0], up: [-1, 0] };

/**
 * Moves the cursor over the rows, vi keys and arrows. It stops at the edges, and a row with fewer cells than the
 * column the cursor was in puts it on its last one.
 * @param {{ row: number, col: number }} cursor
 * @param {string} key h j k l, or left down up right
 * @param {Row[]} rows
 * @returns {{ row: number, col: number }|null} the new cursor, null for a key that does not move it
 */
export function moveCursor(cursor, key, rows) {
  const d = MOVES[key];
  if (!d) return null;
  const row = Math.min(rows.length - 1, Math.max(0, cursor.row + d[0]));
  const col = Math.min(rows[row].cells.length - 1, Math.max(0, cursor.col + d[1]));
  return { row, col };
}
