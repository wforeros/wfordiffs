// Changes panel: the changed files, each one opens inline into its diff
// (line numbers, +/- tints, syntax colors). Read-only: no commits, no branches.
// Runs git (and bat, for colors) where the shown space lives: WSL for the "wsl" machine.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, Scrollbar } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, nextCommand, theme, settings, shared, openOverlay, props, hc, run } from "herdr";
import { selectedRows, reference } from "./ask.js";
import { ADD_W, NUM_W, SIGN_W, CHAR_W, GUTTER_W } from "./metrics.js";
import { EMPTY_TREE } from "./parse.js";
import { langOf, tokens } from "./lexer.js";
import { makeGit, msg } from "./git.js";
import { markWords, splitMarks } from "./inline.js";
import { parseConfig, tint, DEFAULTS, CFG_KEY } from "./config.js";
import { settingsView } from "./settings-view.js";
import { hscroll } from "./hscroll.js";
import { makeHighlighter, attachColors } from "./highlight.js";

const { load, diffFor } = makeGit({ exec, readTextFile });
const { highlight } = makeHighlighter({ exec, settings });

// The status of a file -> its icon (mod/icons/custom). Untracked files count as new.
const ICONS = { M: "modified_file", A: "new_file", D: "deleted_file" };

// The core starts terminals with a minimal PATH (no linuxbrew), so nvim is looked for in the usual spots.
const FIND_NVIM = 'for n in nvim /home/linuxbrew/.linuxbrew/bin/nvim /usr/local/bin/nvim "$HOME/.local/bin/nvim" /usr/bin/nvim /opt/nvim/bin/nvim; do command -v "$n" >/dev/null 2>&1 && exec "$n" "$@"; done; echo "nvim not found: install it, or put it on the PATH the app starts terminals with"; sleep 8';

const POLL_MS = 5000;
// shortcut: expand-all opens at most this many files, each one is a git diff call; raise it if you need more.
const EXPAND_MAX = 50;

function location() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on };
}

export default class GitDiff extends View {
  init(_props, cx) {
    this.files = []; this.open = new Set(); this.diffs = {};
    this.cfg = { ...DEFAULTS }; this.k = 1; // tint colors and strengths, from shared(); set in the gear window
    if (props()?.settings) return; // the gear window: it only draws the settings
    this.wrap = false; // off: one row per line and a horizontal bar; on: long lines break
    this.offsets = {}; // per file id: sideways offset in pixels
    this.drag = null;  // { id, startX, startOff } while dragging a bar
    this.viewport = 0; // the panel's width, to size each file's bar
    this.base = EMPTY_TREE; this.root = null; this.loc = null; this.fp = ""; this.error = null; this.loading = true; this.busy = false;
    // Selecting lines to reference: sel = { path, from, to } (row indexes of that file's diff).
    this.sel = null; this.hover = null; this.dragging = false; this.flash = ""; // a short message in the header
    this.refresh(cx);
    cx.timer.every(POLL_MS, (cx) => this.refresh(cx));
    // Key commands from keys.json ("herdr-gitdiff.<command>"); they reach this copy only while it's shown.
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
          this.fp = fp; this.files = next.files; this.diffs = {}; this.sel = null; // the rows it pointed at are gone
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
        markWords(rows);
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

  // A short message in the header, gone after a few seconds.
  say(text, cx) {
    this.flash = text; cx.notify();
    cx.timer.after(2500, (cx) => { if (this.flash === text) { this.flash = ""; cx.notify(); } });
  }

  // nvim on the file, in a big dialog over the panel; it closes itself when nvim exits,
  // and the Changes view is right there. The terminal is started apart from any pane.
  async openNvim(path, cx) {
    const loc = this.loc;
    if (!loc) return;
    try {
      const r = await hc(["run", "--json", "--bg", "--no-parent", "--rm", "--cwd", loc.cwd, ...(loc.on ? ["--on", loc.on] : []), "--", "sh", "-c", FIND_NVIM, "sh", path]);
      if (r.code !== 0) throw new Error(r.stderr.trim() || "hc run failed");
      const address = JSON.parse(r.stdout).address;
      openOverlay({ kind: "dialog", modal: true, width: 0.94, height: 0.9, layout: { type: "column", children: [{ type: "block", content: { terminal: address } }] } });
      try { run("pane.focus", { terminal: address }); } catch { /* the click focuses it */ }
    } catch (e) { this.say(`Could not open nvim: ${e?.message ?? e}`, cx); }
  }

  // The reference of the selected lines, "<full path>#L1-L3", copied for pasting in the chat.
  copySelection(cx) {
    const s = this.sel, rows = s && this.diffs[s.path];
    const picked = rows ? selectedRows(rows, s.from, s.to) : [];
    if (!picked.length) return;
    const ref = reference(`${this.root}/${s.path}`, picked);
    cx.write_to_clipboard(ref);
    this.say(`Copied ${ref}`, cx);
  }

  px(n) { return Math.round(n * this.k); }

  // Full width, so the counts stay at the right edge whatever a diff below does.
  fileRow(f, t) {
    const open = this.open.has(f.path), parts = f.path.split("/"), name = parts.pop();
    const added = this.cfg.added ?? t.ansi2, removed = this.cfg.removed ?? t.ansi1;
    const icon = ICONS[f.status] ?? ICONS.M;
    const color = f.status === "A" ? added : f.status === "D" ? removed : this.cfg.modified ?? t.blocked;
    return h_flex().id(`f-${f.path}`).w_full().h(this.px(28)).px(10).gap(8).items_center().cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.toggle(f.path, cx))
      .child(svg(`mods/herdr-gitdiff/icons/chevron-${open ? "down" : "right"}.svg`).size(12).flex_none().text_color(t.dim))
      .child(svg(`mods/herdr-gitdiff/icons/custom/${icon}.svg`).size(14).flex_none().text_color(color).tooltip(icon.replace("_", " ")))
      .child(h_flex().flex_1().min_w(0).child(div().text_color(t.dim).truncate().child(parts.length ? parts.join("/") + "/" : "")).child(div().max_w(260).min_w(0).truncate().child(name)))
      .when(f.status !== "D", (e) => e.child(div().id(`nvim-${f.path}`).w(this.px(20)).h(this.px(20)).flex_none().rounded(4).flex().items_center().justify_center()
        .cursor_pointer().hover((x) => x.bg(t.hover)).tooltip("Open in nvim")
        .on_click((_e, cx) => { cx.stop_propagation(); this.openNvim(f.path, cx); })
        .child(svg("mods/herdr-gitdiff/icons/nvim.svg").size(this.px(13)).text_color(t.muted))))
      .child(f.binary ? div().flex_none().text_size(this.px(11)).text_color(t.dim).child("binary")
        // Close together, like the totals in the header.
        : h_flex().flex_none().gap(6).child(div().text_size(this.px(11)).text_color(added).child(`+${f.add}`)).child(div().text_size(this.px(11)).text_color(removed).child(`−${f.del}`)));
  }

