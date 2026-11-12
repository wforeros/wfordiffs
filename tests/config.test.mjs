import { test } from "node:test";
import assert from "node:assert/strict";
import { parseView } from "../mod/config.js";

test("the shared views default to off, and only true turns one on", () => {
  assert.deepEqual(parseView(null), { side: false, tree: false, wrap: false });
  assert.deepEqual(parseView("{nope"), { side: false, tree: false, wrap: false });
  assert.deepEqual(parseView({ side: true, tree: "yes", wrap: 1 }), { side: true, tree: false, wrap: false });
  assert.deepEqual(parseView('{"side":false,"tree":true,"wrap":true}'), { side: false, tree: true, wrap: true });
});

import { shade } from "../mod/config.js";
test("shade darkens each channel of a #rrggbb color", () => {
  assert.equal(shade("#ffffff", 0.5), "#808080");
  assert.equal(shade("#6c7086", 0.6), "#414350");
  assert.equal(shade("rgb(1,2,3)", 0.5), "rgb(1,2,3)");
});

import { parseConfig } from "../mod/config.js";
test("lazygitFull is off unless it is true", () => {
  assert.equal(parseConfig(null).lazygitFull, false);
  assert.equal(parseConfig({ lazygitFull: "yes" }).lazygitFull, false);
  assert.equal(parseConfig('{"lazygitFull":true}').lazygitFull, true);
  assert.equal(parseConfig(null).nvimFull, false);
  assert.equal(parseConfig({ nvimFull: 1 }).nvimFull, false);
  assert.equal(parseConfig({ nvimFull: true }).nvimFull, true);
});
