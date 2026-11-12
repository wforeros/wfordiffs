// The rows of the file list and of the tree: a folder with changes (dirRow) and a changed file
// (fileRow). They only draw: the view hands in the values to show and what a click should do.
import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { tint } from "../config.js";
import { statusColor } from "../diff-colors.js";
import { FILE_H, FILE_NAME, INDENT, SLOT } from "../metrics.js";
import { iconButton } from "./ui-buttons.js";
import { addedCount, removedCount, binaryLabel } from "./ui-counts.js";

// The status of a file -> its icon (mod/icons/custom). Untracked files count as new.
const STATUS_ICONS = { M: "modified_file", A: "new_file", D: "deleted_file" };
const ICONS = "mods/herdr-gitdiff/icons";
const ACTION = 20, ACTION_ICON = 13; // nvim and discard: the button and its icon, px at 12px
const CURSOR_TINT = 0.16; // the cursor's file: a faint tint of the accent, not a gray (the hatching is gray)
const NAME_MAX = 260;

/**
 * @typedef {object} Entry one row of the tree builder (tree.js), or of the list's groups
 * @property {boolean} tree  the row is in the tree column (the list column shows it differently)
 * @property {number} depth  folders above it
 * @property {boolean[]} [through] per ancestor level: its guide line goes on past this row
 * @property {boolean} [hangs]     an open folder's own line starts at its chevron
 * @property {string} [path]       a folder's path
 * @property {string} [name]       a folder's name
 * @property {boolean} [open]      a folder is unfolded
 */

// Styles (see AGENTS.md): each takes an element and returns it styled. `px` scales a size at 12px.

// The row's box: tall, full width, its left padding set by the depth.
const rowBox = (theme, px, indent) => (el) => el.relative().w_full().h(px(FILE_H)).pl(indent).pr(10).gap(8)
  .items_center().cursor_pointer().hover((s) => s.bg(theme.hover));
const emptySlot = (px) => div().w(px(ACTION)).flex_none();

/** Left padding of a row at this depth: the tree starts flush left; the list keeps its margin. */
export const rowIndent = (entry, px) => px((entry.tree ? 0 : 10) + entry.depth * INDENT);

/**
 * The tree's guide lines: a folder's line runs down from its chevron past its rows and stops at
 * its last one (through: false), and an open folder's line starts at its chevron (hangs).
 * @param {Entry} entry
 * @param {object} theme
 * @param {(n: number) => number} px
 * @returns {object[]} elements to add as children
 */
export function treeGuides(entry, theme, px) {
  if (!entry.tree || !entry.through) return [];
  // Each line sits on the middle of its folder's chevron (the chevron's box is px(SLOT) wide, the
  // line is 1px); a folder's line starts a little below its chevron, not on top of it.
  // A folder's last row: its line ends at the foot of that row's name (the text's middle plus half
  // its box), not at the middle.
  const full = px(FILE_H), end = px(FILE_H / 2 + SLOT / 2), below = px(FILE_H / 2 + SLOT / 2 + 3);
  const lineX = (depth) => px(depth * INDENT) + Math.round(px(SLOT) / 2) - 0.5;
  const lines = entry.through.map((through, level) =>
    div().absolute().left(lineX(level)).top(0).w(1).h(through ? full : end).bg(theme.border));
  if (entry.hangs) lines.push(div().absolute().left(lineX(entry.depth)).top(below).w(1).h(full - below).bg(theme.border));
  return lines;
}

/**
 * A folder with changes (tree view): its name; a click folds it.
 * @param {Entry} entry
 * @param {object} theme
 * @param {{ px: (n: number) => number, onToggle: (cx: object) => void }} options
 */
export function dirRow(entry, theme, { px, onToggle }) {
  const nameStyle = entry.depth === 0
    ? (el) => el.font_semibold().text_color(theme.foreground)
    : (el) => el.text_color(theme.muted);
  return rowBox(theme, px, rowIndent(entry, px))(h_flex().id(`d-${entry.path}`))
    .children(treeGuides(entry, theme, px))
    .on_click((_e, cx) => onToggle(cx))
    .child(svg(`${ICONS}/chevron-${entry.open ? "down" : "right"}.svg`).size(px(SLOT)).flex_none().text_color(theme.dim))
    .child(svg(`${ICONS}/folder.svg`).size(14).flex_none().text_color(theme.dim))
    .child(nameStyle(div().flex_1().min_w(0).truncate()).child(entry.name));
}

