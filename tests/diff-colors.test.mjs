import { test } from "node:test";
import assert from "node:assert/strict";
import { addedColor, removedColor, modifiedColor, lineColor, statusColor } from "../mod/diff-colors.js";

const theme = { ansi2: "#green", ansi1: "#red", blocked: "#amber" };

test("the theme's colors are the defaults", () => {
  assert.equal(addedColor({}, theme), "#green");
  assert.equal(removedColor({}, theme), "#red");
  assert.equal(modifiedColor({}, theme), "#amber");
});

test("the user's choice wins over the theme", () => {
  const cfg = { added: "#00ff00", removed: "#ff0000", modified: "#0000ff" };
  assert.equal(addedColor(cfg, theme), "#00ff00");
  assert.equal(removedColor(cfg, theme), "#ff0000");
  assert.equal(modifiedColor(cfg, theme), "#0000ff");
});

test("a line's kind picks its color, a context line has none", () => {
  assert.equal(lineColor("+", {}, theme), "#green");
  assert.equal(lineColor("-", {}, theme), "#red");
  assert.equal(lineColor(" ", {}, theme), null);
  assert.equal(lineColor(undefined, {}, theme), null);
});

test("a file's status picks its color, anything else is a modification", () => {
  assert.equal(statusColor("A", {}, theme), "#green");
  assert.equal(statusColor("D", {}, theme), "#red");
  assert.equal(statusColor("M", {}, theme), "#amber");
  assert.equal(statusColor(undefined, {}, theme), "#amber");
});
