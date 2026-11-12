import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNumstat, parseNameStatus, parseDiff, numberBlocks } from "../mod/parse.js";
import { git, scratchRepo, write } from "./helpers.mjs";

function repo() {
  const dir = scratchRepo();
  write(dir, "a.py", 'def hi(x):\n    return "a" + str(x)  # c\n');
  write(dir, "b.js", "const n = 42;\n");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "init");
  write(dir, "a.py", 'def hi(x):\n    return "b" + str(x)  # c\n    pass\n');
  write(dir, "b.js", "");
  return dir;
}

test("numstat and name-status on real git output", () => {
  const dir = repo();
  const num = parseNumstat(git(dir, "diff", "HEAD", "--numstat", "-z", "--no-renames"));
  const ns = parseNameStatus(git(dir, "diff", "HEAD", "--name-status", "-z", "--no-renames"));
  assert.deepEqual(num.find((f) => f.path === "a.py"), { path: "a.py", add: 2, del: 1, binary: false });
  assert.deepEqual(num.find((f) => f.path === "b.js"), { path: "b.js", add: 0, del: 1, binary: false });
  assert.equal(ns["a.py"], "M");
  assert.equal(ns["b.js"], "M");
});

test("parseDiff rows and line numbers", () => {
  const rows = parseDiff(git(repo(), "diff", "HEAD", "--no-color", "-U3", "--", "a.py"));
  assert.equal(rows[0].kind, "@");
  assert.equal(rows.filter((r) => r.kind === "+").length, 2);
  assert.equal(rows.filter((r) => r.kind === "-").length, 1);
  assert.equal(rows.find((r) => r.kind === "-").o, 2);
});

test("synthetic diff of an untracked file", () => {
  const synth = parseDiff("@@ -0,0 +1,2 @@\n+x\n+y");
  assert.deepEqual(synth.slice(1).map((r) => r.n), [1, 2]);
});

test("numberBlocks groups each run of changed rows, and a context line or a header ends it", () => {
  const rows = [
    { kind: "@", text: "@@" }, { kind: "-", text: "a" }, { kind: "+", text: "b" },
    { kind: " ", text: "c" }, { kind: "+", text: "d" }, { kind: "@", text: "@@" }, { kind: "+", text: "e" },
  ];
  const out = numberBlocks(rows);
  assert.deepEqual(out.map((r) => r.blk), [undefined, 0, 0, undefined, 1, undefined, 2]);
  assert.deepEqual(out.map((r) => !!r.first), [false, true, false, false, true, false, true]);
  assert.equal(rows[1].blk, undefined, "the input rows are not changed");
});

test("numberBlocks takes its predicate, for the split view's pairs", () => {
  const pairs = [{ kind: "pair", left: { kind: "-" }, right: null }, { kind: "pair", left: { kind: " " }, right: { kind: " " } }];
  const isChanged = (r) => r.kind === "pair" && r.left?.kind !== " ";
  assert.deepEqual(numberBlocks(pairs, isChanged).map((r) => [r.blk, !!r.first]), [[0, true], [undefined, false]]);
});
