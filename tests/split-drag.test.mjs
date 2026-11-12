import { test } from "node:test";
import assert from "node:assert/strict";
import { draggedShare } from "../mod/split-drag.js";

const drag = { x: 400, start: 0.5 };

test("dragging right makes the tree's share smaller, left makes it larger", () => {
  assert.equal(draggedShare(drag, 500, 1000, 0.2, 0.8), 0.4);
  assert.equal(draggedShare(drag, 300, 1000, 0.2, 0.8), 0.6);
  assert.equal(draggedShare(drag, 400, 1000, 0.2, 0.8), 0.5);
});

test("the share stays between min and max", () => {
  assert.equal(draggedShare(drag, 5000, 1000, 0.2, 0.8), 0.2);
  assert.equal(draggedShare(drag, -5000, 1000, 0.2, 0.8), 0.8);
});
