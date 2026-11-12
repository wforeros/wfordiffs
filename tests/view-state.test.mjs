import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, commitSwitchState } from "../mod/view-state.js";

test("a fresh panel starts loading, with nothing open and no commit", () => {
  const state = initialState();
  assert.equal(state.loading, true);
  assert.equal(state.rev, null);
  assert.equal(state.open.size, 0);
  assert.deepEqual(state.files, []);
  assert.equal(state.split, 0.5);
});

test("every call hands out its own sets and objects", () => {
  const a = initialState(), b = initialState();
  a.open.add("x.js"); a.widths.list = 100; a.cfg.font = 99;
  assert.equal(b.open.size, 0);
  assert.deepEqual(b.widths, {});
  assert.notEqual(b.cfg.font, 99);
});

test("a commit switch resets what the previous commit left, and only that", () => {
  const reset = commitSwitchState();
  assert.deepEqual(Object.keys(reset).sort(), ["block", "blockMenu", "diffs", "files", "fp", "hoverBlock", "loading", "message", "msgOpen", "open", "sel"]);
  assert.equal(reset.loading, true);
  assert.notEqual(commitSwitchState().open, reset.open);
  for (const key of Object.keys(reset)) assert.ok(key in initialState(), `${key} is a field of the state`);
});
