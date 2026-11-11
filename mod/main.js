// Changes panel: the changed files, each one opens inline into its diff
// (line numbers, +/- tints, syntax colors). Read-only: no commits, no branches.
// Runs git (and bat, for colors) where the shown space lives: WSL for the "wsl" machine.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, Scrollbar } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, nextCommand, theme, settings } from "herdr";
import { EMPTY_TREE, parseNumstat, parseNameStatus, parseDiff, parseAnsi, langOf, tokens } from "./lib.js";

// Reads write nothing under .git (no index refresh or lock), so the folder watch stays quiet.
const GIT = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false", "-c", "core.quotepath=off"];
const LIMIT = 1000;
const POLL_MS = 5000;
// shortcut: expand-all opens at most this many files, each one is a git diff call; raise it if you need more.
const EXPAND_MAX = 50;
// The core on wsl starts with a minimal PATH (no linuxbrew), so the usual spots are tried in turn.
// shortcut: bat is the only colorer; without it the built-in lexer (js, py, sh) is used.
const BAT = ["bat", "batcat", "/home/linuxbrew/.linuxbrew/bin/bat", "/usr/bin/bat", "/usr/bin/batcat"];

function location() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on };
}
const msg = (text) => [{ kind: "@", text }];

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

// bat's path on this machine, looked up once per machine ("" when there's none).
// Cache the promise, not the answer: several diffs ask at once.
const batCache = {};
function batFor(on) {
  const key = on ?? "";
  return (batCache[key] ??= (async () => {
    for (const bin of BAT) {
      try {
        const r = await exec(bin, ["--version"], { on });
        if (r.code === 0) return bin;
      } catch { /* not on this PATH */ }
    }
    return "";
  })());
}

// Colored lines of the new file and of the HEAD file, as bat sees them whole (multi-line strings and comments right).
async function highlight(loc, f, base) {
  const bat = await batFor(loc.on);
  if (!bat) return null;
  const theme = settings().dark === false ? "Catppuccin Latte" : "Catppuccin Mocha";
  const out = {};
  // COLORTERM: without it bat paints 256-colour codes, not the theme's exact colors.
  if (f.status !== "D") {
    const r = await exec("sh", ["-c", 'COLORTERM=truecolor exec "$@"', "sh", bat, "--color=always", "-pp", "--tabs=4", "--wrap=never", "--theme", theme, "--", f.path], { cwd: loc.cwd, on: loc.on });
    if (r.code === 0) out.new = parseAnsi(r.stdout);
  }
  if (!f.untracked && f.status !== "A" && base !== EMPTY_TREE) {
    const r = await exec("sh", ["-c", 'git --no-optional-locks show "$1" | COLORTERM=truecolor "$2" --color=always -pp --tabs=4 --wrap=never --theme "$3" --file-name "$4"', "sh", `HEAD:${f.path}`, bat, theme, f.path], { cwd: loc.cwd, on: loc.on });
    if (r.code === 0) out.old = parseAnsi(r.stdout);
  }
  return out;
}

// Puts bat's colors on each row, and only when bat's text is the row's text (else the lexer draws it).
function attachColors(rows, hl) {
  if (!hl) return;
  for (const r of rows) {
    if (r.kind === "@") continue;
    const side = r.kind === "-" ? hl.old : hl.new, line = r.kind === "-" ? r.o : r.n;
    const pieces = side?.[line - 1];
    if (pieces && pieces.map((p) => p[0]).join("") === r.text) r.pieces = pieces;
  }
}

