import { test } from "node:test";
import assert from "node:assert/strict";
import { selectedRows, reference } from "../mod/ask.js";

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

test("reference: full path, #L, and a range when there is more than one line", () => {
  assert.equal(reference("/r/x.js", selectedRows(rows, 1, 4)), "/r/x.js#L1-L3");
  assert.equal(reference("/r/x.js", [rows[3]]), "/r/x.js#L2");
  assert.equal(reference("/r/x.js", [rows[2]]), "/r/x.js#L2"); // only deleted: old-file number
});
