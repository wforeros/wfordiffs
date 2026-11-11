import { test } from "node:test";
import assert from "node:assert/strict";
import { makeHighlighter, attachColors } from "../mod/highlight.js";

const ansi = (text) => `\x1b[38;2;1;2;3m${text}\x1b[0m\n`;

test("attachColors only paints rows whose text matches bat's", () => {
  const rows = [
    { kind: "@", text: "@@" },
    { kind: "+", text: "new", n: 1 },
    { kind: "-", text: "old", o: 1 },
    { kind: " ", text: "ctx", o: 2, n: 2 },
  ];
  const hl = {
    new: [[["new", "#010203"]], [["DIFFERENT", "#010203"]]],
    old: [[["old", "#040506"]]],
  };
  attachColors(rows, hl);
  assert.deepEqual(rows[1].pieces, [["new", "#010203"]]);
  assert.deepEqual(rows[2].pieces, [["old", "#040506"]]);
  assert.equal(rows[3].pieces, undefined);
  assert.doesNotThrow(() => attachColors(rows, null));
});

test("no bat anywhere: highlight returns null, and the lookup is cached", async () => {
  let calls = 0;
  const exec = async () => { calls++; return { code: 1, stdout: "", stderr: "" }; };
  const { highlight } = makeHighlighter({ exec, settings: () => ({}) });
  const f = { path: "a.js", status: "M" };
  assert.equal(await highlight({ cwd: "/", on: null }, f, "HEAD"), null);
  const after = calls;
  assert.equal(await highlight({ cwd: "/", on: null }, f, "HEAD"), null);
  assert.equal(calls, after);
});

test("with bat: new and old sides, theme follows the app's appearance", async () => {
  const seen = [];
  const exec = async (cmd, args) => {
    seen.push(args.join(" "));
    return { code: 0, stdout: cmd === "sh" ? ansi("x") : "bat 0.0", stderr: "" };
  };
  const { highlight } = makeHighlighter({ exec, settings: () => ({ dark: false }) });
  const out = await highlight({ cwd: "/", on: null }, { path: "a.js", status: "M" }, "HEAD");
  assert.deepEqual(out.new, [[["x", "#010203"]]]);
  assert.deepEqual(out.old, [[["x", "#010203"]]]);
  assert.ok(seen.some((a) => a.includes("Catppuccin Latte")));
  const added = await highlight({ cwd: "/", on: null }, { path: "n.js", status: "A" }, "HEAD");
  assert.equal(added.old, undefined);
});
