import { test } from "node:test";
import assert from "node:assert/strict";
import { isPicked, pressRow, extendTo } from "../mod/line-selection.js";

test("isPicked: the range counts in either order, only for its own file", () => {
  assert.equal(isPicked(null, "a.js", 3), false);
  assert.equal(isPicked({ path: "a.js", from: 2, to: 4 }, "a.js", 3), true);
  assert.equal(isPicked({ path: "a.js", from: 4, to: 2 }, "a.js", 2), true);
  assert.equal(isPicked({ path: "a.js", from: 2, to: 4 }, "a.js", 5), false);
  assert.equal(isPicked({ path: "a.js", from: 2, to: 4 }, "b.js", 3), false);
});

test("pressRow on a free row starts a selection that can be dragged", () => {
  assert.deepEqual(pressRow(null, "a.js", 3), { sel: { path: "a.js", from: 3, to: 3 }, dragging: true, cleared: false });
  const other = { path: "b.js", from: 1, to: 1 };
  assert.deepEqual(pressRow(other, "a.js", 3).sel, { path: "a.js", from: 3, to: 3 });
});

test("pressRow on a selected row clears the selection", () => {
  assert.deepEqual(pressRow({ path: "a.js", from: 2, to: 4 }, "a.js", 3), { sel: null, dragging: false, cleared: true });
});

test("extendTo moves the end within the same file and leaves other files alone", () => {
  const sel = { path: "a.js", from: 2, to: 2 };
  assert.deepEqual(extendTo(sel, "a.js", 6), { path: "a.js", from: 2, to: 6 });
  assert.equal(extendTo(sel, "b.js", 6), sel);
  assert.equal(extendTo(null, "a.js", 6), null);
});
