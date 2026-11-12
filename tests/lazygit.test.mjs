import { test } from "node:test";
import assert from "node:assert/strict";
import { makeLazygit, FIND_LAZYGIT } from "../mod/lazygit.js";

// An exec that answers with `code` (or throws) and counts its calls.
function fakeExec(answer) {
  const calls = [];
  const exec = async (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return answer(opts);
  };
  return { exec, calls };
}

test("lazygit found on the machine: the button shows", async () => {
  const { exec, calls } = fakeExec(() => ({ code: 0, stdout: "", stderr: "" }));
  const { hasLazygit } = makeLazygit({ exec });
  assert.equal(await hasLazygit({ cwd: "/repo", on: "wsl" }), true);
  assert.equal(calls[0].cmd, "sh");
  assert.deepEqual(calls[0].opts, { cwd: "/repo", on: "wsl" });
});

test("lazygit missing: no button", async () => {
  const { exec } = fakeExec(() => ({ code: 1, stdout: "", stderr: "" }));
  const { hasLazygit } = makeLazygit({ exec });
  assert.equal(await hasLazygit({ cwd: "/repo", on: null }), false);
});

test("a probe that cannot run: no button, no throw", async () => {
  const { exec } = fakeExec(() => { throw new Error("no shell"); });
  const { hasLazygit } = makeLazygit({ exec });
  assert.equal(await hasLazygit({ cwd: "/repo", on: null }), false);
});

test("asked once per machine", async () => {
  const { exec, calls } = fakeExec(() => ({ code: 0, stdout: "", stderr: "" }));
  const { hasLazygit } = makeLazygit({ exec });
  await hasLazygit({ cwd: "/repo", on: "wsl" });
  await hasLazygit({ cwd: "/other", on: "wsl" });
  assert.equal(calls.length, 1, "same machine: cached");
});

test("the check and the launch look in the same places", () => {
  for (const spot of ["/home/linuxbrew/.linuxbrew/bin/lazygit", "/usr/local/bin/lazygit", '"$HOME/.local/bin/lazygit"', "/usr/bin/lazygit"]) {
    assert.ok(FIND_LAZYGIT.includes(spot), `launch misses ${spot}`);
  }
  assert.match(FIND_LAZYGIT, /exec "\$n"/);
});

test("the menu's launch is the same as the panel's", async () => {
  const menu = await import("../menu/lazygit.js");
  assert.equal(menu.FIND_LAZYGIT, FIND_LAZYGIT);
});
