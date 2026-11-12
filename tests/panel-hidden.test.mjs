import test from "node:test";
import assert from "node:assert/strict";
import { isModHidden } from "../mod/panel-hidden.js";

const layout = (hidden, active) => ({
  type: "column", children: [
    { id: "panel", type: "column", hidden, children: [
      { id: "panel-body", type: "stack", active, children: [
        { id: "changes", type: "block", content: { mod: "changes" } },
        { id: "diffviewer", type: "block", content: { mod: "wfordiffs" } },
      ] },
    ] },
  ],
});

test("shown: panel open and its block is the active one", () => {
  assert.equal(isModHidden(layout(false, "diffviewer"), "wfordiffs"), false);
});
test("hidden: the panel is closed", () => {
  assert.equal(isModHidden(layout(true, "diffviewer"), "wfordiffs"), true);
});
test("hidden: another child of the stack is active", () => {
  assert.equal(isModHidden(layout(false, "changes"), "wfordiffs"), true);
});
test("no such block: false, so nothing is closed", () => {
  assert.equal(isModHidden(layout(true, "changes"), "other"), false);
  assert.equal(isModHidden(null, "wfordiffs"), false);
});
