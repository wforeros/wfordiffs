import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeGit } from "../mod/git.js";
import { EMPTY_TREE } from "../mod/parse.js";
import { git, scratchRepo, write, exec, readTextFile } from "./helpers.mjs";

const { load, diffFor, discard, branches } = makeGit({ exec, readTextFile });

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

test("a commit's changes, and the recent commits", async () => {
  const dir = scratchRepo();
  write(dir, "a.txt", "one\n");
  git(dir, "add", "."); git(dir, "commit", "-qm", "first");
  write(dir, "a.txt", "one\ntwo\n"); write(dir, "b.txt", "x\n");
  git(dir, "add", "."); git(dir, "commit", "-qm", "second");
  const loc = { cwd: dir, on: null };
  const head = await load(loc);
  assert.deepEqual(head.commits.map((c) => c.subject), ["second", "first"]);
  const r = await load(loc, head.commits[0].sha);
  assert.deepEqual(r.files.map((f) => [f.path, f.add, f.status]).sort(), [["a.txt", 1, "M"], ["b.txt", 1, "A"]]);
  const rows = await diffFor(loc, r.files.find((f) => f.path === "a.txt"), r.base, r.rev);
  assert.deepEqual(rows.filter((x) => x.kind === "+").map((x) => x.text), ["two"]);
  const root = await load(loc, head.commits[1].sha); // the first commit has no parent
  assert.deepEqual(root.files.map((f) => f.path), ["a.txt"]);
});

test("untracked binary: listed as binary, and its text is never read", async () => {
  const dir = scratchRepo();
  write(dir, "init.txt", "i\n"); git(dir, "add", "."); git(dir, "commit", "-qm", "init");
  writeFileSync(join(dir, "pic.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2]));
  write(dir, "note.txt", "one\ntwo\n");
  const reads = [];
  const spy = async (path, opts) => { reads.push(path); return readTextFile(path, opts); };
  const { load: loadSpy } = makeGit({ exec, readTextFile: spy });
  const r = await loadSpy({ cwd: dir, on: null });
  const by = Object.fromEntries(r.files.map((f) => [f.path, f]));
  assert.equal(by["pic.png"].binary, true);
  assert.equal(by["note.txt"].binary, false);
  assert.equal(by["note.txt"].add, 2);
  assert.equal(reads.some((p) => p.endsWith("pic.png")), false);
});

test("untracked text that is not UTF-8 (or can't be read) is listed as binary", async () => {
  const dir = scratchRepo();
  write(dir, "init.txt", "i\n"); git(dir, "add", "."); git(dir, "commit", "-qm", "init");
  writeFileSync(join(dir, "latin.txt"), Buffer.from("caf\xe9 sin nul\n", "latin1"));
  const throwing = async () => { throw new Error("stream did not contain valid UTF-8"); };
  const { load: loadThrow, diffFor: diffThrow } = makeGit({ exec, readTextFile: throwing });
  const r = await loadThrow({ cwd: dir, on: null });
  const f = r.files.find((x) => x.path === "latin.txt");
  assert.equal(f.binary, true);
  assert.equal(f.add, 0);
  // Its diff, if asked for anyway, is a notice, not a crash.
  const rows = await diffThrow({ cwd: dir, on: null }, { ...f, binary: false }, r.base);
  assert.equal(rows[0].kind, "@");
  assert.equal(rows[0].text, "Cannot read this file");
});

test("tracked and modified: non-UTF-8 on either side is binary, valid UTF-8 is not", async () => {
  const dir = scratchRepo();
  writeFileSync(join(dir, "was-latin.txt"), Buffer.from("caf\xe9\n", "latin1"));
  write(dir, "accents.txt", "café\n");
  writeFileSync(join(dir, "data.bin"), Buffer.from([0, 1, 2, 3]));
  git(dir, "add", "."); git(dir, "commit", "-qm", "init");
  // Modified: a UTF-8 file gets accents, a non-UTF-8 text goes UTF-8, and a Latin-1 one replaces UTF-8 text.
  write(dir, "accents.txt", "café y más\n");
  write(dir, "was-latin.txt", "café utf8\n");
  writeFileSync(join(dir, "data.bin"), Buffer.from([0, 9, 9]));
  write(dir, "now-latin.txt", "ok\n"); git(dir, "add", "now-latin.txt"); git(dir, "commit", "-qm", "add");
  writeFileSync(join(dir, "now-latin.txt"), Buffer.from("caf\xe9\n", "latin1"));
  const r = await load({ cwd: dir, on: null });
  const by = Object.fromEntries(r.files.map((f) => [f.path, f.binary]));
  assert.equal(by["accents.txt"], false);
  assert.equal(by["was-latin.txt"], true); // its base side is not UTF-8
  assert.equal(by["data.bin"], true);
  assert.equal(by["now-latin.txt"], true); // the worktree side is not UTF-8
});

test("a commit with a non-UTF-8 file: listed as binary when that commit is shown", async () => {
  const dir = scratchRepo();
  write(dir, "a.txt", "a\n"); git(dir, "add", "."); git(dir, "commit", "-qm", "one");
  writeFileSync(join(dir, "legacy.txt"), Buffer.from("caf\xe9\n", "latin1"));
  git(dir, "add", "."); git(dir, "commit", "-qm", "two");
  const head = git(dir, "rev-parse", "HEAD").trim();
  const r = await load({ cwd: dir, on: null }, head);
  assert.equal(r.files.find((f) => f.path === "legacy.txt").binary, true);
});

test("branches: the others, and what HEAD adds since they met", async () => {
  const dir = scratchRepo();
  write(dir, "a.txt", "1\n"); git(dir, "add", "."); git(dir, "commit", "-qm", "base");
  git(dir, "branch", "other");
  write(dir, "b.txt", "x\n"); git(dir, "add", "."); git(dir, "commit", "-qm", "mine");
  git(dir, "checkout", "-q", "other");
  write(dir, "c.txt", "y\n"); git(dir, "add", "."); git(dir, "commit", "-qm", "theirs");
  git(dir, "checkout", "-q", "-");
  const loc = { cwd: dir, on: null };
  const mine = git(dir, "branch", "--show-current").toString().trim();
  assert.deepEqual(await branches(loc), ["other"]); // not the current one
  const r = await load(loc, null, "other");
  assert.equal(r.rev, "HEAD");
  assert.deepEqual(r.files.map((f) => f.path), ["b.txt"]); // not c.txt: that is the other branch's
  assert.equal(r.message, "");
  assert.ok(mine);
});

test("load names the branch HEAD is on, and a detached HEAD by its hash", async () => {
  const dir = scratchRepo();
  write(dir, "a.txt", "1\n"); git(dir, "add", "."); git(dir, "commit", "-qm", "one");
  const loc = { cwd: dir, on: null };
  const name = git(dir, "branch", "--show-current").toString().trim();
  assert.equal((await load(loc)).branch, name);
  assert.equal((await load(loc, git(dir, "rev-parse", "HEAD").toString().trim())).branch, name); // a commit shown: still the branch
  git(dir, "checkout", "-q", "--detach");
  assert.match((await load(loc)).branch, /^detached [0-9a-f]{7,}$/);
});

test("a repo without commits still names its branch", async () => {
  const dir = scratchRepo();
  assert.equal((await load({ cwd: dir, on: null })).branch, git(dir, "branch", "--show-current").toString().trim());
});
