// Changes panel: the changed files, each one opens inline into its diff
// (line numbers, +/- tints, syntax colors). It discards unstaged changes (after a confirm); no commits, no branches.
// Runs git (and bat, for colors) where the shown space lives: WSL for the "wsl" machine.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, Scrollbar, ScrollHandle, InputState } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, nextCommand, theme, settings, shared, setShared, openOverlay, closeOverlay, notify, props, hc, run, terminals } from "herdr";
import { selectedRows, reference } from "./ask.js";
import { CHAR_W, GUTTER_W, FILE_H, LINE_H, HUNK_H } from "./metrics.js";
import { topFile } from "./top-file.js";
import { makeGit, noticeRows } from "./git.js";
import { markWords } from "./inline.js";
import { pairSides } from "./sides.js";
import { parseConfig, DEFAULTS, CFG_KEY, VIEW_KEY, parseView } from "./config.js";
import { isPicked, pressRow, extendTo } from "./line-selection.js";
import { draggedShare } from "./split-drag.js";
import { messageBox, commitMenu } from "./ui/ui-commit-menu.js";
import { initialState, commitSwitchState } from "./view-state.js";
import { shortRev } from "./commit-message.js";
import { filterCommits } from "./commit-search.js";
import { numberBlocks } from "./parse.js";
import { header as drawHeader } from "./ui/ui-header.js";
import { resizeNotice } from "./ui/ui-resize-notice.js";
import { scrollChip } from "./ui/ui-scroll-chip.js";
import { errorBar } from "./ui/ui-error-bar.js";
import { codeRow as drawCodeRow, splitRow as drawSplitRow, hatching, blockAction } from "./ui/ui-diff-row.js";
import { dirRow as drawDirRow, fileRow as drawFileRow } from "./ui/ui-file-row.js";
import { settingsView } from "./settings/settings-view.js";
import { settingsRows, moveCursor } from "./settings/settings-model.js";
import { discardView } from "./discard-view.js";
import { confirmView } from "./confirm-view.js";
import { hscroll } from "./hscroll.js";
import { makeHighlighter, attachColors } from "./highlight.js";
import { treeRows } from "./tree.js";
import { makeNvim, FIND_NVIM } from "./nvim.js";
import { makeLazygit, FIND_LAZYGIT } from "./lazygit.js";
import { makeToolWindow } from "./utils/tool-window.js";

const { load, diffFor, discard, history, branches } = makeGit({ exec, readTextFile });
const { highlight } = makeHighlighter({ exec, settings });
const { hasNvim } = makeNvim({ exec });
const { hasLazygit } = makeLazygit({ exec });
const LAZYGIT = { id: "lazygit", script: FIND_LAZYGIT };


// A binary (or non-UTF-8) file is listed but not opened: no diff, no nvim. // shortcut: its trash stays, so it can still be discarded.
const openable = (f) => !f.binary;

const POLL_MS = 5000;
// The tree column's share of the body when the tree is on, kept between these by the divider.
const SPLIT_MIN = 0.2, SPLIT_MAX = 0.8;
// shortcut: expand-all opens at most this many files, each one is a git diff call; raise it if you need more.
const EXPAND_MAX = 50;

function activeLocation() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on };
}

export default class GitDiff extends View {
  init(_props, cx) {
    Object.assign(this, initialState()); // view-state.js: every field and what it is for
    if (props()?.settings) { // the gear window: it draws the settings, and takes the keys to move over them
      this.handle = cx.focus_handle();
      this.settingsAt = { row: 0, col: 0 };
      this.handle.focus();
      return;
    }
    if (props()?.discard) return; // the confirm dialog of a discard
    if (props()?.reset) { // the confirm dialog of the settings' reset: it takes Enter and Esc
      this.handle = cx.focus_handle();
      this.handle.focus();
      return;
    }
    // Keys (see onKey()): the panel takes the keyboard on a click.
    this.handle = cx.focus_handle();
    this.listScroll = ScrollHandle.new();
    // nvim and lazygit run in a terminal of their own, shown over the body or in a dialog (tool-window.js).
    this.tools = makeToolWindow({ hc, run, openOverlay, closeOverlay, terminals });
    // The commits list's search field: it filters the branch's commits; enter shows the first match.
    this.searchInput = InputState.new({ placeholder: "Search commits…" });
    this.searchInput.on("change", (_e, cx) => { this.query = this.searchInput.value(); cx.notify(); });
    this.searchInput.on("submit", (_e, cx) => { const first = this.shownCommits()[0]; if (first) this.selectCommit(first.sha, cx); });
    // The full-screen copy takes the keyboard as it opens, so the vim keys work at once.
    if (props()?.full) this.handle.focus();
    this.refresh(cx);
    cx.timer.every(POLL_MS, (cx) => this.refresh(cx));
    this.listenForCommands(cx);
  }

