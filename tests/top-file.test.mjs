import { test } from "node:test";
import assert from "node:assert/strict";
import { topFile } from "../mod/top-file.js";

const paths = ["a", "b", "c"], heights = [100, 40, 300];
const heightOf = (i) => heights[i];

test("a file that starts above the top edge is the top file", () => {
  assert.equal(topFile(paths, 2, -50, heightOf), "c");
  assert.equal(topFile(paths, 2, 0, heightOf), "c");
});

test("a file that starts below the top edge leaves the top to the one before it", () => {
  assert.equal(topFile(paths, 2, 30, heightOf), "b"); // b spans the 40px above c
  assert.equal(topFile(paths, 1, 100, heightOf), "a");
});

test("a gap wider than the previous file walks further back, and stops at the first", () => {
  assert.equal(topFile(paths, 2, 60, heightOf), "a"); // b (40) does not cover 60; a does
  assert.equal(topFile(paths, 2, 9999, heightOf), "a");
  assert.equal(topFile(paths, 0, 50, heightOf), "a");
});

test("only the files the walk passes are measured", () => {
  const asked = [];
  topFile(paths, 2, 30, (i) => { asked.push(i); return heights[i]; });
  assert.deepEqual(asked, [1]);
  asked.length = 0;
  topFile(paths, 2, -5, (i) => { asked.push(i); return heights[i]; });
  assert.deepEqual(asked, []);
});
