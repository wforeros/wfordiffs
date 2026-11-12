import test from "node:test";
import assert from "node:assert/strict";
import { patchLayout, patchBar } from "../button-setup.mjs";

const layout = JSON.stringify({ type: "column", children: [{ id: "panel-body", type: "stack", active: "changes", children: [
  { id: "files", type: "block", content: { mod: "files" } },
  { id: "changes", type: "block", content: { mod: "changes" } },
  { id: "graph", type: "block", content: { mod: "git-graph" } },
] }] });

test("layout: a block of the mod goes after Changes, once", () => {
  const r = patchLayout(layout);
  assert.equal(r.changed, true);
  const ids = JSON.parse(r.text).children[0].children.map((c) => c.id);
  assert.deepEqual(ids, ["files", "changes", "diffviewer", "graph"]);
  assert.equal(patchLayout(r.text).changed, false);
});
test("layout: Changes stays Herdr's own", () => {
  const kids = JSON.parse(patchLayout(layout).text).children[0].children;
  assert.equal(kids.find((c) => c.id === "changes").content.mod, "changes");
});
test("layout: no side panel stack is an error, nothing changes", () => {
  const r = patchLayout('{"type":"column","children":[]}');
  assert.equal(r.changed, false);
  assert.ok(r.why);
});

const bar = `    const enabled = shared("workspace.panels") ?? ["files", "changes"];
    return h_flex()
      .when(enabled.includes("files"), el => el.child(panelButton("files", "Files", "a.svg")))
      .when(enabled.includes("changes"), el => el.child(panelButton("changes", "Changes", "b.svg")))
      .when(w?.buttons, el => el);`;

test("bar: the id joins the enabled list and the button follows Changes, once", () => {
  const r = patchBar(bar);
  assert.equal(r.changed, true);
  assert.match(r.text, /const enabled = \[\.\.\.\(shared\("workspace\.panels"\) \?\? \["files", "changes"\]\), "diffviewer"\];/);
  const lines = r.text.split("\n"), i = lines.findIndex((l) => l.includes('includes("changes")'));
  assert.match(lines[i + 1], /panelButton\("diffviewer", "Diffviewer", "mods\/wfordiffs\/icons\/split\.svg"\)/);
  assert.equal(patchBar(r.text).changed, false);
});
test("bar: a source of another shape is an error, nothing changes", () => {
  const r = patchBar("export default class X {}");
  assert.equal(r.changed, false);
  assert.ok(r.why);
});
