import { test } from "node:test";
import assert from "node:assert/strict";
import { makeGit } from "../mod/git.js";
import { filterCommits } from "../mod/commit-search.js";
import { git, scratchRepo, write, exec, readTextFile } from "./helpers.mjs";

const commits = [
  { sha: "abc1230000000000000000000000000000000001", short: "abc1230", subject: "Fix the Picker" },
  { sha: "def4560000000000000000000000000000000002", short: "def4560", subject: "docs: readme" },
  { sha: "9988770000000000000000000000000000000003", short: "9988770", subject: "picker field" },
];

test("filterCommits: blank keeps all; a hash prefix or a subject part matches, any case", () => {
  assert.equal(filterCommits(commits, "  ").length, 3);
  assert.deepEqual(filterCommits(commits, "ABC12").map((c) => c.short), ["abc1230"]);
  assert.deepEqual(filterCommits(commits, "picker").map((c) => c.short), ["abc1230", "9988770"]);
  assert.deepEqual(filterCommits(commits, "1230000"), []); // a hash matches from its start, not inside
  assert.deepEqual(filterCommits(commits, "nothing"), []);
});

const { history } = makeGit({ exec, readTextFile });

test("history: the branch's commits, newest first, up to the limit", async () => {
  const dir = scratchRepo();
  write(dir, "a.txt", "a\n");
  git(dir, "add", "."); git(dir, "commit", "-qm", "first");
  write(dir, "a.txt", "b\n");
  git(dir, "commit", "-qam", "second");
  const h = await history({ cwd: dir, on: null });
  assert.deepEqual(h.map((c) => c.subject), ["second", "first"]);
  assert.equal(h[0].sha, git(dir, "rev-parse", "HEAD").trim());
});
