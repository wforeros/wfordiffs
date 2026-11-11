import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { parseAnsi, xterm256 } from "../mod/ansi.js";
import { scratchRepo, write, batBin } from "./helpers.mjs";

test("24-bit colors per piece, one entry per source line", () => {
  const ansi = "\x1b[38;2;147;153;178m{\x1b[0m\n\x1b[38;2;205;214;244m  \x1b[0m\x1b[38;2;166;227;161m\"x\"\x1b[0m\n\x1b[38;2;250;179;135m1\x1b[0m\n";
  const parsed = parseAnsi(ansi);
  assert.equal(parsed.length, 3);
  assert.deepEqual(parsed[0], [["{", "#9399b2"]]);
  assert.deepEqual(parsed[1], [["  ", "#cdd6f4"], ['"x"', "#a6e3a1"]]);
  assert.deepEqual(parsed[2], [["1", "#fab387"]]);
  assert.deepEqual(parseAnsi("plain\n"), [[["plain", null]]]);
  assert.equal(parseAnsi("").length, 0);
});

test("256-colour output: cube, grays, system colours left alone", () => {
  assert.deepEqual(parseAnsi("\x1b[38;5;189mx\x1b[0m\n")[0], [["x", xterm256(189)]]);
  assert.equal(xterm256(16), "#000000");
  assert.equal(xterm256(231), "#ffffff");
  assert.equal(xterm256(232), "#080808");
  assert.equal(xterm256(4), null);
});

test("bat itself: its text is the file's text", { skip: !batBin && "bat not installed" }, () => {
  const dir = scratchRepo();
  write(dir, "sample.py", 'def f(x):\n    """doc\n    more"""\n    return "s" # c\n');
  const out = spawnSync(batBin, ["--color=always", "-pp", "--tabs=4", "--wrap=never", "--theme", "Catppuccin Mocha", "--", join(dir, "sample.py")], { encoding: "utf8" }).stdout;
  const lines = parseAnsi(out);
  assert.equal(lines.length, 4);
  assert.equal(lines[3].map((p) => p[0]).join(""), '    return "s" # c');
  assert.ok(lines[3].some(([, c]) => c !== null));
});
