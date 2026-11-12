// The rows of an open file's diff: a line of code with its numbers and its "+" (codeRow), the same
// line in the side-by-side view (splitRow), and the pieces they share. They only draw: the view
// hands in what the panel looks like (DiffView) and what to do on a press or a hover.
import { div, PathBuilder, Background } from "gpui-kit";
import { h_flex, v_flex, Popover } from "gpui-base";
import { tint, shade } from "./config.js";
import { lineColor } from "./diff-colors.js";
import { langOf, tokens } from "./lexer.js";
import { splitMarks } from "./inline.js";
import { breakRuns, wrapChars } from "./wrap.js";
import { ADD_W, NUM_W, PAD_L, LINE_H, HUNK_H, HATCH_SHADE } from "./metrics.js";

const BAR_W = 3;       // the bar at a changed line's left edge
const NUM_PAD = 4;      // right padding of a line number
const HATCH_PERIOD = 14; // distance between the hatching's diagonals

/**
 * @typedef {object} DiffView what the panel looks like, as the rows need it
 * @property {(n: number) => number} px scales a size at 12px
 * @property {number} k the font scale (px(n) is n * k, rounded)
 * @property {object} cfg the user's colors and strengths (config.js)
 * @property {boolean} wrap long lines break instead of scrolling sideways
 * @property {number} viewport the list's width in px, which wrap cuts its code to
 */

/**
 * @typedef {object} CodeRowOptions
 * @property {DiffView} view
 * @property {number} width the widest row of this diff, in px (0: no sideways bar, so no min width)
 * @property {string} key unique id of the row in its column
 * @property {boolean} picked the row is in the selection
 * @property {boolean} hovered the pointer is over the row (its "+" shows)
 * @property {(cx: object) => void} onPress a press on the "+"
 * @property {(hovered: boolean, cx: object) => void} onHover the pointer entered or left the row
 * @property {(cx: object) => void} [onClick] a click on the row (it selects the row's block)
 * @property {object|null} [action] the block's "..." button, drawn at the row's top right (blockAction)
 */

// Styles (see AGENTS.md).

// The row's height: fixed, or at least that when wrap lets it grow.
const lineBox = (view) => (el) => el
  .when(view.wrap, (e) => e.min_h(view.px(LINE_H)).items_stretch())
  .when(!view.wrap, (e) => e.h(view.px(LINE_H)).items_center());
// The grey bands: a hunk's header and the Before/After row.
const band = (theme) => (el) => el.w_full().bg(theme.raised).text_color(theme.dim);

// A line number: right-aligned in its gutter; a changed line's numbers take its color.
// shortcut: the gutter fits three digits; a four-digit line number in a big file is clipped.
const numberCell = (text, color, view) => div().w(view.px(NUM_W)).flex_none().text_right().pr(NUM_PAD)
  .when(view.wrap, (e) => e.py(1)).text_color(color).child(text);

/** The "@@ … @@" line that starts a hunk. */
export const hunkHeader = (text, theme, px) =>
  band(theme)(div().h(px(HUNK_H)).px(10).flex().items_center().truncate()).child(text);

/** The row above a side-by-side diff naming its two sides. */
export const sidesHeader = (theme, px) => {
  const side = () => div().flex_1().min_w(0).pl(px(PAD_L)).truncate();
  return band(theme)(h_flex().h(px(HUNK_H)).items_center().text_size(px(10)))
    .child(side().child("Before"))
    .child(side().border_l(1).border_color(theme.border).child("After"));
};

// The "..." button of a block, and the menu it opens: a small square lifted off the code by the background.
const actionButton = (theme) => (el) => el.px(6).rounded(4).bg(theme.background).text_color(theme.accent ?? theme.muted)
  .cursor_pointer().hover((s) => s.bg(theme.hover)).tooltip("Block actions");
const menuPanel = (theme) => (el) => el.min_w(150).rounded(6).border_1().border_color(theme.border).bg(theme.popover ?? theme.background).py(4);
const menuRow = (theme, px) => (el) => el.px(10).h(px(26)).flex().items_center().cursor_pointer().hover((s) => s.bg(theme.hover));

/**
 * A block's "..." button at its top right, and the menu it opens (a Popover anchored to the button).
 * @typedef {object} BlockActionOptions
 * @property {string} id the button's id, unique per block
 * @property {(n: number) => number} px scales a size at 12px
 * @property {boolean} open the menu is open
 * @property {(open: boolean, cx: object) => void} onOpenChange the menu opened or shut (a press outside shuts it)
 * @property {{ id: string, label: string, onClick: (cx: object) => void }[]} items the menu's rows
 */

