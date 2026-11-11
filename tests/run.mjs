// node tests/run.mjs: the pure parts of gitdiff, plus git's real output on a scratch repo.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseNumstat, parseNameStatus, parseDiff } from "../mod/parse.js";
import { langOf, tokens } from "../mod/lexer.js";
import { parseAnsi, xterm256 } from "../mod/ansi.js";

const git = (cwd, ...args) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", maxBuffer: 1e8 });
const colors = { dim: "D", ansi1: "R", ansi2: "G", ansi4: "F", ansi5: "K" };

// parsers on real git output
const dir = mkdtempSync(join(tmpdir(), "gitdiff-"));
git(dir, "init", "-q");
writeFileSync(join(dir, "a.py"), 'def hi(x):\n    return "a" + str(x)  # c\n');
writeFileSync(join(dir, "b.js"), "const n = 42;\n");
git(dir, "add", ".");
git(dir, "commit", "-qm", "init");
writeFileSync(join(dir, "a.py"), 'def hi(x):\n    return "b" + str(x)  # c\n    pass\n');
writeFileSync(join(dir, "b.js"), "");
const num = parseNumstat(git(dir, "diff", "HEAD", "--numstat", "-z", "--no-renames"));
const ns = parseNameStatus(git(dir, "diff", "HEAD", "--name-status", "-z", "--no-renames"));
assert.deepEqual(num.find((f) => f.path === "a.py"), { path: "a.py", add: 2, del: 1, binary: false });
assert.deepEqual(num.find((f) => f.path === "b.js"), { path: "b.js", add: 0, del: 1, binary: false });
assert.equal(ns["a.py"], "M");
assert.equal(ns["b.js"], "M");
const rows = parseDiff(git(dir, "diff", "HEAD", "--no-color", "-U3", "--", "a.py"));
assert.equal(rows[0].kind, "@");
assert.equal(rows.filter((r) => r.kind === "+").length, 2);
assert.equal(rows.filter((r) => r.kind === "-").length, 1);
assert.equal(rows.find((r) => r.kind === "-").o, 2);

// untracked-style synthetic diff
const synth = parseDiff("@@ -0,0 +1,2 @@\n+x\n+y");
assert.deepEqual(synth.slice(1).map((r) => r.n), [1, 2]);

// names and syntax
assert.equal(langOf("x/y.tsx"), "js");
assert.equal(langOf("README"), null);
assert.deepEqual(tokens('    return "a" + str(x)  # c', "py", colors).filter(([, c]) => c).map(([s, c]) => [s, c]),
  [["return", "K"], ['"a"', "G"], ["str", "F"], ["# c", "D"]]);
assert.deepEqual(tokens("function f() {} // hi", "js", colors).filter(([, c]) => c).map(([s, c]) => [s, c]),
  [["function", "K"], ["f", "F"], ["// hi", "D"]]);
assert.deepEqual(tokens("x = 1", null, colors), [["x = 1", null]]);
// bat's ANSI output: colors per piece, one entry per source line
const ansi = "\x1b[38;2;147;153;178m{\x1b[0m\n\x1b[38;2;205;214;244m  \x1b[0m\x1b[38;2;166;227;161m\"x\"\x1b[0m\n\x1b[38;2;250;179;135m1\x1b[0m\n";
const parsed = parseAnsi(ansi);
assert.equal(parsed.length, 3);
assert.deepEqual(parsed[0], [["{", "#9399b2"]]);
assert.deepEqual(parsed[1], [["  ", "#cdd6f4"], ['"x"', "#a6e3a1"]]);
assert.deepEqual(parsed[2], [["1", "#fab387"]]);
assert.deepEqual(parseAnsi("plain\n"), [[["plain", null]]]);
assert.equal(parseAnsi("").length, 0);
// 256-colour output (bat without COLORTERM): cube, grays, system colours left alone
assert.deepEqual(parseAnsi("\x1b[38;5;189mx\x1b[0m\n")[0], [["x", "#cdd6f4"]].map(() => ["x", xterm256(189)]));
assert.equal(xterm256(16), "#000000");
assert.equal(xterm256(231), "#ffffff");
assert.equal(xterm256(232), "#080808");
assert.equal(xterm256(4), null);

// bat itself, when installed: one entry per source line, and its text is the file's text
import { spawnSync } from "node:child_process";
const batBin = ["bat", "batcat"].find((b) => spawnSync(b, ["--version"]).status === 0);
if (batBin) {
  const sample = join(dir, "sample.py");
  writeFileSync(sample, 'def f(x):\n    """doc\n    more"""\n    return "s" # c\n');
  const out = spawnSync(batBin, ["--color=always", "-pp", "--tabs=4", "--wrap=never", "--theme", "Catppuccin Mocha", "--", sample], { encoding: "utf8" }).stdout;
  const lines = parseAnsi(out);
  assert.equal(lines.length, 4);
  assert.equal(lines[3].map((p) => p[0]).join(""), '    return "s" # c');
  assert.ok(lines[3].some(([, c]) => c !== null), "bat colors present");
  console.log("bat: ok");
} else {
  console.log("bat: not installed, skipped");
}

console.log("gitdiff tests: ok");
