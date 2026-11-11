import { test } from "node:test";
import assert from "node:assert/strict";
import { treeRows } from "../mod/tree.js";

const f = (path, add = 1, del = 0) => ({ path, add, del, status: "M" });

test("each folder's subfolders, then its files, depth-first", () => {
  const rows = treeRows([f("b.js"), f("src/app/x.js"), f("src/a.js"), f("a.md")]);
  assert.deepEqual(rows.map((r) => [r.kind, r.name, r.depth]), [
    ["dir", "src", 0],
    ["dir", "app", 1],
    ["file", "x.js", 2],
    ["file", "a.js", 1],
    ["file", "a.md", 0],
    ["file", "b.js", 0],
  ]);
});

test("root files come after the folders", () => {
  const rows = treeRows([f("b.js"), f("src/a.js"), f("a.md")]);
  assert.deepEqual(rows.map((r) => [r.kind, r.name]), [
    ["dir", "src"],
    ["file", "a.js"],
    ["file", "a.md"],
    ["file", "b.js"],
  ]);
});

test("a folder row carries the totals of the changes below it, and its path", () => {
  const rows = treeRows([f("src/a.js", 3, 1), f("src/lib/b.js", 2, 4), f("src/lib/c.js", 0, 5), f("top.js", 9, 9)]);
  const src = rows.find((r) => r.kind === "dir" && r.name === "src");
  const lib = rows.find((r) => r.kind === "dir" && r.name === "lib");
  assert.deepEqual([src.path, src.add, src.del, src.depth], ["src", 5, 10, 0]);
  assert.deepEqual([lib.path, lib.add, lib.del, lib.depth], ["src/lib", 2, 9, 1]);
});

test("a file row keeps its file and shows only its own name", () => {
  const file = f("src/lib/b.js");
  const row = treeRows([file]).at(-1);
  assert.equal(row.kind, "file");
  assert.equal(row.file, file);
  assert.equal(row.name, "b.js");
  assert.equal(row.depth, 2);
});

test("no files, no rows", () => {
  assert.deepEqual(treeRows([]), []);
});

test("rootName adds the top folder at depth 0, and everything hangs from it", () => {
  const rows = treeRows([f("src/a.js"), f("b.js")], "repo");
  assert.deepEqual(rows.map((r) => [r.kind, r.name, r.depth, r.last]), [
    ["dir", "repo", 0, true],
    ["dir", "src", 1, false],
    ["file", "a.js", 2, true],
    ["file", "b.js", 1, true],
  ]);
});

test("guides: an ancestor with later siblings keeps its line running past the rows below it", () => {
  const rows = treeRows([f("a/x/1.js"), f("a/y.js"), f("b.js")], "repo");
  const at = (name) => rows.find((r) => r.name === name);
  // "1.js" sits under a/x: a has b.js after it and x has y.js after it, so both lines run past it.
  assert.deepEqual(at("1.js").guides, [true, true]);
  // "y.js" is the last child of a, and a has b.js after it: a's line runs past y.js, and it ends at y.js.
  assert.deepEqual(at("y.js").guides, [true]);
  assert.equal(at("y.js").last, true);
  assert.equal(at("x").last, false);
  // b.js is a top-level item, last of the repo: nothing runs past it.
  assert.deepEqual(at("b.js").guides, []);
});
