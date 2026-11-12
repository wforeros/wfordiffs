import { test } from "node:test";
import assert from "node:assert/strict";
import { makeToolWindow } from "../mod/utils/tool-window.js";

// A fake Herdr: hc answers run/read, terminals are a set, overlays are counted, timers run by hand.
function setup() {
  const s = { live: new Set(), overlays: [], closed: [], killed: [], hcCalls: [], timers: [], next: 0 };
  const deps = {
    hc: async (args) => {
      s.hcCalls.push(args);
      if (args[0] === "run") { const address = `t${++s.next}`; s.live.add(address); return { code: 0, stdout: JSON.stringify({ address }), stderr: "" }; }
      return { code: 0, stdout: "drawn", stderr: "" }; // read
    },
    run: (name, a) => { if (name === "terminal.kill") { s.killed.push(a.terminal); s.live.delete(a.terminal); } },
    openOverlay: (o) => { s.overlays.push(o); return `ov${s.overlays.length}`; },
    closeOverlay: (id) => s.closed.push(id),
    terminals: () => [...s.live].map((address) => ({ address })),
  };
  const cx = { timer: { after: (ms, fn) => s.timers.push({ ms, fn: () => fn(cx) }) } };
  return { s, cx, tw: makeToolWindow(deps) };
}
const lazygit = { id: "lazygit", script: "exec lazygit" };
const loc = { cwd: "/r", on: null };
const spot = { x: 10, y: 20, width: 300, height: 200 };

test("without a spot the tool opens in the big dialog and is not tracked", async () => {
  const { s, cx, tw } = setup();
  await tw.open({ tool: lazygit, loc, cx });
  assert.equal(s.overlays[0].kind, "dialog");
  assert.equal(tw.isUp(), false);
});

test("with a spot the tool opens in a window at that spot and counts as up", async () => {
  const { s, cx, tw } = setup();
  await tw.open({ tool: lazygit, loc, cx, spot });
  assert.deepEqual([s.overlays[0].kind, s.overlays[0].at, s.overlays[0].width, s.overlays[0].height], ["window", { x: 10, y: 20 }, 300, 200]);
  assert.equal(tw.isUp(), true);
  assert.equal(tw.isUp("lazygit"), true);
  assert.equal(tw.isUp("nvim"), false);
});

test("the tool's args and place come to hc run", async () => {
  const { s, cx, tw } = setup();
  await tw.open({ tool: { id: "nvim", script: "exec nvim", args: ["+3", "a.js"] }, loc: { cwd: "/r", on: "wsl" }, cx });
  assert.deepEqual(s.hcCalls[0], ["run", "--json", "--bg", "--no-parent", "--rm", "--cwd", "/r", "--on", "wsl", "--", "sh", "-c", "exec nvim", "sh", "+3", "a.js"]);
});

test("opening another tool closes the one that is up", async () => {
  const { s, cx, tw } = setup();
  await tw.open({ tool: lazygit, loc, cx, spot });
  await tw.open({ tool: { id: "nvim", script: "x" }, loc, cx, spot });
  assert.deepEqual(s.killed, ["t1"]);
  assert.equal(tw.isUp("nvim"), true);
  assert.equal(tw.isUp("lazygit"), false);
});

test("close shuts the window and kills the terminal", async () => {
  const { s, cx, tw } = setup();
  await tw.open({ tool: lazygit, loc, cx, spot });
  tw.close();
  assert.deepEqual(s.closed, ["ov1"]);
  assert.deepEqual(s.killed, ["t1"]);
  assert.equal(tw.isUp(), false);
});

test("a second start while the first is still going is ignored", async () => {
  const { cx, tw } = setup();
  const first = tw.open({ tool: lazygit, loc, cx, spot });
  assert.equal(await tw.open({ tool: lazygit, loc, cx, spot }), false);
  assert.equal(await first, true);
});

test("a failing hc run throws with its message and frees the next start", async () => {
  const { cx } = setup();
  let fail = true;
  const tw = makeToolWindow({
    hc: async (a) => (fail && a[0] === "run" ? { code: 1, stdout: "", stderr: "no core\n" } : { code: 0, stdout: JSON.stringify({ address: "t1" }), stderr: "" }),
    run() {}, openOverlay: () => "ov", closeOverlay() {}, terminals: () => [{ address: "t1" }],
  });
  await assert.rejects(tw.open({ tool: lazygit, loc, cx }), /no core/);
  fail = false;
  assert.equal(await tw.open({ tool: lazygit, loc, cx }), true);
});

test("the watch notices the tool ending", async () => {
  const { s, cx, tw } = setup();
  let ended = 0;
  await tw.open({ tool: lazygit, loc, cx, spot, onEnd: () => { ended++; } });
  s.live.clear();
  s.timers.pop().fn(); // the first tick
  assert.equal(ended, 1);
  assert.equal(tw.isUp(), false);
});

test("a resize hides the window and puts it back in the new frame once it is still", async () => {
  const { s, cx, tw } = setup();
  await tw.open({ tool: lazygit, loc, cx, spot });
  tw.resized(cx, () => ({ x: 1, y: 2, width: 50, height: 60 }), () => {});
  tw.resized(cx, () => ({ x: 1, y: 2, width: 70, height: 80 }), () => {}); // still moving: the first timer is stale
  assert.deepEqual(s.closed, ["ov1"]);
  const [stale, latest] = s.timers.splice(-2);
  stale.fn();
  assert.equal(s.overlays.length, 1);
  latest.fn();
  assert.equal(s.overlays.length, 2);
  assert.equal(s.overlays[1].width, 70);
});

test("away: true while the window is off for a resize, and a moment after it is back", async () => {
  const { s, cx, tw } = setup();
  let changes = 0;
  await tw.open({ tool: lazygit, loc, cx, spot });
  assert.equal(tw.isAway(), false); // opening never shows the notice
  tw.resized(cx, () => spot, () => { changes++; });
  assert.equal(tw.isAway(), true);
  s.timers.pop().fn(); // still for 200ms: the window is placed again
  assert.equal(s.overlays.length, 2);
  assert.equal(tw.isAway(), true); // but the body keeps its notice until the window has had time to draw
  s.timers.pop().fn(); // 150ms later
  assert.equal(tw.isAway(), false);
  assert.equal(changes, 1);
});