  codeRow(row, path, t, width, i) {
    if (row.kind === "@") return div().h(this.px(22)).w_full().px(10).flex().items_center().bg(t.raised).text_color(t.dim).truncate().child(row.text);
    const base = row.kind === "+" ? this.cfg.added ?? t.ansi2 : row.kind === "-" ? this.cfg.removed ?? t.ansi1 : null;
    const lineBg = base ? tint(base, this.cfg.line) : null, wordBg = base ? tint(base, this.cfg.word) : null;
    const mark = base ?? t.dim;
    const key = `${path}#${i}`;
    const s = this.sel, picked = s?.path === path && i >= Math.min(s.from, s.to) && i <= Math.max(s.from, s.to);
    const plus = div().id(`add-${key}`).w(this.px(ADD_W)).flex_none().flex().items_center().justify_center().cursor_pointer()
      .text_color(t.accent ?? t.muted).font_semibold().tooltip(picked ? "Clear the selection" : "Select this line (drag for several) and copy its reference")
      .on_mouse_down("left", (_e, cx) => {
        // A press on a selected line clears the selection; otherwise it starts one (drag to extend).
        if (picked) { this.sel = null; this.dragging = false; this.flash = ""; }
        else { this.sel = { path, from: i, to: i }; this.dragging = true; }
        cx.stop_propagation(); cx.notify();
      })
      .child(picked || this.hover === key ? "+" : "");
    const colors = { dim: t.dim, ansi1: t.ansi1, ansi2: t.ansi2, ansi4: t.ansi4, ansi5: t.ansi5 };
    const pieces = row.pieces ?? tokens(row.text, langOf(path), colors);
    // The words that changed inside the line get a stronger tint of their own.
    const code = h_flex().children(splitMarks(pieces, row.marks).map(([s, c, hit]) => div().text_color(c ?? t.foreground)
      .when(hit, (e) => e.bg(wordBg).rounded(2)).when(this.wrap, (e) => e.whitespace_normal()).child(s)));
    // Wrap: the row grows taller and the tokens break at their own gaps. Otherwise it keeps
    // the widest row's width, and the list scrolls sideways.
    const body = this.wrap ? code.flex_1().min_w(0).flex_wrap().whitespace_normal() : code.flex_none();
    // Wrapped rows line up on their first line: the numbers sit at the top, not centred
    // against the whole wrapped block.
    return h_flex().id(`row-${key}`).w_full().when(!this.wrap && width > 0, (e) => e.min_w(width)).bg(picked ? t.selected : lineBg ?? t.background)
      .on_hover((hovered, cx) => {
        if (hovered) {
          this.hover = key;
          if (this.dragging && this.sel?.path === path) this.sel = { ...this.sel, to: i }; // dragging over rows extends the selection
        } else if (this.hover === key) this.hover = null;
        cx.notify();
      })
      .when(this.wrap, (e) => e.min_h(this.px(20)).py(1).items_start()).when(!this.wrap, (e) => e.h(this.px(20)).items_center())
      // shortcut: the gutter fits three digits; a four-digit line number in a big file is clipped.
      .child(plus)
      .child(div().w(this.px(NUM_W)).flex_none().text_right().pr(4).text_color(t.dim).child(row.o ?? ""))
      .child(div().w(this.px(NUM_W)).flex_none().text_right().pr(4).text_color(t.dim).child(row.n ?? ""))
      .child(div().w(this.px(SIGN_W)).flex_none().text_color(mark).child(row.kind === " " ? "" : row.kind))
      .child(body);
  }

