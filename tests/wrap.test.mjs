import { test } from "node:test";
import assert from "node:assert/strict";
import { breakRuns, wrapChars } from "../mod/wrap.js";
import { CHAR_W, GUTTER_W } from "../mod/metrics.js";

test("a word longer than the line is cut into chunks; the text is kept whole", () => {
  const word = "x".repeat(25);
  const out = breakRuns([[word, "K", true]], 10);
  assert.deepEqual(out.map((p) => p[0]), ["x".repeat(10), "x".repeat(10), "x".repeat(5)]);
  assert.ok(out.every((p) => p[1] === "K" && p[2] === true));
});

test("a line that fits is one piece: neighbours of one colour are joined, spaces included", () => {
  assert.deepEqual(breakRuns([["foo", null, false], [" bar  baz", null, false]], 20), [["foo bar  baz", null, false]]);
  // A colour change still starts a new piece.
  assert.deepEqual(breakRuns([["foo", "A", false], [" bar", null, false]], 20), [["foo", "A", false], [" bar", null, false]]);
});

test("a line longer than the line is split at its spaces, not inside its words", () => {
  const out = breakRuns([["foo bar  baz", null, false]], 10);
  assert.deepEqual(out, [["foo bar  ", null, false], ["baz", null, false]]);
});

test("a long word inside a piece keeps its neighbours and their colours", () => {
  const out = breakRuns([["a", "A", false], ["abcdefghijkl m", "B", true]], 5);
  assert.equal(out.map((p) => p[0]).join(""), "aabcdefghijkl m");
  assert.deepEqual(out.slice(0, 1), [["a", "A", false]]);
  assert.deepEqual(out.slice(1, 3), [["abcde", "B", true], ["fghij", "B", true]]);
});

test("empty pieces produce nothing", () => {
  assert.deepEqual(breakRuns([["", null, false]], 4), []);
});

test("wrapChars: a chunk is never wider than the panel's text area", () => {
  // A 500px panel at zoom 1: what is left after the gutters, less a margin of 2 characters.
  assert.equal(wrapChars(500, 1), Math.floor((500 - GUTTER_W) / CHAR_W) - 2);
  assert.equal(wrapChars(0, 1), wrapChars(320, 1));
  assert.ok(wrapChars(10, 1) >= 8);
  const k = 1.5;
  const max = wrapChars(400, k);
  assert.ok(max * CHAR_W * k <= 400 - GUTTER_W * k);
});
