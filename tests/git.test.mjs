import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeGit } from "../mod/git.js";
import { EMPTY_TREE } from "../mod/parse.js";
import { git, scratchRepo, write, exec, readTextFile } from "./helpers.mjs";

const { load, diffFor, discard } = makeGit({ exec, readTextFile });

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

test("unstaged: only the files with changes outside the index", async () => {
  const dir = scratchRepo();
  write(dir, "clean.txt", "c\n"); write(dir, "dirty.txt", "d\n"); write(dir, "staged.txt", "s\n");
  git(dir, "add", "."); git(dir, "commit", "-qm", "init");
  write(dir, "dirty.txt", "d\nmore\n");
  write(dir, "staged.txt", "s\nmore\n"); git(dir, "add", "staged.txt");
  write(dir, "new.txt", "n\n");
  const r = await load({ cwd: dir, on: null });
  const by = Object.fromEntries(r.files.map((f) => [f.path, f.unstaged]));
  assert.equal(by["dirty.txt"], true);
  assert.equal(by["new.txt"], true);
  assert.equal(by["staged.txt"], false); // in the index: not unstaged
  assert.equal(by["clean.txt"], undefined); // not in the list at all
});

test("discard a tracked file: back to the staged version, staged changes kept", async () => {
  const dir = scratchRepo();
  write(dir, "f.txt", "one\n"); git(dir, "add", "."); git(dir, "commit", "-qm", "init");
  write(dir, "f.txt", "one\ntwo\n"); git(dir, "add", "f.txt");
  write(dir, "f.txt", "one\ntwo\nthree\n");
  const loc = { cwd: dir, on: null };
  const r = await load(loc);
  await discard(loc, r.files.find((f) => f.path === "f.txt"));
  assert.equal(readFileSync(join(dir, "f.txt"), "utf8"), "one\ntwo\n");
  assert.match(git(dir, "status", "--porcelain"), /^M  f\.txt$/m);
});

test("discard an untracked file: it is deleted", async () => {
  const dir = scratchRepo();
  write(dir, "keep.txt", "k\n"); git(dir, "add", "."); git(dir, "commit", "-qm", "init");
  write(dir, "gone.txt", "g\n");
  const loc = { cwd: dir, on: null };
  const r = await load(loc);
  await discard(loc, r.files.find((f) => f.path === "gone.txt"));
  assert.equal(existsSync(join(dir, "gone.txt")), false);
});

test("discard with a name that has glob characters touches only that file", async () => {
  const dir = scratchRepo();
  write(dir, "a*b.txt", "x\n"); write(dir, "axb.txt", "x\n"); git(dir, "add", "."); git(dir, "commit", "-qm", "init");
  write(dir, "a*b.txt", "changed\n"); write(dir, "axb.txt", "changed\n");
  const loc = { cwd: dir, on: null };
  const r = await load(loc);
  await discard(loc, r.files.find((f) => f.path === "a*b.txt"));
  assert.equal(readFileSync(join(dir, "a*b.txt"), "utf8"), "x\n");
  assert.equal(readFileSync(join(dir, "axb.txt"), "utf8"), "changed\n");
});
