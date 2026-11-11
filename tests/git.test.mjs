import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeGit } from "../mod/git.js";
import { EMPTY_TREE } from "../mod/parse.js";
import { git, scratchRepo, write, exec, readTextFile } from "./helpers.mjs";

const { load, diffFor } = makeGit({ exec, readTextFile });

test("not a git repository", async () => {
  const r = await load({ cwd: mkdtempSync(join(tmpdir(), "nogit-")), on: null });
  assert.equal(r.root, null);
  assert.equal(r.error, "Not a git repository");
});

test("repo with no commits: diffs against the empty tree", async () => {
  const dir = scratchRepo();
  write(dir, "new.txt", "a\nb\n");
  const r = await load({ cwd: dir, on: null });
  assert.equal(r.base, EMPTY_TREE);
  assert.deepEqual(r.files.map((f) => [f.path, f.add, f.status, f.untracked]), [["new.txt", 2, "A", true]]);
});

test("modified and untracked files", async () => {
  const dir = scratchRepo();
  write(dir, "m.txt", "one\n");
  git(dir, "add", "."); git(dir, "commit", "-qm", "init");
  write(dir, "m.txt", "one\ntwo\n"); write(dir, "u.txt", "x\n");
  const loc = { cwd: dir, on: null };
  const r = await load(loc);
  const by = Object.fromEntries(r.files.map((f) => [f.path, f]));
  assert.equal(by["m.txt"].add, 1);
  assert.equal(by["u.txt"].untracked, true);
  const rows = await diffFor(loc, by["m.txt"], r.base);
  assert.deepEqual(rows.filter((x) => x.kind === "+").map((x) => x.text), ["two"]);
  const un = await diffFor(loc, by["u.txt"], r.base);
  assert.deepEqual(un.map((x) => x.kind), ["@", "+"]);
});

test("binary files are reported, not diffed", async () => {
  const rows = await diffFor({ cwd: ".", on: null }, { path: "x.png", binary: true }, "HEAD");
  assert.equal(rows[0].text, "Binary file");
});
