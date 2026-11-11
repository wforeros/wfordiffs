import { test } from "node:test";
import assert from "node:assert/strict";
import { pairSides } from "../mod/sides.js";
import { parseDiff } from "../mod/parse.js";

const text = (p) => p.kind === "pair" ? [p.left?.text ?? null, p.right?.text ?? null] : p.text;

test("context lines show on both sides", () => {
  const out = pairSides(parseDiff("@@ -1,2 +1,2 @@\n a\n b"));
  assert.deepEqual(out.map(text), ["@@ -1,2 +1,2 @@", ["a", "a"], ["b", "b"]]);
});

test("a removed run and an added run pair up line by line", () => {
  const out = pairSides(parseDiff("@@ -1,2 +1,2 @@\n-x\n-y\n+X\n+Y"));
  assert.deepEqual(out.slice(1).map(text), [["x", "X"], ["y", "Y"]]);
});

test("the shorter side is left empty", () => {
  const out = pairSides(parseDiff("@@ -1,3 +1,1 @@\n-a\n-b\n-c\n+A"));
  assert.deepEqual(out.slice(1).map(text), [["a", "A"], ["b", null], ["c", null]]);
  const add = pairSides(parseDiff("@@ -1,0 +1,2 @@\n+p\n+q"));
  assert.deepEqual(add.slice(1).map(text), [[null, "p"], [null, "q"]]);
});

test("a context line between two changes splits them into two pairs", () => {
  const out = pairSides(parseDiff("@@ -1,3 +1,3 @@\n-a\n+A\n c\n-d\n+D"));
  assert.deepEqual(out.slice(1).map(text), [["a", "A"], ["c", "c"], ["d", "D"]]);
});

test("pairs keep the original rows, so word marks and colours come along", () => {
  const rows = parseDiff("@@ -1 +1 @@\n-a\n+b");
  rows[1].marks = [[0, 1]];
  const pair = pairSides(rows)[1];
  assert.equal(pair.left, rows[1]);
  assert.equal(pair.right, rows[2]);
});

test("empty input gives no rows; a message-only body keeps its header", () => {
  assert.deepEqual(pairSides([]), []);
  assert.deepEqual(pairSides([{ kind: "@", text: "Binary file" }]), [{ kind: "@", text: "Binary file" }]);
});
