#!/usr/bin/env node
// Adds a "Diffviewer" button next to Changes in the top-right corner of the shown layout's tab bar, on request
// (`./install.sh --button`). Herdr draws those buttons in the tab bar's own mod and no mod can add one to another,
// so this edits two files of the user's: the layout (a block of this mod in the side panel's stack) and the tab bar
// mod (a button for it). Both must be the user's own clones: shipped ones are replaced on every start.
// The patches are pure (text in, text out) so they are tested; the CLI at the bottom reads and writes the files.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MOD = "wfordiffs";
const ICON = `mods/${MOD}/icons/split.svg`;

/**
 * Adds a block of this mod to the side panel's stack, after the "changes" block.
 * @param {string} text the layout's JSON
 * @returns {{ text: string, changed: boolean, why?: string }} `why` says why nothing changed when it is an error
 */
export function patchLayout(text) {
  const layout = JSON.parse(text);
  const find = (node) => {
    if (node?.id === "panel-body" && node.type === "stack") return node;
    for (const c of node?.children ?? []) { const f = find(c); if (f) return f; }
    return null;
  };
  const stack = find(layout);
  if (!stack) return { text, changed: false, why: 'the layout has no stack "panel-body" (a side panel with Files and Changes)' };
  if (stack.children.some((c) => c.content?.mod === MOD)) return { text, changed: false };
  const at = stack.children.findIndex((c) => c.id === "changes");
  stack.children.splice(at < 0 ? stack.children.length : at + 1, 0, { id: "diffviewer", type: "block", content: { mod: MOD } });
  return { text: JSON.stringify(layout, null, 2) + "\n", changed: true };
}

/**
 * Adds the button to a tab bar mod's source, in the shape of Herdr's own `tabs`: an `enabled` list of panel ids
 * and a `.when(enabled.includes("changes"), ...)` line per button.
 * @param {string} source the tab bar's main.js
 * @returns {{ text: string, changed: boolean, why?: string }}
 */
export function patchBar(source) {
  if (source.includes('panelButton("diffviewer"')) return { text: source, changed: false };
  const enabled = /^(\s*const enabled = )(.+);[ \t]*$/m, changes = /^([ \t]*)\.when\(enabled\.includes\("changes"\),.*$/m;
  if (!enabled.test(source) || !changes.test(source)) return { text: source, changed: false, why: "the tab bar's source isn't in the shape of Herdr's tabs (no `const enabled = ...` and Changes button line)" };
  const text = source
    .replace(enabled, (_m, head, expr) => `${head}[...(${expr}), "diffviewer"];`)
    .replace(changes, (line, indent) => `${line}\n${indent}.when(enabled.includes("diffviewer"), el => el.child(panelButton("diffviewer", "Diffviewer", "${ICON}")))`);
  return { text, changed: true };
}

function main(home) {
  const fail = (m) => { console.error(`wfordiffs: --button: ${m}`); process.exit(1); };
  const shared = existsSync(join(home, "shared.json")) ? JSON.parse(readFileSync(join(home, "shared.json"), "utf8")) : {};
  const name = process.env.HERDR_LAYOUT || shared.layout;
  if (!name) fail("can't tell which layout is shown (set HERDR_LAYOUT=<name>)");
  const layoutPath = join(home, "layouts", `${name}.json`);
  if (!existsSync(layoutPath)) fail(`no layout ${layoutPath}`);
  const layoutText = readFileSync(layoutPath, "utf8"), layout = JSON.parse(layoutText);
  if (!layout.cloned_from) fail(`layout "${name}" is a shipped one (read-only). Clone it first: herdr-app do layout.clone '{"name":"${name}","as":"my-layout"}'`);
  const bar = (function find(n) { if (n?.id === "tabs" && n.content?.mod) return n.content.mod; for (const c of n?.children ?? []) { const f = find(c); if (f) return f; } return null; })(layout);
  if (!bar) fail('the layout has no "tabs" block');
  if (bar === "tabs") fail('the tab bar is Herdr\'s shipped "tabs" (read-only). Clone it first: herdr-app do mod.clone \'{"name":"tabs","as":"my-tabs"}\' and point the layout at the clone');
  const barPath = join(home, "mods", bar, "main.js");
  if (!existsSync(barPath)) fail(`no ${barPath}`);
  const l = patchLayout(layoutText), b = patchBar(readFileSync(barPath, "utf8"));
  if (l.why) fail(l.why);
  if (b.why) fail(b.why); // both or none: a block with no button, or the reverse, is worse than neither
  if (l.changed) writeFileSync(layoutPath, l.text);
  if (b.changed) writeFileSync(barPath, b.text);
  console.log(`wfordiffs: Diffviewer button ${l.changed || b.changed ? `added (layout ${name}, tab bar ${bar})` : "already there"}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv[2]);
