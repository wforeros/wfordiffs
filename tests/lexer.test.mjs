import { test } from "node:test";
import assert from "node:assert/strict";
import { langOf, tokens } from "../mod/lexer.js";

const colors = { dim: "D", ansi1: "R", ansi2: "G", ansi4: "F", ansi5: "K" };
const colored = (text, lang) => tokens(text, lang, colors).filter(([, c]) => c);

test("langOf", () => {
  assert.equal(langOf("x/y.tsx"), "js");
  assert.equal(langOf("README"), null);
});
test("python tokens", () => {
  assert.deepEqual(colored('    return "a" + str(x)  # c', "py"), [["return", "K"], ['"a"', "G"], ["str", "F"], ["# c", "D"]]);
});
test("js tokens", () => {
  assert.deepEqual(colored("function f() {} // hi", "js"), [["function", "K"], ["f", "F"], ["// hi", "D"]]);
});
test("no language: one plain piece", () => {
  assert.deepEqual(tokens("x = 1", null, colors), [["x = 1", null]]);
});
