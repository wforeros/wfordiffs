// node tests/run.mjs: the pure parts of gitdiff, plus git's real output on a scratch repo.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseNumstat, parseNameStatus, parseDiff, langOf, tokens } from "../mod/lib.js";

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
console.log("gitdiff tests: ok");
