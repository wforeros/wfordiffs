import { test } from "node:test";
import assert from "node:assert/strict";
import { fileLabel } from "../mod/file-label.js";

test("a path splits into its folders and its name", () => {
  assert.deepEqual(fileLabel("mod/ui/ui-header.js"), { dir: "mod/ui/", name: "ui-header.js" });
  assert.deepEqual(fileLabel("README.md"), { dir: "", name: "README.md" });
  assert.deepEqual(fileLabel("a/b"), { dir: "a/", name: "b" });
});
