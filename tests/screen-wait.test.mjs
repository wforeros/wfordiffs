import { test } from "node:test";
import assert from "node:assert/strict";
import { waitForScreen } from "../mod/utils/screen-wait.js";

const noSleep = async () => {};

test("returns as soon as the screen has text", async () => {
  const screens = ["", "  \n", "lazygit"];
  let looks = 0;
  const ok = await waitForScreen({ read: async () => screens[looks++], sleep: noSleep });
  assert.equal(ok, true);
  assert.equal(looks, 3);
});

test("a screen that stays blank gives up at the limit", async () => {
  let looks = 0;
  const ok = await waitForScreen({ read: async () => { looks++; return ""; }, sleep: noSleep, every: 100, limit: 300 });
  assert.equal(ok, false);
  assert.equal(looks, 4);
});

test("a read that throws counts as blank, not as a failure", async () => {
  let looks = 0;
  const ok = await waitForScreen({ read: async () => { if (looks++ < 2) throw new Error("no such terminal"); return "x"; }, sleep: noSleep });
  assert.equal(ok, true);
});
