import { test } from "node:test";
import assert from "node:assert/strict";
import { selectedRows, reference, buildMessage } from "../mod/ask.js";

const rows = [
  { kind: "@", text: "@@ -1,3 +1,3 @@" },
  { kind: " ", text: "a", o: 1, n: 1 },
  { kind: "-", text: "b", o: 2 },
  { kind: "+", text: "B", n: 2 },
  { kind: " ", text: "c", o: 3, n: 3 },
];

test("selectedRows takes the range in either order and skips hunk headers", () => {
  assert.deepEqual(selectedRows(rows, 0, 2).map((r) => r.text), ["a", "b"]);
  assert.deepEqual(selectedRows(rows, 3, 1).map((r) => r.text), ["a", "b", "B"]);
});

test("reference uses new-file lines, or says removed when there are none", () => {
  assert.equal(reference("x.js", selectedRows(rows, 1, 4)), "x.js:1-3");
  assert.equal(reference("x.js", [rows[3]]), "x.js:2");
  assert.equal(reference("x.js", [rows[2]]), "x.js (removed, was line 2)");
});

test("buildMessage: reference, fenced diff, then the note", () => {
  const m = buildMessage("x.js", selectedRows(rows, 2, 3), "  why B?  ");
  assert.equal(m, "x.js:2\n```diff\n-b\n+B\n```\nwhy B?");
});
