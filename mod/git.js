// git side of the panel: the changed files and one file's diff rows.
// Takes herdr's exec and readTextFile, so tests can hand it fakes (or node's child_process).
import { EMPTY_TREE, parseNumstat, parseNameStatus, parseDiff } from "./parse.js";

// Reads write nothing under .git (no index refresh or lock), so the folder watch stays quiet.
const GIT = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false", "-c", "core.quotepath=off"];
const LIMIT = 1000;
const COMMITS = 4; // how many recent commits the picker lists
const HISTORY = 500; // how many commits the picker's search looks through (shortcut: the newest 500 only)

// One row for the panel to show where a diff would go: a notice such as "Binary file".
export const noticeRows = (text) => [{ kind: "@", text }];

export function makeGit({ exec, readTextFile }) {
  // The file as text, or null when it is not UTF-8 (or can't be read). Some hosts throw instead of returning null.
  async function readText(path, on) {
    try { return await readTextFile(path, { on }); } catch { return null; }
  }

  // git's own check (a NUL in the first 8000 bytes), so the file's text is never read for it. The output is
  // "-\t-\t…" for a binary file: the first field is "-". Not a git repo or an error: treated as text.
  async function isBinaryUntracked(g, path) {
    const r = await exec("git", [...GIT, "--literal-pathspecs", "diff", "--no-index", "--numstat", "--", "/dev/null", path], g);
    return r.code <= 1 && r.stdout.startsWith("-\t");
  }

  // The paths whose text is not UTF-8 on the side the diff shows: the base (`base`) and the commit (`rev`), or,
  // without a rev, the worktree file. One shell call for all of them: iconv reads the bytes on the repo's machine
  // and only the indices of the bad files come back (ASCII), so the text itself never crosses exec.
  // A missing blob (a new file, the empty tree) reads as empty, which is valid. iconv exits 1 only on bad input,
  // so a missing iconv marks nothing.
  const UTF8_SCRIPT = 'b=$1; r=$2; shift 2; i=0; for p in "$@"; do bad=0; ' +
    'git --no-optional-locks show "$b:$p" 2>/dev/null | iconv -f UTF-8 -t UTF-8 >/dev/null 2>&1; [ $? -eq 1 ] && bad=1; ' +
    'if [ -n "$r" ]; then git --no-optional-locks show "$r:$p" 2>/dev/null | iconv -f UTF-8 -t UTF-8 >/dev/null 2>&1; [ $? -eq 1 ] && bad=1; ' +
    'elif [ -f "$p" ]; then iconv -f UTF-8 -t UTF-8 < "$p" >/dev/null 2>&1; [ $? -eq 1 ] && bad=1; fi; ' +
    'if [ $bad -eq 1 ]; then echo $i; fi; i=$((i+1)); done';
  async function notUtf8(g, paths, base, rev = null) {
    if (!paths.length) return new Set();
    const r = await exec("sh", ["-c", UTF8_SCRIPT, "sh", base, rev ?? "", ...paths], g);
    const idx = r.stdout.split("\n").filter(Boolean).map(Number);
    return new Set(idx.map((i) => paths[i]));
  }

  // The last n commits of the branch, newest first: { sha, short, subject }. None in a repo without commits.
  async function recentCommits(g, n) {
    const log = await exec("git", [...GIT, "log", "-n", String(n), "--format=%H%x1f%h%x1f%s"], g);
    return log.code !== 0 ? [] : log.stdout.split("\n").filter(Boolean).map((l) => { const [sha, short, subject] = l.split("\x1f"); return { sha, short, subject }; });
  }

  // rev: a commit to show instead of the worktree; its changes are the diff against its first parent.
  async function load(loc, rev = null) {
    const top = await exec("git", [...GIT, "rev-parse", "--show-toplevel"], { cwd: loc.cwd, on: loc.on });
    if (top.code !== 0) return { root: null, base: EMPTY_TREE, files: [], commits: [], error: "Not a git repository" };
    const g = { cwd: top.stdout.trim(), on: loc.on };
    const run = (args) => exec("git", [...GIT, ...args], g);
    // The last commits of the branch, for the picker (none in a repo without commits).
    const commits = await recentCommits(g, COMMITS);
    if (rev) {
      const parent = await run(["rev-parse", "--verify", "-q", `${rev}^`]);
      const from = parent.code === 0 ? `${rev}^` : EMPTY_TREE;
      const [num, ns, body] = await Promise.all([
        run(["diff", from, rev, "--numstat", "-z", "--no-renames"]),
        run(["diff", from, rev, "--name-status", "-z", "--no-renames"]),
        run(["log", "-1", "--format=%B", rev]), // the whole message, subject and body
      ]);
      const status = parseNameStatus(ns.stdout);
      const listed = parseNumstat(num.stdout).map((f) => ({ ...f, status: status[f.path] ?? "M", unstaged: false }));
      const bad = await notUtf8(g, listed.map((f) => f.path), from, rev);
      const files = listed.map((f) => (bad.has(f.path) ? { ...f, binary: true } : f));
      return { root: g.cwd, base: from, rev, files, commits, message: body.stdout.trim(), error: null };
    }
    const head = await run(["rev-parse", "--verify", "-q", "HEAD"]);
    const base = head.code === 0 ? "HEAD" : EMPTY_TREE;
    const [num, ns, others, unstaged] = await Promise.all([
      run(["diff", base, "--numstat", "-z", "--no-renames"]),
      run(["diff", base, "--name-status", "-z", "--no-renames"]),
      run(["ls-files", "--others", "--exclude-standard", "-z"]),
      // Worktree against the index: the tracked files with changes that are not staged.
      run(["diff", "--name-only", "-z", "--no-renames"]),
    ]);
    const status = parseNameStatus(ns.stdout);
    const dirty = new Set(unstaged.stdout.split("\0").filter(Boolean));
    const listed = parseNumstat(num.stdout).map((f) => ({ ...f, status: status[f.path] ?? "M", unstaged: dirty.has(f.path) }));
    const newPaths = others.stdout.split("\0").filter(Boolean).slice(0, LIMIT);
    // Binary, or not UTF-8 (either side of the diff, or the new file): listed with "binary" and not opened.
    const bad = await notUtf8(g, [...listed.map((f) => f.path), ...newPaths], base);
    const files = listed.map((f) => (bad.has(f.path) ? { ...f, binary: true } : f));
    const untracked = await Promise.all(newPaths.map(async (path) => {
      const binary = bad.has(path) || await isBinaryUntracked(g, path);
      const text = binary ? null : await readText(`${g.cwd}/${path}`, g.on);
      const isText = text !== null && !text.includes("\0");
      const lines = isText ? text.split("\n").length - Number(text.endsWith("\n")) : 0;
      return { path, add: lines, del: 0, binary: !isText, status: "A", untracked: true, unstaged: true };
    }));
    return { root: g.cwd, base, rev: null, files: [...files, ...untracked], commits, error: null };
  }

  async function diffFor(loc, f, base, rev = null) {
    if (f.binary) return noticeRows("Binary file");
    if (f.untracked) {
      const text = await readText(`${loc.cwd}/${f.path}`, loc.on);
      if (text === null) return noticeRows("Cannot read this file");
      const lines = text.split("\n");
      if (lines.at(-1) === "") lines.pop();
      return parseDiff(`@@ -0,0 +1,${lines.length} @@\n` + lines.map((l) => `+${l}`).join("\n"));
    }
    const r = await exec("git", [...GIT, "diff", base, ...(rev ? [rev] : []), "--no-color", "--no-ext-diff", "-U3", "--", f.path], { cwd: loc.cwd, on: loc.on });
    if (r.code !== 0) return noticeRows(r.stderr.trim() || "git diff failed");
    return parseDiff(r.stdout);
  }

  // Throws with git's message when it fails. Only the unstaged part goes: a tracked file goes back
  // to its staged version (checkout from the index), so staged changes stay. An untracked file is
  // deleted (git clean). --literal-pathspecs: a name with * or [ matches only itself.
  async function discard(loc, f) {
    const args = f.untracked ? ["clean", "-f", "--", f.path] : ["checkout", "--", f.path];
    const r = await exec("git", [...GIT, "--literal-pathspecs", ...args], { cwd: loc.cwd, on: loc.on });
    if (r.code !== 0) throw new Error(r.stderr.trim() || "git failed");
  }
  // The branch's recent commits, for the picker's search (loc: the repo's folder, as load's).
  async function history(loc) {
    return recentCommits({ cwd: loc.cwd, on: loc.on }, HISTORY);
  }

  return { load, diffFor, discard, history };
}
