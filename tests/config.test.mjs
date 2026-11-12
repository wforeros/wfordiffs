import { test } from "node:test";
import assert from "node:assert/strict";
import { parseView } from "../mod/config.js";

test("the shared views default to off, and only true turns one on", () => {
  assert.deepEqual(parseView(null), { side: false, tree: false, wrap: false });
  assert.deepEqual(parseView("{nope"), { side: false, tree: false, wrap: false });
  assert.deepEqual(parseView({ side: true, tree: "yes", wrap: 1 }), { side: true, tree: false, wrap: false });
  assert.deepEqual(parseView('{"side":false,"tree":true,"wrap":true}'), { side: false, tree: true, wrap: true });
});
