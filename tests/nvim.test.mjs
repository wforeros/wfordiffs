import { test } from "node:test";
import assert from "node:assert/strict";
import { makeNvim, FIND_NVIM } from "../mod/nvim.js";

// An exec that answers with `code` (or throws) and counts its calls.
function fakeExec(answer) {
  const calls = [];
  const exec = async (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return answer(opts);
  };
  return { exec, calls };
}

test("nvim found on the machine: the icon shows", async () => {
  const { exec, calls } = fakeExec(() => ({ code: 0, stdout: "", stderr: "" }));
  const { hasNvim } = makeNvim({ exec });
  assert.equal(await hasNvim({ cwd: "/repo", on: "wsl" }), true);
  assert.equal(calls[0].cmd, "sh");
  assert.deepEqual(calls[0].opts, { cwd: "/repo", on: "wsl" });
});

test("nvim missing: no icon", async () => {
  const { exec } = fakeExec(() => ({ code: 1, stdout: "", stderr: "" }));
  const { hasNvim } = makeNvim({ exec });
  assert.equal(await hasNvim({ cwd: "/repo", on: null }), false);
});

test("a probe that cannot run: no icon, no throw", async () => {
  const { exec } = fakeExec(() => { throw new Error("no shell"); });
  const { hasNvim } = makeNvim({ exec });
  assert.equal(await hasNvim({ cwd: "/repo", on: null }), false);
});

test("asked once per machine, even when several refreshes ask at once", async () => {
  const { exec, calls } = fakeExec(() => new Promise((r) => setTimeout(() => r({ code: 0, stdout: "", stderr: "" }), 5)));
  const { hasNvim } = makeNvim({ exec });
  const [a, b] = await Promise.all([hasNvim({ cwd: "/repo", on: "wsl" }), hasNvim({ cwd: "/repo", on: "wsl" })]);
  assert.equal(a, true);
  assert.equal(b, true);
  assert.equal(calls.length, 1);
  await hasNvim({ cwd: "/other", on: "wsl" });
  assert.equal(calls.length, 1, "same machine: cached");
  await hasNvim({ cwd: "/repo", on: null });
  assert.equal(calls.length, 2, "another machine: asked");
});

test("the check and the launch look in the same places", () => {
  const { exec } = fakeExec(() => ({ code: 0 }));
  makeNvim({ exec });
  for (const spot of ["/home/linuxbrew/.linuxbrew/bin/nvim", "/usr/local/bin/nvim", '"$HOME/.local/bin/nvim"', "/usr/bin/nvim", "/opt/nvim/bin/nvim"]) {
    assert.ok(FIND_NVIM.includes(spot), `launch misses ${spot}`);
  }
  assert.match(FIND_NVIM, /exec "\$n" "\$@"/);
});