/**
 * @typedef {object} FileRowOptions
 * @property {(n: number) => number} px scales a size at 12px
 * @property {object} cfg the user's colors (config.js)
 * @property {boolean} open the file's diff is open
 * @property {boolean} isCursor the keyboard's file
 * @property {boolean} nvimAvailable nvim can open the working copy (not a past commit, and installed)
 * @property {number} countsWidth width of the counts column, so every row's icons line up
 * @property {(cx: object) => void} onSelect a click on the row
 * @property {(cx: object) => void} onOpenNvim
 * @property {() => void} onDiscard
 */

/**
 * A changed file, full width so the counts stay at the right edge whatever a diff below does. In
 * the tree the folders above it already say where it is, so only its name shows.
 * @param {{ path: string, status: string, add: number, del: number, binary?: boolean, unstaged?: boolean, untracked?: boolean }} file
 * @param {Entry} entry
 * @param {object} theme
 * @param {FileRowOptions} options
 */
export function fileRow(file, entry, theme, options) {
  const { px } = options;
  const inList = !entry.tree;
  const folders = file.path.split("/"), name = folders.pop();
  const icon = STATUS_ICONS[file.status] ?? STATUS_ICONS.M;
  const column = entry.tree ? "t" : "l"; // the two columns can show the same file: their ids differ
  // A file in the tree has no chevron, only its icon (kept in the folders' column so they line up).
  // A binary file has no diff to open, so it has no chevron either.
  const chevron = entry.tree || file.binary
    ? div().w(px(SLOT)).flex_none()
    : svg(`${ICONS}/chevron-${options.open ? "down" : "right"}.svg`).size(12).flex_none().text_color(theme.dim);
  // The list's icon is larger with its larger name; the tree's matches the folders' icons (14).
  const statusIcon = svg(`${ICONS}/custom/${icon}.svg`).size(entry.tree ? 14 : px(16)).flex_none()
    .text_color(statusColor(file.status, options.cfg, theme)).tooltip(icon.replace("_", " "));
  // The name is larger and bold, the folders above it dim: a file reads apart from its diff's lines.
  // In the tree it is as plain as a folder's below the top: same size, weight and color.
  const nameStyle = inList
    ? (el) => el.font_semibold().text_size(px(FILE_NAME)).text_color(theme.foreground)
    : (el) => el.text_color(theme.muted);
  const nameCell = h_flex().flex_1().min_w(0)
    .child(div().text_color(theme.dim).truncate().child(inList && folders.length ? folders.join("/") + "/" : ""))
    .child(nameStyle(div().max_w(NAME_MAX).min_w(0).truncate()).child(name));
  // The list only (the tree shows where the changes are): fixed slots, an empty one when a file has
  // no action, and a counts column as wide as the widest file's numbers.
  const actionButton = (id, iconName, tooltip, onClick) => iconButton({
    id, icon: `${ICONS}/${iconName}.svg`, tooltip, size: px(ACTION), iconSize: px(ACTION_ICON), onClick }, theme);
  const nvimSlot = () => file.status !== "D" && options.nvimAvailable
    ? actionButton(`${column}-nvim-${file.path}`, "nvim", "Open in nvim", (_e, cx) => { cx.stop_propagation(); options.onOpenNvim(cx); })
    : emptySlot(px);
  // Like nvim, only in the list: the discard acts on a file, not on where its changes are.
  const discardSlot = () => file.unstaged
    ? actionButton(`discard-${file.path}`, "trash", file.untracked ? "Delete this new file" : "Discard the unstaged changes",
      (_e, cx) => { cx.stop_propagation(); options.onDiscard(); })
    : emptySlot(px);
  const counts = () => h_flex().w(options.countsWidth).flex_none().justify_end().items_center()
    // Close together, like the totals in the header.
    .child(file.binary ? binaryLabel(theme, px)
      : h_flex().gap(6).child(addedCount(file.add, theme, options.cfg, px)).child(removedCount(file.del, theme, options.cfg, px)));
  return rowBox(theme, px, rowIndent(entry, px))(h_flex().id(`${column}-f-${file.path}`))
    .children(treeGuides(entry, theme, px))
    // The cursor's file: a faint tint of the accent, not a gray, so it is not mistaken for the hatching.
    .when(inList && options.isCursor, (el) => el.bg(tint(theme.accent ?? theme.muted, CURSOR_TINT)))
    .on_click((_e, cx) => options.onSelect(cx))
    .child(chevron)
    .child(statusIcon)
    .child(nameCell)
    .when(inList, (el) => el.child(nvimSlot()).child(discardSlot()).child(counts()));
}
