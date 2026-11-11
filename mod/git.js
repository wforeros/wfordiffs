// git side of the panel: the changed files and one file's diff rows.
// Takes herdr's exec and readTextFile, so tests can hand it fakes (or node's child_process).
import { EMPTY_TREE, parseNumstat, parseNameStatus, parseDiff } from "./parse.js";

// Reads write nothing under .git (no index refresh or lock), so the folder watch stays quiet.
const GIT = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false", "-c", "core.quotepath=off"];
const LIMIT = 1000;

export const msg = (text) => [{ kind: "@", text }];

export function makeGit({ exec, readTextFile }) {
  async function load(loc) {
    const top = await exec("git", [...GIT, "rev-parse", "--show-toplevel"], { cwd: loc.cwd, on: loc.on });
    if (top.code !== 0) return { root: null, base: EMPTY_TREE, files: [], error: "Not a git repository" };
    const g = { cwd: top.stdout.trim(), on: loc.on };
    const run = (args) => exec("git", [...GIT, ...args], g);
    const head = await run(["rev-parse", "--verify", "-q", "HEAD"]);
    const base = head.code === 0 ? "HEAD" : EMPTY_TREE;
    const [num, ns, others] = await Promise.all([
      run(["diff", base, "--numstat", "-z", "--no-renames"]),
      run(["diff", base, "--name-status", "-z", "--no-renames"]),
      run(["ls-files", "--others", "--exclude-standard", "-z"]),
    ]);
    const status = parseNameStatus(ns.stdout);
    const files = parseNumstat(num.stdout).map((f) => ({ ...f, status: status[f.path] ?? "M" }));
    const untracked = await Promise.all(others.stdout.split("\0").filter(Boolean).slice(0, LIMIT).map(async (path) => {
      const text = await readTextFile(`${g.cwd}/${path}`, { on: g.on });
      const binary = text?.includes("\0") ?? false;
      const lines = text === null || binary ? 0 : text.split("\n").length - Number(text.endsWith("\n"));
      return { path, add: lines, del: 0, binary, status: "A", untracked: true };
    }));
    return { root: g.cwd, base, files: [...files, ...untracked], error: null };
  }

  async function diffFor(loc, f, base) {
    if (f.binary) return msg("Binary file");
    if (f.untracked) {
      const text = await readTextFile(`${loc.cwd}/${f.path}`, { on: loc.on });
      if (text === null) return msg("Cannot read this file");
      const lines = text.split("\n");
      if (lines.at(-1) === "") lines.pop();
      return parseDiff(`@@ -0,0 +1,${lines.length} @@\n` + lines.map((l) => `+${l}`).join("\n"));
    }
    const r = await exec("git", [...GIT, "diff", base, "--no-color", "--no-ext-diff", "-U3", "--", f.path], { cwd: loc.cwd, on: loc.on });
    if (r.code !== 0) return msg(r.stderr.trim() || "git diff failed");
    return parseDiff(r.stdout);
  }
  return { load, diffFor };
}