  // Key commands from keys.json ("wfordiffs.<command>"); they reach this copy only while it's shown.
  listenForCommands(cx) {
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        if (command === "refresh") this.refresh(cx);
        // The dialog's own copy ignores it: it is already full screen.
        else if (command === "fullscreen") { if (!props()?.full) this.openFull(); }
        // lazygit in the big dialog over the window (what the button did before it moved into the panel). The
        // dialog's own copy ignores it, as it does "fullscreen". One lazygit at a time: the panel's steps aside.
        else if (command === "lazygit-fullscreen") { if (!props()?.full) this.openLazygit(cx, { pane: false }); }
        // lazygit over the panel's body, as the header's button opens it (the menu's Lazygit > Pane). Not the dialog's copy.
        else if (command === "lazygit-pane") { if (!props()?.full && !this.tools.isUp("lazygit")) this.openLazygit(cx, { pane: true }); }
        // pane.go (ctrl-a then h/j/k/l, or the keys) gives the panel the keyboard: it takes it on its own handle.
        else if (command === "focus") this.handle.focus();
        else if (command === "collapse-all") this.collapseAll(cx);
        else if (command === "expand-all") this.expandAll(cx);
        cx.notify();
      }
    });
  }

  refresh(cx) {
    if (this.busy) return;
    this.busy = true;
    const asked = this.rev, askedBranch = this.branch, stale = () => asked !== this.rev || askedBranch !== this.branch;
    cx.spawn(async (cx) => {
      try {
        const loc = activeLocation();
        const rev = asked;
        const next = await load(loc, rev, askedBranch);
        if (stale()) return; // another commit was picked meanwhile: the finally below loads it
        this.commits = next.commits ?? []; this.message = next.message ?? ""; this.head = next.branch ?? "";
        this.error = next.error;
        this.root = next.root; this.base = next.base;
        this.loc = next.root ? { cwd: next.root, on: loc.on } : null;
        this.nvim = this.loc ? await hasNvim(this.loc) : false;
        this.lazygit = this.loc ? await hasLazygit(this.loc) : false;
        const fp = JSON.stringify([rev, askedBranch, ...next.files.map((f) => [f.path, f.add, f.del, f.status, f.binary])]);
        if (fp !== this.fp) {
          this.fp = fp; this.files = next.files; this.diffs = {}; this.sel = null; this.block = null; // the rows it pointed at are gone
          for (const p of [...this.open]) if (!next.files.some((f) => f.path === p && openable(f))) this.open.delete(p);
          for (const p of this.open) this.loadDiff(p, cx);
        }
      } catch (e) {
        this.error = String(e?.message ?? e);
      } finally {
        this.busy = false; this.loading = false; cx.notify();
        if (stale()) this.refresh(cx);
      }
    });
  }

  // Shows the changes of a commit (null: the uncommitted ones) in both the list and the tree.
  selectCommit(rev, cx) { this.select(rev, null, cx); }

  // Compares HEAD with a branch: what the current branch adds to it.
  selectBranch(name, cx) { this.select("HEAD", name, cx); }

  select(rev, branch, cx) {
    this.menu = false; this.sub = null;
    if (rev !== this.rev || branch !== this.branch) {
      this.rev = rev; this.branch = branch;
      Object.assign(this, commitSwitchState());
      this.refresh(cx);
    }
    cx.notify();
  }

  // The picker opens with the search empty; the branches and the branch's commits are read for its lists.
  openPicker(cx) {
    this.menu = true; this.sub = null; this.query = "";
    this.searchInput.set_value("");
    if (this.loc) {
      cx.spawn(async (cx) => {
        [this.branchCommits, this.branches] = await Promise.all([history(this.loc), branches(this.loc)]);
        cx.notify();
      });
    }
    cx.notify();
  }

  // Opens a list beside the picker; the commits' one takes the keyboard for its search field.
  openSub(sub, cx) {
    this.sub = sub;
    if (sub === "commits") this.searchInput.focus();
    cx.notify();
  }

  // The commits the picker's list shows: the recent ones, or with a query, the branch's matches.
  shownCommits() {
    return this.query.trim() ? filterCommits(this.branchCommits, this.query) : this.commits;
  }

  // Loads one file's diff once per refresh; a result from an older refresh is dropped.
  loadDiff(path, cx) {
    const f = this.files.find((x) => x.path === path);
    if (!f || !this.loc || this.diffs[path] || !openable(f)) return;
    const fp = this.fp, loc = this.loc, base = this.base, rev = this.rev;
    cx.spawn(async (cx) => {
      let rows;
      try {
        rows = await diffFor(loc, f, base, rev);
        markWords(rows);
        attachColors(rows, await highlight(loc, f, base, rev).catch(() => null));
      } catch (e) { rows = noticeRows(`Cannot load diff: ${e?.message ?? e}`); }
      if (fp === this.fp) this.diffs[path] = numberBlocks(rows);
      cx.notify();
    });
  }

  // Opens the diff of every file (up to EXPAND_MAX), and closes them all. The keys and the header's buttons.
  expandAll(cx) {
    for (const f of this.files.slice(0, EXPAND_MAX)) if (openable(f)) this.open.add(f.path);
    for (const p of this.open) this.loadDiff(p, cx);
    cx.notify();
  }

  collapseAll(cx) {
    this.open.clear();
    cx.notify();
  }

  // A tree folder: collapsed, its contents leave the list; open again, they come back.
  toggleFold(path, cx) {
    if (this.folded.has(path)) this.folded.delete(path);
    else this.folded.add(path);
    cx.notify();
  }

  toggleFile(path, cx) {
    const f = this.files.find((x) => x.path === path);
    if (f && !openable(f)) return cx.notify(); // a binary file has no diff to open
    if (this.open.has(path)) this.open.delete(path);
    else { this.open.add(path); this.loadDiff(path, cx); }
    cx.notify();
  }

  // Keys, while the panel has the keyboard (a click on it gives it): j and k move the cursor over the
  // files, ctrl-d and ctrl-u by a tenth of the visible list, l opens the cursor's diff, h closes it,
  // enter opens or closes it. Other keys pass on.
  // shortcut: the tenth counts file rows at 28px each, so a list of open diffs moves less than a tenth of the screen.
  onKey(e, cx) {
    if (this.menu) return; // the picker is open: its search field takes the keys
    const k = e.keystroke;
    const i = this.files.findIndex((f) => f.path === this.cursor);
    const tenth = Math.max(1, Math.floor((this.heights["wfordiffs-list"] ?? 0) / this.px(FILE_H) / 10));
    if (k === "j" || k === "k" || k === "ctrl-d" || k === "ctrl-u") {
      if (!this.files.length) return;
      const step = { j: 1, k: -1, "ctrl-d": tenth, "ctrl-u": -tenth }[k];
      const at = Math.min(this.files.length - 1, Math.max(0, i < 0 ? 0 : i + step));
      this.cursor = this.files[at].path; this.reveal = true;
    } else if (i >= 0 && (k === "l" || k === "h" || k === "enter")) {
      const p = this.files[i].path;
      if (k === "l") { if (openable(this.files[i])) { this.open.add(p); this.loadDiff(p, cx); } }
      else if (k === "h") this.open.delete(p);
      else this.toggleFile(p, cx);
    } else if (k === "e" && this.block) {
      // A selected block (by a click): nvim on its first line, as the menu's "Abrir en nvim".
      const { path, n } = this.block;
      const first = (this.diffs[path] ?? []).find((r) => r.first && r.blk === n);
      if (!first || !this.nvimOpenable(path)) return;
      this.openNvim(path, cx, this.blockLine(first));
    } else return;
    cx.stop_propagation();
    cx.notify();
  }

  // An error at the bottom of the panel: it stays until dismissed, and it can be copied.
  showError(text, cx) {
    this.toolError = text; this.errorCopied = false; cx.notify();
  }

  copyError(cx) {
    cx.write_to_clipboard(this.toolError);
    this.errorCopied = true; cx.notify();
    cx.timer.after(1500, (cx) => { this.errorCopied = false; cx.notify(); });
  }

  // A short message in the header, gone after a few seconds.
  flashMessage(text, cx) {
    this.flash = text; cx.notify();
    cx.timer.after(2500, (cx) => { if (this.flash === text) { this.flash = ""; cx.notify(); } });
  }

  // The shared views (split, tree, wrap): set from the header or the menu, and read back in render.
  setView(patch, cx) {
    setShared(VIEW_KEY, { ...parseView(shared(VIEW_KEY)), ...patch });
    cx.notify();
  }

  // Full screen: the panel opens again in a big dialog over the window, as its own copy of this mod
  // (props.full). It is an action, not a toggle: Esc shuts the dialog.
  openFull() {
    openOverlay({ mod: "wfordiffs", kind: "dialog", width: 0.94, height: 0.9, props: { full: true } });
  }

  // Runs a tool (nvim, lazygit, ...) in a terminal of its own and shows it: in a window over the panel's body when
  // `pane` is set and the body can be measured, else in a big dialog over the window (tool-window.js). One at a
  // time. The work runs in cx.spawn: the cx of a click is only good until the handler returns, and this waits for hc.
  runTool(tool, cx, { pane = false } = {}) {
    const loc = this.loc;
    if (!loc) return;
    cx.spawn(async (cx) => {
      try { await this.tools.open({ tool, loc, cx, spot: pane ? this.bodyBox() : null, onEnd: (cx) => cx.notify() }); }
      catch (e) { this.showError(`Could not open ${tool.id}: ${e?.message ?? e}`, cx); }
      cx.notify();
    });
  }

  // nvim on a file, at a line (a block's, from its menu or the e key), over the panel's body like lazygit, or in the dialog per the gear's setting.
  openNvim(path, cx, line = null) {
    this.runTool({ id: "nvim", script: FIND_NVIM, args: [...(line ? [`+${line}`] : []), path] }, cx, { pane: !this.cfg.nvimFull });
  }

  // The panel's body (everything under the header). `at` takes window pixels (what the pointer's box is in),
  // but width and height are logical, so they are divided by the zoom. The panel's own size is measured live
  // (rootSize, set on every resize); the pointer's box only gives where its right edge and top are, and the
  // panel hugs the window's right edge, so a resize moves its left side. Rounded: a half pixel shows as a seam.
  // shortcut: the right edge and the top are the last box the pointer reported, so resizing the app's window
  // (not the panel) leaves the tool in the old frame until the next pointer move and panel resize.
  bodyBox() {
    const b = this.box, h = this.headerH, size = this.rootSize, z = settings()?.zoom || 1;
    if (!b || !h || !size || props()?.full || size.width < 50 || size.height - h < 50) return null; // a hidden panel measures 0
    return { x: Math.round(b.x + b.width - size.width), y: Math.round(b.y + h), width: Math.round(size.width / z), height: Math.round((size.height - h) / z) };
  }

  // The panel is being resized while a tool is up over its body: the tool's window follows (tool-window.js).
  onResized(cx) {
    this.tools.resized(cx, () => this.bodyBox(), (cx) => cx.notify());
  }

  // lazygit in the repo: `pane` puts it over the panel's body, else in the big dialog. The header button (per the
  // gear's setting) and the commands `lazygit-pane` and `lazygit-fullscreen` come here.
  openLazygit(cx, { pane }) {
    if (!this.lazygit) return this.showError("Could not open lazygit: it is not installed where this repo lives.", cx);
    this.runTool(LAZYGIT, cx, { pane });
  }

  // The header's lazygit button: opens lazygit, or closes it while it is up.
  toggleLazygit(cx) {
    if (this.tools.isUp("lazygit")) { this.tools.close(); return cx.notify(); }
    this.openLazygit(cx, { pane: !this.cfg.lazygitFull });
  }

  // The reference of the selected lines, "<full path>#L1-L3", copied for pasting in the chat.
  copySelection(cx) {
    const s = this.sel, rows = s && this.diffs[s.path];
    const picked = rows ? selectedRows(rows, s.from, s.to) : [];
    if (!picked.length) return;
    const ref = reference(`${this.root}/${s.path}`, picked);
    cx.write_to_clipboard(ref);
    this.flashMessage(`Copied ${ref}`, cx);
  }

  // Asks first: the confirm dialog does the discard (its own copy of this mod, over the panel).
  askDiscard(f) {
    if (!this.loc) return;
    openOverlay({ mod: "wfordiffs", kind: "dialog", width: 420, height: 220,
      props: { discard: { loc: this.loc, file: { path: f.path, untracked: !!f.untracked } } } });
  }

  // Runs in the dialog. On success the dialog closes; the panel shows the file's new state at its next refresh.
  confirmDiscard(cx) {
    const { discard: d, overlay } = props();
    if (this.busy) return;
    this.busy = true; this.err = null; cx.notify();
    cx.spawn(async (cx) => {
      try {
        await discard(d.loc, d.file);
      } catch (e) {
        this.busy = false; this.err = String(e?.message ?? e); cx.notify();
        return;
      }
      closeOverlay(overlay);
      notify({ title: d.file.untracked ? "File deleted" : "Changes discarded", body: d.file.path, level: "success", timeout: 3000 });
    });
    cx.notify();
  }

  px(n) { return Math.round(n * this.k); }

  // A folder with changes, and a changed file: drawn by ui-file-row.js from these values and callbacks.
  dirRow(entry, t) {
    return drawDirRow(entry, t, { px: (n) => this.px(n), onToggle: (cx) => this.toggleFold(entry.path, cx) });
  }

  fileRow(f, t, entry) {
    return drawFileRow(f, entry, t, {
      px: (n) => this.px(n), cfg: this.cfg, open: this.open.has(f.path), isCursor: this.cursor === f.path,
      nvimAvailable: !this.rev && this.nvim && openable(f), countsWidth: this.countsW,
      onSelect: (cx) => { this.cursor = f.path; this.toggleFile(f.path, cx); },
      onOpenNvim: (cx) => this.openNvim(f.path, cx), onDiscard: () => this.askDiscard(f) });
  }

  // The width of the counts column: the widest file's numbers (or "binary"), so every row's icons line up.
  countsWidth() {
    const digits = Math.max(1, ...this.files.map((f) => Math.max(String(f.add).length, String(f.del).length)));
    const cw = CHAR_W * (11 / 12) * this.k; // 11px text; CHAR_W is the estimate at the panel's 12px base
    return Math.ceil(Math.max(2 * (digits + 1) * cw + 6 * this.k, 6 * cw));
  }

  // What the diff rows need to know about the panel (ui-diff-row.js draws them from it).
  rowView() {
    return { px: (n) => this.px(n), k: this.k, cfg: this.cfg, wrap: this.wrap, viewport: this.viewport };
  }

  // The three below are called by hscroll.js for each row of an open file.
  splitRow(row, group, t, offset) {
    const path = group.file.path, blk = row.left?.blk ?? row.right?.blk;
    const firstSide = row.left?.first ? row.left : row.right?.first ? row.right : null; // the block's first row, if this pair starts one
    const hooks = { ...this.blockHooks(path, blk, !!firstSide, firstSide ? this.blockLine(firstSide) : null, t) };
    if (blk !== undefined) hooks.onHover = (hovered) => this.hoverBlockAt(path, blk, hovered);
    return drawSplitRow(row, path, t, offset, this.rowView(), hooks);
  }

  hatch(t, height) {
    return hatching(t, height, (n) => this.px(n));
  }

  codeRow(row, path, t, width, i, col = "") {
    const key = `${col}${path}#${i}`;
    return drawCodeRow(row, path, t, {
      view: this.rowView(), width, key, picked: isPicked(this.sel, path, i), hovered: this.hover === key,
      // A press on a selected line clears the selection; otherwise it starts one (drag to extend).
      onPress: () => {
        const press = pressRow(this.sel, path, i);
        this.sel = press.sel; this.dragging = press.dragging;
        if (press.cleared) this.flash = "";
      },
      onHover: (hovered) => {
        if (hovered) {
          this.hover = key;
          if (this.dragging) this.sel = extendTo(this.sel, path, i); // dragging over rows extends the selection
        } else if (this.hover === key) this.hover = null;
        this.hoverBlockAt(path, row.blk, hovered);
      },
      ...this.blockHooks(path, row.blk, !!row.first, row.first ? this.blockLine(row) : null, t) });
  }

  // A row of a block: a click on it selects the block, and the block's first row carries its "..." button
  // while the block is hovered or selected. line: where "Abrir en nvim" opens the file (the block's first line).
  blockHooks(path, blk, first, line, t) {
    if (blk === undefined) return {};
    return {
      onClick: (cx) => { this.selectBlock({ path, n: blk }); cx.notify(); },
      action: first && this.showAction(path, blk) ? this.blockButton(path, blk, line, t) : null,
    };
  }

  // The "..." button of a block, and its menu: "Abrir en nvim" opens the file at the block's first line.
  blockButton(path, blk, line, t) {
    const menuOpen = this.blockMenu?.path === path && this.blockMenu?.n === blk;
    return blockAction({
      id: `blk-${path}#${blk}`, px: (n) => this.px(n), open: menuOpen,
      onOpenChange: (open, cx) => { this.blockMenu = open ? { path, n: blk } : null; cx.notify(); },
      items: [{ id: `blk-nvim-${path}#${blk}`, label: "Abrir en nvim",
        onClick: (cx) => { this.blockMenu = null; cx.notify(); this.openNvim(path, cx, line); } }],
    }, t);
  }

  // Blocks: a click selects one; the pointer over one shows its "..." button. Nothing is tinted.
  selectBlock(block) {
    this.block = block; this.cursor = block.path;
  }

  hoverBlockAt(path, blk, hovered) {
    if (blk === undefined) return;
    if (hovered) this.hoverBlock = { path, n: blk };
    else if (this.hoverBlock?.path === path && this.hoverBlock.n === blk) this.hoverBlock = null;
  }

  isHovered(path, blk) { return this.hoverBlock?.path === path && this.hoverBlock.n === blk; }

  isSelected(path, blk) { return this.block?.path === path && this.block.n === blk; }

  // The "..." button shows on a block that is under the pointer, selected, or whose menu is open, and only
  // when there is an action to show: nvim, on a file that is in the list (not a commit, not deleted).
  showAction(path, blk) {
    const menuOpen = this.blockMenu?.path === path && this.blockMenu?.n === blk;
    return this.nvimOpenable(path) && (this.isHovered(path, blk) || this.isSelected(path, blk) || menuOpen);
  }

  nvimOpenable(path) {
    return !this.rev && this.nvim && this.files.find((f) => f.path === path)?.status !== "D";
  }

  // The line a block starts on in the new file (a removed row has its old-file number).
  blockLine(row) {
    return row.kind === "-" ? row.o : row.n;
  }

  // One entry per file: its row, then — when open — the rows of its diff, in a box of
  // their own so that file, and only that file, scrolls sideways.
  // The rows of the list, in order: folders (tree view only) and files. A file that is open
  // carries its diff as well.
  listRows(tree) {
    const entries = (tree ? treeRows(this.files, this.root ? this.root.split(/[\\/]/).pop() : null, this.folded)
      : this.files.map((file) => ({ kind: "file", file, name: file.path, depth: 0 }))).map((e) => ({ ...e, tree }));
    return entries.map((e, i) => {
      // The tree only names the files: a file's diff opens in the list (the click toggles it there).
      if (e.kind === "dir" || e.tree || !this.open.has(e.file.path)) return e;
      const body = this.diffs[e.file.path];
      if (!body) return { ...e, body: [{ kind: "@", text: "Loading…" }], width: 0, id: `gv-${i}` };
      // What the widest row needs: the gutters, then the text.
      const width = Math.max(...body.map((r) => r.text.length * CHAR_W * this.k + GUTTER_W * this.k), 0);
      // Side by side, the body is its pairs, under a row naming the two sides. A new file has no
      // "before" to compare with, so it keeps the one column.
      if (this.side && e.file.status !== "A") return { ...e, body: [{ kind: "sides" }, ...pairSides(body)], width, split: true, id: `gv-${i}` };
      return { ...e, body, width, id: `gv-${i}` };
    });
  }

  // The font size and the shared choices (the gear window and the menu set them), read at each render.
  syncShared() {
    this.cfg = parseConfig(shared(CFG_KEY));
    this.k = this.cfg.font / DEFAULTS.font; // every size below was designed at 12px
    Object.assign(this, parseView(shared(VIEW_KEY))); // side, tree, wrap: the shared choice (setView)
  }

  // Dragging the divider: to the right makes the list wider, so the tree narrower.
  onPointerMove(e, cx) {
    if (e.bounds) this.box = e.bounds;
    if (!this.splitDrag || !this.bodyW) return;
    const next = draggedShare(this.splitDrag, e.position.x, this.bodyW, SPLIT_MIN, SPLIT_MAX);
    if (next !== this.split) { this.split = next; cx.notify(); }
  }

  // Releasing ends the divider's drag, and a selection: its reference is copied.
  onPointerUp(cx) {
    if (this.splitDrag) { this.splitDrag = null; cx.notify(); }
    if (!this.dragging) return;
    this.dragging = false; this.copySelection(cx); cx.notify();
  }

  header(t) {
    const totals = { add: this.files.reduce((n, f) => n + f.add, 0), del: this.files.reduce((n, f) => n + f.del, 0) };
    return drawHeader(t, {
      px: (n) => this.px(n), cfg: this.cfg, hasRev: !!this.rev, menuOpen: this.menu, fileCount: this.files.length,
      head: this.head, revLabel: `${this.branch ? `vs ${this.branch}` : this.rev ? shortRev(this.rev, this.commits) : "Uncommitted"} ▾`,
      flash: this.flash, totals, view: { wrap: this.wrap, side: this.side, tree: this.tree }, isFull: !!props()?.full,
      onExpandAll: (cx) => this.expandAll(cx), onCollapseAll: (cx) => this.collapseAll(cx),
      onToggleMenu: (cx) => { if (this.menu) { this.menu = false; this.sub = null; cx.notify(); } else this.openPicker(cx); },
      onOpenSettings: () => openOverlay({ mod: "wfordiffs", kind: "window", key: "gitdiff-settings", width: 300, height: 596, props: { settings: true } }),
      onSetView: (patch, cx) => this.setView(patch, cx), onOpenFull: () => this.openFull(),
      lazygit: this.lazygit, lazygitOn: this.tools.isUp("lazygit"), onToggleLazygit: (cx) => this.toggleLazygit(cx) });
  }

  // The shown commit's message under the header.
  commitMessage(t) {
    return messageBox(t, {
      message: this.message, short: shortRev(this.rev, this.commits), open: this.msgOpen, px: (n) => this.px(n),
      onToggle: (cx) => { this.msgOpen = !this.msgOpen; cx.notify(); } });
  }

  // The picker that opens from the header's button.
  commitPicker(t) {
    return commitMenu(t, {
      rev: this.rev, branch: this.branch, branches: this.branches, commits: this.shownCommits(), query: this.query,
      sub: this.sub, px: (n) => this.px(n), onSub: (sub, cx) => this.openSub(sub, cx),
      onPick: (sha, cx) => this.selectCommit(sha, cx), onPickBranch: (name, cx) => this.selectBranch(name, cx),
      searchInput: this.searchInput });
  }

  // What the body says while there are no files: the error, "Loading changes…", "No changes", "No folder".
  emptyNotice(t) {
    const text = this.error || (this.loading ? "Loading changes…" : this.root ? "No changes" : "No folder");
    return div().flex_1().min_h(0).p(12).text_color(t.dim).child(text);
  }

  // The list is always here; the tree, when on, is a column of its own on the right.
  columns(t) {
    // With the tree on, the list takes its share of the body (the tree takes the rest); before
    // the body is measured, both share it evenly.
    const listWidth = this.tree && this.bodyW ? Math.round(this.bodyW * (1 - this.split)) : null;
    return h_flex().flex_1().min_h(0).items_stretch()
      .on_size_change((size, cx) => { if (size.width !== this.bodyW) { this.bodyW = size.width; cx.notify(); } })
      .child(this.scrollColumn("wfordiffs-list", this.listRows(false), t, listWidth))
      .when(this.tree, (e) => e.child(this.divider(t)).child(this.scrollColumn("wfordiffs-tree", this.listRows(true), t, null)));
  }

  render(cx) {
    const t = theme();
    this.syncShared();
    if (props()?.settings) return settingsView(t, this.cfg, { cursor: this.settingsAt, handle: this.handle, onKey: (e, cx) => this.onSettingsKey(e, cx), onReset: () => this.askReset() });
    if (props()?.reset) return confirmView(t, { id: "wfordiffs-reset", title: "Reset settings?", action: "Reset",
      detail: "The colors, tints, font size and where Lazygit and Neovim open go back to their defaults. This can't be undone.",
      handle: this.handle, onKey: (e, cx) => this.onResetKey(e, cx),
      onConfirm: () => this.confirmReset(), onCancel: () => closeOverlay(props().overlay) });
    if (props()?.discard) return discardView(t, { target: props().discard.file, busy: this.busy, error: this.err,
      onConfirm: (_e, cx) => this.confirmDiscard(cx), onCancel: () => closeOverlay(props().overlay) });
    this.countsW = this.countsWidth();
    const away = this.tools.isAway();
    return v_flex().id("wfordiffs").size_full().relative().track_focus(this.handle)
      .on_key_down((e, cx) => this.onKey(e, cx)).on_mouse_down("left", () => this.handle.focus())
      .on_mouse_move((e, cx) => this.onPointerMove(e, cx)).on_mouse_up("left", (_e, cx) => this.onPointerUp(cx))
      .on_size_change((size, cx) => { this.rootSize = size; this.onResized(cx); })
      .min_h(0).bg(t.background).text_color(t.foreground).text_size(this.cfg.font).font_family(settings().font_family ?? "JetBrains Mono")
      .child(div().w_full().flex_none().on_size_change((size) => { this.headerH = size.height; }).child(this.header(t)))
      // A tool's window covers the body; while it steps aside for a resize, this says why.
      .when(away, (e) => e.child(resizeNotice(t, { px: (n) => this.px(n) })))
      .when(!away && !!this.rev && !!this.message, (e) => e.child(this.commitMessage(t)))
      .when(!away, (e) => e.child(this.files.length === 0 ? this.emptyNotice(t) : this.columns(t)))
      // At the bottom, under whatever the body shows.
      .when(!!this.toolError, (e) => e.child(errorBar(t, { text: this.toolError, copied: this.errorCopied, cfg: this.cfg, px: (n) => this.px(n),
        onCopy: (_e, cx) => this.copyError(cx), onDismiss: (_e, cx) => { this.toolError = null; cx.notify(); } })))
      // Last, so it paints over the body.
      .when(this.menu, (e) => e.child(this.commitPicker(t)));
  }

  // Asks first: the confirm dialog does the reset (its own copy of this mod, over the settings window).
  askReset() {
    openOverlay({ mod: "wfordiffs", kind: "dialog", width: 380, height: 190, props: { reset: true } });
  }

  confirmReset() {
    setShared(CFG_KEY, { ...DEFAULTS });
    closeOverlay(props().overlay);
  }

  // Enter confirms and Esc cancels, in the reset dialog.
  onResetKey(e, cx) {
    if (e.keystroke === "enter") this.confirmReset();
    else if (e.keystroke === "escape") closeOverlay(props().overlay);
    else return;
    cx.stop_propagation();
  }

  // Keys in the settings window: h j k l or the arrows move over the cells, Enter (or space) presses the one under the
  // cursor, Esc closes. Other keys pass on.
  onSettingsKey(e, cx) {
    const k = e.keystroke, rows = settingsRows(this.cfg);
    const moved = moveCursor(this.settingsAt, k, rows) ?? moveCursor(this.settingsAt, e.key, rows); // the arrows are named by key
    if (moved) this.settingsAt = moved;
    else if (k === "enter" || k === "space") {
      const cell = rows[this.settingsAt.row]?.cells[this.settingsAt.col];
      if (cell?.kind === "reset") this.askReset();
      else if (cell) setShared(CFG_KEY, { ...this.cfg, ...cell.patch });
    } else if (k === "escape") closeOverlay(props()?.overlay);
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  // The line between the columns. Drag it to make the tree wider or narrower.
  divider(t) {
    return div().id("wfordiffs-split").w(8).flex_none().flex().justify_center().cursor_col_resize()
      .on_mouse_down("left", (e, cx) => { this.splitDrag = { x: e.position.x, start: this.split }; cx.stop_propagation(); cx.notify(); })
      .child(div().w(1).h_full().bg(t.border));
  }

  // One scroll area of rows: the list, or the tree beside it. It scrolls down only: the rows keep
  // their place (and their counts) while any one diff scrolls sideways on its own. Its width is the
  // column's, which its diffs' bars are sized from.
  // shortcut: one overflow area plus one Scrollbar per axis; the single overflow_scrollbar() call
  // leaves this panel stuck on "could not be re-rendered".
  scrollColumn(id, groups, t, basis) {
    const width = this.widths[id] ?? 0;
    // The width the wrapped code is cut to (wrap.js); the tree shows no code, so it never sets it.
    if (width && id === "wfordiffs-list") this.viewport = width;
    // The open diffs' sideways offsets are kept per column: the same file can show in both.
    const rows = groups.map((g) => (g.body ? { ...g, id: `${id}-${g.id}` } : g));
    const list = id === "wfordiffs-list";
    // The rows, flat: each is a child of the scroll area (so the cursor's row has an index to scroll to).
    const kids = [];
    let at = -1;
    const files = list ? rows.filter((g) => g.kind !== "dir") : [];
    for (const g of rows) {
      if (g.kind === "dir") { kids.push(this.dirRow(g, t)); continue; }
      if (list && this.cursor === g.file.path) at = kids.length;
      const row = this.fileRow(g.file, t, g);
      const hit = files.indexOf(g);
      kids.push(list ? row.on_scroll_wheel((e, cx) => this.onListWheel(files, hit, 0, e, cx)) : row);
      if (g.body) {
        const body = hscroll(this, g, t, width);
        kids.push(list ? body.on_scroll_wheel((e, cx) => this.onListWheel(files, hit, this.px(FILE_H), e, cx)) : body);
      }
    }
    // A key moved the cursor: the list scrolls to its row, once, after this layout.
    if (list && this.reveal) { this.reveal = false; if (at >= 0) this.listScroll.scroll_to_item(at); }
    return div().min_w(0).min_h(0).relative()
      .when(list, (e) => e.on_scroll_wheel((ev) => { if (ev.bounds) this.listTop = ev.bounds.y; })) // where the list's top edge is
      .when(basis === null, (e) => e.flex_1()).when(basis !== null, (e) => e.w(basis).flex_none())
      .on_size_change((size, cx) => {
        this.heights[id] = size.height;
        if (size.width !== this.widths[id]) { this.widths[id] = size.width; cx.notify(); }
      })
      .child(v_flex().id(id).absolute().inset_0().overflow_y_scroll().when(list, (e) => e.track_scroll(this.listScroll)).children(kids))
      .child(Scrollbar.vertical(id).mode("always").absolute().inset_0())
      .when(list && !!this.scrollFile, (e) => e.child(scrollChip(t, { path: this.scrollFile, px: (n) => this.px(n) })));
  }

  // The wheel turns over a file's rows: the chip names the file at the top of the list, and goes 1.2s after the last
  // turn. It is only for a diff taller than the list (shorter ones show their file row all along, or leave it with
  // the whole diff): the file under the pointer is measured from its rows, a cost of one file's rows per turn.
  // The top file comes from the box of the element under the pointer (`hit`, whose body starts `inset` px below its
  // file's start) and the list's top edge: a file that starts below the edge leaves the top to the ones before it
  // (top-file.js, which measures only the ones it passes). Until the list's own box has arrived (the first turn),
  // the file under the pointer.
  // shortcut: heights are estimated from the rows (a wrapped line is taller), so the chip may change a few rows
  // early or late at a boundary. A drag of the scrollbar and the keys send no wheel events, so they do not show
  // the chip; a sideways turn is the diff's own bar.
  onListWheel(files, hit, inset, e, cx) {
    if (!e.delta.y || e.modifiers.shift) return;
    const view = this.heights["wfordiffs-list"];
    if (view && this.groupHeight(files[hit]) <= view) return; // the whole diff fits: no chip
    let path = files[hit].path;
    if (e.bounds && this.listTop !== undefined) {
      path = topFile(files.map((g) => g.file.path), hit, e.bounds.y - inset - this.listTop, (i) => this.groupHeight(files[i]));
    }
    const seq = ++this.scrollSeq;
    if (this.scrollFile !== path) { this.scrollFile = path; cx.notify(); }
    cx.timer.after(1200, (cx) => { if (seq === this.scrollSeq) { this.scrollFile = null; cx.notify(); } });
  }

  // A file's height in the list: its row, plus its diff's rows when open (their fixed heights, as hscroll counts them).
  // Kept per file until its diff is loaded again, or the split view or the font changes (what the heights depend on),
  // so a turn of the wheel asks the number and does not add up the rows again.
  groupHeight(g) {
    const path = g.file.path, rows = this.diffs[path], memo = this.heightMemo[path];
    if (memo && memo.rows === rows && memo.split === !!g.split && memo.k === this.k) return memo.h;
    let h = this.px(FILE_H);
    for (const r of g.body ?? []) h += this.px(r.kind === "pair" || (r.kind !== "@" && !g.split) ? LINE_H : HUNK_H);
    this.heightMemo[path] = { rows, split: !!g.split, k: this.k, h };
    return h;
  }
}
