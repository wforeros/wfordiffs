// Changes panel: the changed files, each one opens inline into its diff
// (line numbers, +/- tints, syntax colors). Read-only: no commits, no branches.
// Runs git where the shown space lives (WSL for the "wsl" machine).
import { View, div } from "gpui-kit";
import { v_flex, h_flex, Scrollbar } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, theme, settings } from "herdr";
import { EMPTY_TREE, parseNumstat, parseNameStatus, parseDiff, langOf, tokens } from "./lib.js";

// Reads write nothing under .git (no index refresh or lock), so the folder watch stays quiet.
const GIT = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false", "-c", "core.quotepath=off"];
const LIMIT = 1000;
const POLL_MS = 5000;

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

export default class GitDiff extends View {
  init(_props, cx) {
    this.files = []; this.open = new Set(); this.diffs = {};
    this.base = EMPTY_TREE; this.root = null; this.loc = null; this.fp = ""; this.error = null; this.loading = true; this.busy = false;
    this.refresh(cx);
    cx.timer.every(POLL_MS, (cx) => this.refresh(cx));
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
      try { rows = await diffFor(loc, f, base); }
      catch (e) { rows = msg(`Cannot load diff: ${e?.message ?? e}`); }
      if (fp === this.fp) this.diffs[path] = rows;
      cx.notify();
    });
  }

  toggle(path, cx) {
    if (this.open.has(path)) this.open.delete(path);
    else { this.open.add(path); this.ensure(path, cx); }
    cx.notify();
  }

  fileRow(f, t) {
    const open = this.open.has(f.path), parts = f.path.split("/"), name = parts.pop();
    const color = f.status === "A" ? t.ansi2 : f.status === "D" || f.status === "U" ? t.ansi1 : t.blocked;
    return h_flex().id(`f-${f.path}`).h(28).px(10).gap(8).items_center().cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.toggle(f.path, cx))
      .child(div().w(10).text_size(10).text_color(t.dim).child(open ? "▾" : "▸"))
      .child(div().w(14).text_size(11).text_color(color).child(f.status))
      .child(h_flex().flex_1().min_w(0).child(div().text_color(t.dim).truncate().child(parts.length ? parts.join("/") + "/" : "")).child(div().max_w(260).min_w(0).truncate().child(name)))
      .child(f.binary ? div().w(112).flex_none().text_right().text_size(11).text_color(t.dim).child("binary")
        : h_flex().flex_none().gap(6).justify_end().child(div().w(50).text_right().text_size(11).text_color(t.ansi2).child(`+${f.add}`)).child(div().w(50).text_right().text_size(11).text_color(t.ansi1).child(`−${f.del}`)));
  }

  codeRow(row, path, t) {
    if (row.kind === "@") return div().h(22).w_full().px(10).flex().items_center().bg(t.raised).text_color(t.dim).truncate().child(row.text);
    const tint = row.kind === "+" ? `${t.ansi2}18` : row.kind === "-" ? `${t.ansi1}18` : null;
    const mark = row.kind === "+" ? t.ansi2 : row.kind === "-" ? t.ansi1 : t.dim;
    const colors = { dim: t.dim, ansi1: t.ansi1, ansi2: t.ansi2, ansi4: t.ansi4, ansi5: t.ansi5 };
    return h_flex().h(20).w_full().items_center().bg(tint ?? t.background)
      .child(div().w(44).flex_none().text_right().pr(8).text_color(t.dim).child(row.o ?? ""))
      .child(div().w(44).flex_none().text_right().pr(8).text_color(t.dim).child(row.n ?? ""))
      .child(div().w(14).flex_none().text_color(mark).child(row.kind === " " ? "" : row.kind))
      .child(h_flex().flex_none().children(tokens(row.text, langOf(path), colors).map(([s, c]) => div().text_color(c ?? t.foreground).child(s))));
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
            .child(v_flex().min_w(width).children(rows.map((r) => r.file ? this.fileRow(r.file, t) : r.row ? this.codeRow(r.row, r.path, t) : div().h(22).px(10).flex().items_center().text_color(t.dim).child(r.text)))))
          .child(Scrollbar.vertical("gitdiff-list").absolute().inset_0())));
  }
}
