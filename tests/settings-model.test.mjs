import { test } from "node:test";
import assert from "node:assert/strict";
import { settingsRows, moveCursor } from "../mod/settings-model.js";
import { parseConfig, DEFAULTS } from "../mod/config.js";

const rows = settingsRows(parseConfig(null));

test("the rows, top to bottom", () => {
  assert.deepEqual(rows.map((r) => r.id), ["added", "removed", "modified", "line", "word", "font", "lazygitFull", "nvimFull", "reset"]);
  assert.deepEqual(rows.map((r) => r.cells.length), [7, 7, 7, 2, 2, 2, 2, 2, 1]);
});

test("a swatch picks its color, and on the chosen one lets it go", () => {
  const cell = (cfg, i) => settingsRows(cfg)[0].cells[i];
  assert.deepEqual(cell(parseConfig(null), 2).patch, { added: "#7ee787" });
  assert.equal(cell(parseConfig(null), 0).chosen, true); // the theme's own is the default
  const chosen = parseConfig({ added: "#7ee787" });
  assert.equal(cell(chosen, 2).chosen, true);
  assert.deepEqual(cell(chosen, 2).patch, { added: null });
});

test("steppers step by 5% and by 1px, and stop at their limits", () => {
  const [less, more] = settingsRows(parseConfig({ line: 0.5, font: 24 }))[3].cells;
  assert.deepEqual([less.patch, more.patch], [{ line: 0.45 }, { line: 0.55 }]);
  const font = settingsRows(parseConfig({ font: 24 }))[5].cells;
  assert.deepEqual(font.map((c) => c.patch.font), [23, 24]);
});

test("options say which is chosen, and reset carries the defaults", () => {
  const opts = settingsRows(parseConfig({ nvimFull: true }))[7].cells;
  assert.deepEqual(opts.map((c) => c.chosen), [false, true]);
  assert.deepEqual(rows[8].cells[0].patch, DEFAULTS);
});

test("vi keys and arrows move the same way, and stop at the edges", () => {
  assert.deepEqual(moveCursor({ row: 0, col: 0 }, "l", rows), { row: 0, col: 1 });
  assert.deepEqual(moveCursor({ row: 0, col: 1 }, "right", rows), { row: 0, col: 2 });
  assert.deepEqual(moveCursor({ row: 0, col: 0 }, "h", rows), { row: 0, col: 0 });
  assert.deepEqual(moveCursor({ row: 0, col: 0 }, "k", rows), { row: 0, col: 0 });
  assert.deepEqual(moveCursor({ row: 8, col: 0 }, "down", rows), { row: 8, col: 0 });
});

test("moving down into a shorter row lands on its last cell", () => {
  assert.deepEqual(moveCursor({ row: 2, col: 6 }, "j", rows), { row: 3, col: 1 });
  assert.deepEqual(moveCursor({ row: 7, col: 1 }, "j", rows), { row: 8, col: 0 });
});

test("a key that does not move gives null", () => {
  assert.equal(moveCursor({ row: 0, col: 0 }, "x", rows), null);
});