/**
 * @param {BlockActionOptions} o
 * @param {object} theme
 */
export function blockAction(o, theme) {
  const trigger = actionButton(theme)(div().id(o.id)).child("...");
  const menu = menuPanel(theme)(v_flex()).children(o.items.map((item) => menuRow(theme, o.px)(div().id(item.id))
    .on_click((_e, cx) => item.onClick(cx)).child(item.label)));
  return div().absolute().top(2).right(4).child(Popover.new(`${o.id}-menu`).anchor("bottom_right").open(o.open)
    .on_open_change(o.onOpenChange).trigger(trigger).content(menu));
}

/**
 * The bar at a changed line's left edge, in the full color of its change. A plain box in the row
 * (not absolute), so it spans the row's height in wrap and without it. A context line: no color.
 * @param {string|null} color
 * @param {DiffView} view
 */
export const changeBar = (color, view) =>
  div().w(view.px(BAR_W)).flex_none().when(!view.wrap, (e) => e.h_full()).when(!!color, (e) => e.bg(color));

// A layer over the whole parent: the empty half of a side-by-side row is hatched.
const RECT = () => PathBuilder.fill().move_to("0%", "0%").line_to("100%", "0%").line_to("100%", "100%").line_to("0%", "100%").close().build();

/**
 * The thin grey diagonals of the empty sides: one layer over the diff, under its rows, so they run
 * on from row to row.
 * @param {object} theme
 * @param {number} height px
 * @param {(n: number) => number} px
 */
export const hatching = (theme, height, px) =>
  window.paint_path(RECT(), Background.pattern_slash(shade(theme.dim, HATCH_SHADE), 1, px(HATCH_PERIOD)))
    .absolute().top(0).left(0).w_full().h(height);

/**
 * The code of one line, as its tokens in their colors.
 * @param {object} row a diff row (parse.js), with `pieces` (bat's colors) or just `text`
 * @param {string} path the file, to pick a lexer when bat gave no colors
 * @param {object} theme
 * @param {string|null} base the line's +/- color (null: a context line), which tints the words that changed in it
 * @param {number} cols how many of these share the column's width (2 in the split view: one per side)
 * @param {DiffView} view
 */
export function codeText(row, path, theme, base, cols, view) {
  const wordBg = base ? tint(base, view.cfg.word) : null;
  const colors = { dim: theme.dim, ansi1: theme.ansi1, ansi2: theme.ansi2, ansi4: theme.ansi4, ansi5: theme.ansi5 };
  // shortcut: a piece without text (not from bat or the lexer) is dropped; a row with none is shown plain.
  const raw = row.pieces ?? tokens(row.text, langOf(path), colors);
  const pieces = raw.filter((p) => Array.isArray(p) && typeof p[0] === "string");
  if (!pieces.length && row.text) pieces.push([row.text, null]);
  // In wrap mode a word longer than a line is cut into pieces that fit (see wrap.js).
  const marked = splitMarks(pieces, row.marks);
  const runs = view.wrap ? breakRuns(marked, wrapChars(view.viewport / cols, view.k)) : marked;
  const code = h_flex().children(runs.map(([text, color, changed]) => div().text_color(color ?? theme.foreground)
    .when(changed, (e) => e.bg(wordBg)).when(view.wrap, (e) => e.whitespace_normal()).child(text)));
  // Wrap: the row grows taller and the tokens break at their own gaps. Otherwise it keeps
  // the widest row's width, and the list scrolls sideways.
  return view.wrap ? code.flex_1().min_w(0).flex_wrap().whitespace_normal().py(1) : code.flex_none();
}

/**
 * One line of a file's diff in the list: bar, two numbers, the "+" that selects it, the code.
 * @param {object} row
 * @param {string} path
 * @param {object} theme
 * @param {CodeRowOptions} options
 */
