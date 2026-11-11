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

test("a folder row carries its path, and no line counts (those are the list's)", () => {
  const rows = treeRows([f("src/a.js", 3, 1), f("src/lib/b.js", 2, 4)]);
  const lib = rows.find((r) => r.kind === "dir" && r.name === "lib");
  assert.deepEqual([lib.path, lib.depth], ["src/lib", 1]);
  assert.equal("add" in lib || "del" in lib, false);
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
  assert.deepEqual(rows.map((r) => [r.kind, r.name, r.depth]), [
    ["dir", "repo", 0],
    ["dir", "src", 1],
    ["file", "a.js", 2],
    ["file", "b.js", 1],
  ]);
});

test("lines: a folder's line runs down past its rows and stops at its last one", () => {
  // repo / a / x / 1.js, then a / y.js, then b.js (directly under repo)
  const rows = treeRows([f("a/x/1.js"), f("a/y.js"), f("b.js")], "repo");
  const at = (name) => rows.find((r) => r.name === name);
  // repo's line runs past everything but b.js, its last row
  assert.deepEqual(at("a").through, [true]);
  // a's line runs past x, and stops at y.js, its last row
  assert.deepEqual(at("x").through, [true, true]);
  assert.deepEqual(at("y.js").through, [true, false]);
  // 1.js ends x's line (its last row) and runs repo's on, since b.js comes after
  assert.deepEqual(at("1.js").through, [true, true, false]);
  assert.deepEqual(at("b.js").through, [false]);
});

test("hangs: only a folder with rows under it starts a line from its chevron", () => {
  const rows = treeRows([f("a/x/1.js"), f("a/y.js"), f("b.js")], "repo");
  const at = (name) => rows.find((r) => r.name === name);
  assert.equal(at("repo").hangs, true);
  assert.equal(at("a").hangs, true);
  assert.equal(at("x").hangs, true);
  assert.equal(at("1.js").hangs, undefined);
  assert.equal(at("b.js").hangs, undefined);
});

test("a folded folder keeps its row (closed) and drops what is under it", () => {
  const files = [f("src/a/x.js"), f("src/b.js"), f("top.js")];
  const rows = treeRows(files, "repo", new Set(["src"]));
  assert.deepEqual(rows.map((r) => [r.kind, r.name, r.open ?? null]), [
    ["dir", "repo", true],
    ["dir", "src", false],
    ["file", "top.js", null],
  ]);
  const root = treeRows(files, "repo", new Set([""]));
  assert.deepEqual(root.map((r) => r.name), ["repo"]);
  assert.equal(root[0].open, false);
});