export default class GitDiff extends View {
  init(_props, cx) {
    this.files = []; this.open = new Set(); this.diffs = {};
    this.base = EMPTY_TREE; this.root = null; this.loc = null; this.fp = ""; this.error = null; this.loading = true; this.busy = false;
    this.refresh(cx);
    cx.timer.every(POLL_MS, (cx) => this.refresh(cx));
    // Key commands from keys.json ("gitdiff.<command>"); they reach this copy only while it's shown.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "refresh") this.refresh(cx);
        else if (c === "collapse-all") this.open.clear();
        else if (c === "expand-all") {
          for (const f of this.files.slice(0, EXPAND_MAX)) this.open.add(f.path);
          for (const p of this.open) this.ensure(p, cx);
        }
        cx.notify();
      }
    });
  }

  refresh(cx) {
    if (this.busy) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        const loc = location();
        const next = await load(loc);
        this.error = next.error;
        this.root = next.root; this.base = next.base;
        this.loc = next.root ? { cwd: next.root, on: loc.on } : null;
        const fp = JSON.stringify(next.files.map((f) => [f.path, f.add, f.del, f.status]));
        if (fp !== this.fp) {
          this.fp = fp; this.files = next.files; this.diffs = {};
          for (const p of [...this.open]) if (!next.files.some((f) => f.path === p)) this.open.delete(p);
          for (const p of this.open) this.ensure(p, cx);
        }
      } catch (e) {
        this.error = String(e?.message ?? e);
      } finally {
        this.busy = false; this.loading = false; cx.notify();
      }
    });
  }

  // Loads one file's diff once per refresh; a result from an older refresh is dropped.
  ensure(path, cx) {
    const f = this.files.find((x) => x.path === path);
    if (!f || !this.loc || this.diffs[path]) return;
    const fp = this.fp, loc = this.loc, base = this.base;
    cx.spawn(async (cx) => {
      let rows;
      try {
        rows = await diffFor(loc, f, base);
        attachColors(rows, await highlight(loc, f, base).catch(() => null));
      } catch (e) { rows = msg(`Cannot load diff: ${e?.message ?? e}`); }
      if (fp === this.fp) this.diffs[path] = rows;
      cx.notify();
    });
  }

  toggle(path, cx) {
    if (this.open.has(path)) this.open.delete(path);
    else { this.open.add(path); this.ensure(path, cx); }
    cx.notify();
  }

  // Full width, so the counts stay at the right edge; only code rows scroll sideways.
  fileRow(f, t) {
    const open = this.open.has(f.path), parts = f.path.split("/"), name = parts.pop();
    const color = f.status === "A" ? t.ansi2 : f.status === "D" || f.status === "U" ? t.ansi1 : t.blocked;
    return h_flex().id(`f-${f.path}`).w_full().h(28).px(10).gap(8).items_center().cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.toggle(f.path, cx))
      .child(div().w(10).text_size(10).text_color(t.dim).child(open ? "▾" : "▸"))
      .child(div().w(14).text_size(11).text_color(color).child(f.status))
      .child(h_flex().flex_1().min_w(0).child(div().text_color(t.dim).truncate().child(parts.length ? parts.join("/") + "/" : "")).child(div().max_w(260).min_w(0).truncate().child(name)))
      .child(f.binary ? div().w(112).flex_none().text_right().text_size(11).text_color(t.dim).child("binary")
        : h_flex().flex_none().gap(6).justify_end().child(div().w(50).text_right().text_size(11).text_color(t.ansi2).child(`+${f.add}`)).child(div().w(50).text_right().text_size(11).text_color(t.ansi1).child(`−${f.del}`)));
  }

  codeRow(row, path, t, width) {
    if (row.kind === "@") return div().h(22).w_full().px(10).flex().items_center().bg(t.raised).text_color(t.dim).truncate().child(row.text);
    const tint = row.kind === "+" ? `${t.ansi2}18` : row.kind === "-" ? `${t.ansi1}18` : null;
    const mark = row.kind === "+" ? t.ansi2 : row.kind === "-" ? t.ansi1 : t.dim;
    const colors = { dim: t.dim, ansi1: t.ansi1, ansi2: t.ansi2, ansi4: t.ansi4, ansi5: t.ansi5 };
    const pieces = row.pieces ?? tokens(row.text, langOf(path), colors);
    return h_flex().h(20).w_full().min_w(width).items_center().bg(tint ?? t.background)
      .child(div().w(44).flex_none().text_right().pr(8).text_color(t.dim).child(row.o ?? ""))
      .child(div().w(44).flex_none().text_right().pr(8).text_color(t.dim).child(row.n ?? ""))
      .child(div().w(14).flex_none().text_color(mark).child(row.kind === " " ? "" : row.kind))
      .child(h_flex().flex_none().children(pieces.map(([s, c]) => div().text_color(c ?? t.foreground).child(s))));
  }

  // One flat list: file rows, then the rows of each open file.
  rows() {
    const out = [];
    for (const f of this.files) {
      out.push({ key: `f:${f.path}`, file: f });
      if (!this.open.has(f.path)) continue;
      const body = this.diffs[f.path];
      if (!body) out.push({ key: `m:${f.path}`, text: "Loading…" });
      else body.forEach((row, i) => out.push({ key: `l:${f.path}:${i}`, row, path: f.path }));
    }
    return out;
  }

  render(cx) {
    const t = theme();
    const add = this.files.reduce((n, f) => n + f.add, 0), del = this.files.reduce((n, f) => n + f.del, 0);
    const rows = this.rows();
    const width = Math.max(320, ...rows.map((r) => (r.row?.text?.length ?? 0) * 8 + 100));
    const empty = this.error || (this.loading ? "Loading changes…" : this.root ? "No changes" : "No folder");
    return v_flex().id("gitdiff").size_full().min_h(0).bg(t.background).text_color(t.foreground).text_size(12).font_family(settings().font_family ?? "JetBrains Mono")
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("Changes"))
        .child(div().px(5).py(1).rounded(4).border_1().border_color(t.border).text_size(10).text_color(t.muted).child(`${this.files.length} files`))
        .child(div().flex_1())
        .child(div().text_size(11).text_color(t.ansi2).child(`+${add}`))
        .child(div().text_size(11).text_color(t.ansi1).child(`−${del}`)))
      .child(div().flex_1().min_h(0).relative()
        .when(!this.files.length, (e) => e.child(div().p(12).text_color(t.dim).child(empty)))
        .when(this.files.length > 0, (e) => e
          .child(v_flex().id("gitdiff-list").absolute().inset_0().overflow_scroll()
            .child(v_flex().w_full().children(rows.map((r) => r.file ? this.fileRow(r.file, t) : r.row ? this.codeRow(r.row, r.path, t, width) : div().h(22).px(10).flex().items_center().text_color(t.dim).child(r.text)))))
          .child(Scrollbar.vertical("gitdiff-list").absolute().inset_0())));
  }
}