export function codeRow(row, path, theme, options) {
  const { view } = options;
  if (row.kind === "@") return hunkHeader(row.text, theme, view.px);
  const base = lineColor(row.kind, view.cfg, theme);
  const lineBg = base ? tint(base, view.cfg.line) : null;
  const plus = div().id(`add-${options.key}`).w(view.px(ADD_W)).flex_none().flex().items_center().justify_center().cursor_pointer()
    .text_color(theme.accent ?? theme.muted).font_semibold()
    .tooltip(options.picked ? "Clear the selection" : "Select this line (drag for several) and copy its reference")
    .on_mouse_down("left", (_e, cx) => { options.onPress(cx); cx.stop_propagation(); cx.notify(); })
    .child(options.picked || options.hovered ? "+" : "");
  // Wrapped rows line up on their first line: the numbers sit at the top, not centred against the
  // whole wrapped block. The bar is the row's left edge (a context line keeps the space), then the
  // gutter, which starts at the chevron's inset (PAD_L) so the numbers line up under it.
  return lineBox(view)(h_flex().id(`row-${options.key}`).w_full().relative())
    .when(!view.wrap && options.width > 0, (e) => e.min_w(options.width))
    .bg(options.picked ? theme.selected : lineBg ?? theme.background)
    .on_hover((hovered, cx) => { options.onHover(hovered, cx); cx.notify(); })
    .when(!!options.onClick, (e) => e.on_click((_e, cx) => options.onClick(cx)))
    .child(changeBar(base, view))
    .child(div().w(view.px(PAD_L - 3)).flex_none())
    .child(numberCell(row.o ?? "", base ?? theme.dim, view))
    .child(numberCell(row.n ?? "", base ?? theme.dim, view))
    .child(plus)
    .child(codeText(row, path, theme, base, 1, view))
    .when(!!options.action, (e) => e.child(options.action));
}

// An empty side has no line: a block in the hatching's color from the side's left edge to where the
// numbers sit, so nothing hatched shows to its left, then a strip of the background (opaque, so the
// hatching stops there).
const emptyGutter = (theme, view) => h_flex().flex_none().items_stretch().when(!view.wrap, (e) => e.h_full())
  .child(div().w(view.px(PAD_L + NUM_W)).when(!view.wrap, (e) => e.h_full()).bg(shade(theme.dim, HATCH_SHADE)))
  .child(div().w(view.px(4)).when(!view.wrap, (e) => e.h_full()).bg(theme.background));

// One half of a side-by-side row: a line (or nothing, where the other side has more lines) with
// its number and sign. A side with a line is opaque (its tint is laid over the background), so the
// hatching under the diff shows only on an empty side.
function sideHalf(row, number, isRight, path, theme, offset, view) {
  const base = lineColor(row?.kind, view.cfg, theme);
  const tinted = base ? tint(base, view.cfg.line) : null;
  const line = lineBox(view)(h_flex().flex_1().min_w(0))
    .when(!!row, (e) => e.pl(view.px(PAD_L))).when(offset > 0, (e) => e.ml(-offset)).when(!!tinted, (e) => e.bg(tinted))
    .child(row ? numberCell(number ?? "", base ?? theme.dim, view) : emptyGutter(theme, view))
    .child(row ? codeText(row, path, theme, base, 2, view) : div());
  return h_flex().flex_1().min_w(0).relative().overflow_hidden().items_stretch()
    .when(!!row, (e) => e.bg(theme.background))
    .when(isRight, (e) => e.border_l(1).border_color(theme.border))
    // An empty side has no change to mark, so no bar: its grey block starts at the panel's edge.
    .when(!!row, (e) => e.child(changeBar(base, view)))
    .child(line);
}

/**
 * Side by side (sides.js): a line of the old file on the left, of the new one on the right, in the
 * same row, so the two sides scroll down together. Each half is a clip of its own; `offset` moves
 * both the same way (hscroll.js).
 * shortcut: a side-by-side row has no "+" to select a line for its reference; the list view still has it.
 * @param {object} row a pair ({ left, right }), a hunk header or the sides header
 * @param {string} path
 * @param {object} theme
 * @param {number} offset sideways scroll in px
 * @param {DiffView} view
 * @param {{ onHover?: (hovered: boolean, cx: object) => void, onClick?: (cx: object) => void, action?: object|null }} [hooks]
 *   the pair's block: hover, a click, and the "..." button (the same as codeRow's)
 */
export function splitRow(row, path, theme, offset, view, hooks = {}) {
  if (row.kind === "@") return hunkHeader(row.text, theme, view.px);
  if (row.kind === "sides") return sidesHeader(theme, view.px);
  return h_flex().w_full().items_stretch().relative()
    .when(!!hooks.onHover, (e) => e.on_hover((hovered, cx) => { hooks.onHover(hovered, cx); cx.notify(); }))
    .when(!!hooks.onClick, (e) => e.on_click((_e, cx) => hooks.onClick(cx)))
    .child(sideHalf(row.left, row.left?.o, false, path, theme, offset, view))
    .child(sideHalf(row.right, row.right?.n, true, path, theme, offset, view))
    .when(!!hooks.action, (e) => e.child(hooks.action));
}
