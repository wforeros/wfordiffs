import { test } from "node:test";
import assert from "node:assert/strict";
import { diffRanges, markWords, splitMarks } from "../mod/inline.js";
import { parseConfig, tint } from "../mod/config.js";

const cut = (text, ranges) => ranges.map(([s, e]) => text.slice(s, e));

test("diffRanges finds the exact words that changed", () => {
  const d = diffRanges('return "a" + str(x)', 'return "b" + str(x)');
  assert.deepEqual(cut('return "a" + str(x)', d.a), ["a"]);
  assert.deepEqual(cut('return "b" + str(x)', d.b), ["b"]);
});

test("insertions only mark the new side", () => {
  const d = diffRanges("foo(a)", "foo(a, b)");
  assert.deepEqual(d.a, []);
  assert.deepEqual(cut("foo(a, b)", d.b), [", b"]);
});

test("markWords pairs - and + rows in order; unrelated lines get none", () => {
  const rows = [
    { kind: "@", text: "@@" },
    { kind: "-", text: "const n = 42;" }, { kind: "-", text: "alpha beta gamma" },
    { kind: "+", text: "const n = 43;" }, { kind: "+", text: "zzz yyy xxx www" },
    { kind: " ", text: "ctx" },
  ];
  markWords(rows);
  assert.deepEqual(cut(rows[1].text, rows[1].marks), ["42"]);
  assert.deepEqual(cut(rows[3].text, rows[3].marks), ["43"]);
  assert.equal(rows[2].marks, undefined);
  assert.equal(rows[4].marks, undefined);
});

test("splitMarks cuts pieces at the marks and keeps their colors", () => {
  const out = splitMarks([["const ", "K"], ["n = 42;", null]], [[10, 12]]);
  assert.equal(out.map((p) => p[0]).join(""), "const n = 42;");
  assert.deepEqual(out.filter((p) => p[2]), [["42", null, true]]);
  assert.deepEqual(splitMarks([["x", "K"]], undefined), [["x", "K", false]]);
});

test("config: defaults, validation and tint", () => {
  assert.deepEqual(parseConfig(null), { added: null, removed: null, line: 0.09, word: 0.38 });
  assert.equal(parseConfig("{nope").line, 0.09);
  const c = parseConfig('{"added":"#00ff00","removed":"red","word":0.6,"line":5}');
  assert.deepEqual(c, { added: "#00ff00", removed: null, line: 0.09, word: 0.6 });
  assert.equal(tint("#00ff00", 1), "#00ff00ff");
  assert.equal(tint("#00ff00", 0), "#00ff0000");
});
