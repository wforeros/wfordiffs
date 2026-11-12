import { test } from "node:test";
import assert from "node:assert/strict";
import { splitMessage, shortRev } from "../mod/commit-message.js";

test("shortRev: the short hash of a recent commit, else the first 7 characters", () => {
  const commits = [{ sha: "abcdef0123456789", short: "abcdef0" }];
  assert.equal(shortRev("abcdef0123456789", commits), "abcdef0");
  assert.equal(shortRev("1234567890abcdef", commits), "1234567");
});

test("the first line is the subject, the rest (trimmed) is the body", () => {
  assert.deepEqual(splitMessage("fix: a\n\nWhy it broke.\nMore."), { subject: "fix: a", body: "Why it broke.\nMore." });
});

test("a one-line message has no body", () => {
  assert.deepEqual(splitMessage("fix: a"), { subject: "fix: a", body: "" });
  assert.deepEqual(splitMessage("fix: a\n\n"), { subject: "fix: a", body: "" });
});