  // One entry per file: its row, then — when open — the rows of its diff, in a box of
  // their own so that file, and only that file, scrolls sideways.
  groups() {
    return this.files.map((f, i) => {
      if (!this.open.has(f.path)) return { file: f };
      const body = this.diffs[f.path];
      if (!body) return { file: f, body: [{ kind: "@", text: "Loading…" }], width: 0, id: `gv-${i}` };
      // What the widest row needs: the gutters, then the text.
      const width = Math.max(...body.map((r) => r.text.length * CHAR_W * this.k + GUTTER_W * this.k), 0);
      return { file: f, body, width, id: `gv-${i}` };
    });
  }

  render(cx) {
    const t = theme();
    this.cfg = parseConfig(shared(CFG_KEY));
    this.k = this.cfg.font / DEFAULTS.font; // every size below was designed at 12px
    if (props()?.settings) return settingsView(t, this.cfg);
    const add = this.files.reduce((n, f) => n + f.add, 0), del = this.files.reduce((n, f) => n + f.del, 0);
    const groups = this.groups();
    const empty = this.error || (this.loading ? "Loading changes…" : this.root ? "No changes" : "No folder");
    return v_flex().id("herdr-gitdiff").size_full().on_mouse_up("left", (_e, cx) => {
        // Releasing ends the selection and copies its reference.
        if (!this.dragging) return;
        this.dragging = false; this.copySelection(cx); cx.notify();
      }).on_size_change((size, cx) => { if (size.width !== this.viewport) { this.viewport = size.width; cx.notify(); } }).min_h(0).bg(t.background).text_color(t.foreground).text_size(this.cfg.font).font_family(settings().font_family ?? "JetBrains Mono")
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("Changes"))
        .child(div().px(5).py(1).rounded(4).border_1().border_color(t.border).text_size(10).text_color(t.muted).child(`${this.files.length} files`))
        .when(!!this.flash, (e) => e.child(div().min_w(0).truncate().text_size(10).text_color(this.cfg.added ?? t.ansi2).child(this.flash)))
        .child(div().flex_1())
        .child(div().id("herdr-gitdiff-config").w(22).h(22).rounded(4).flex().items_center().justify_center().cursor_pointer().hover((s) => s.bg(t.hover))
          .tooltip("Diff colors")
          .on_click(() => openOverlay({ mod: "herdr-gitdiff", kind: "window", key: "gitdiff-settings", width: 300, height: 510, props: { settings: true } }))
          .child(svg("mods/herdr-gitdiff/icons/settings.svg").size(14).text_color(t.muted)))
        .child(div().id("herdr-gitdiff-wrap").px(6).py(1).rounded(4).text_size(10).cursor_pointer().hover((s) => s.bg(t.hover))
          .when(this.wrap, (e) => e.bg(t.selected).text_color(t.foreground)).when(!this.wrap, (e) => e.text_color(t.muted))
          .on_click((_e, cx) => { this.wrap = !this.wrap; cx.notify(); }).child("wrap"))
        .child(div().text_size(this.px(11)).text_color(this.cfg.added ?? t.ansi2).child(`+${add}`))
        .child(div().text_size(this.px(11)).text_color(this.cfg.removed ?? t.ansi1).child(`−${del}`)))
      .child(div().flex_1().min_h(0).relative()
        .when(!this.files.length, (e) => e.child(div().p(12).text_color(t.dim).child(empty)))
        .when(this.files.length > 0, (e) => e
          // The list scrolls down only: the file rows keep their place (and their counts)
          // while any one diff scrolls sideways on its own.
          // shortcut: one overflow area plus one Scrollbar per axis; the single
          // overflow_scrollbar() call leaves this panel stuck on "could not be re-rendered".
          .child(v_flex().id("herdr-gitdiff-list").absolute().inset_0().overflow_y_scroll()
            .child(v_flex().w_full().children(groups.flatMap((g) => (g.body ? [this.fileRow(g.file, t), hscroll(this, g, t)] : [this.fileRow(g.file, t)])))))
          .child(Scrollbar.vertical("herdr-gitdiff-list").mode("always").absolute().inset_0())));
  }
}
