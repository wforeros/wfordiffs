// The small window behind the gear: pick the diff colors, the tints, the font, and where the tools open.
// It is the same mod opened as a window (props().settings); the choice goes to shared(), so the
// panel re-renders at once. No color-picker widget in the kit: a palette of swatches instead.
// What the window offers is settings-model.js's rows; this draws them. A cursor (the keys' place) rings one cell.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { setShared, closeOverlay, props } from "herdr";
import { addedColor, removedColor } from "./diff-colors.js";
import { CFG_KEY, tint } from "./config.js";
import { settingsRows } from "./settings-model.js";

// Styles. Each takes the theme and returns a function of an element, so the builders below read as structure.
const field = (t) => (el) => el.border_1().border_color(t.border).cursor_pointer().hover((s) => s.bg(t.hover));
// The ring around the cell the keys are on; unringed, it is the window's own color, so cells do not shift.
const ring = (t, focused) => (el) => el.p(2).rounded(7).border_1().border_color(focused ? t.accent ?? t.foreground : t.popover ?? t.background);
const button = (t) => (el) => field(t)(el).w(24).h(24).rounded(5).flex().items_center().justify_center();
const option = (t, chosen) => (el) => field(t)(el).px(8).h(24).rounded(5).flex().items_center()
  .border_color(chosen ? t.foreground : t.border).text_color(chosen ? t.foreground : t.muted);
const label = (t) => (el) => el.text_size(11).text_color(t.muted);
const rowTitle = (t) => (el) => label(t)(el).w(70);

/**
 * @typedef {object} SettingsNav
 * @property {{ row: number, col: number }} cursor the cell the keys are on
 * @property {object} handle the window's focus handle: the keys reach it
 * @property {(event: object, cx: object) => void} onKey
 * @property {() => void} onReset Reset was pressed: ask before it happens
 */

/**
 * @param {object} t herdr's theme colors
 * @param {object} cfg the config as it is now
 * @param {SettingsNav} nav
 */
export function settingsView(t, cfg, nav) {
  const apply = (patch, cx) => { setShared(CFG_KEY, { ...cfg, ...patch }); cx.notify(); };
  const rows = settingsRows(cfg);
  const themeOf = { added: t.ansi2, removed: t.ansi1, modified: t.blocked };
  const shown = { line: `${Math.round(cfg.line * 100)}%`, word: `${Math.round(cfg.word * 100)}%`, font: `${cfg.font}px` };

  const cellView = (cell, row) => {
    // Reset asks first (a dialog); every other cell applies its patch.
    const click = (_e, cx) => (cell.kind === "reset" ? nav.onReset() : apply(cell.patch, cx));
    if (cell.kind === "swatch") {
      const fill = cell.color ?? themeOf[row.key];
      return div().id(cell.id).w(22).h(22).rounded(5).cursor_pointer().bg(fill)
        .border_2().border_color(cell.chosen ? t.foreground : t.border).tooltip(cell.color ?? "Theme color").on_click(click)
        .child(cell.color === null ? div().size_full().flex().items_center().justify_center().text_size(9).text_color(t.background).child("A") : div());
    }
    if (cell.kind === "step") return button(t)(div().id(cell.id)).on_click(click).child(cell.text);
    if (cell.kind === "option") return option(t, cell.chosen)(div().id(cell.id)).on_click(click).child(cell.text);
    return div().id(cell.id).self_start().px(8).py(3).rounded(5).border_1().border_color(t.border).cursor_pointer()
      .hover((s) => s.bg(t.hover)).on_click(click).child("Reset");
  };
  const rowView = (row, r) => {
    const cells = row.cells.map((cell, c) => ring(t, nav.cursor.row === r && nav.cursor.col === c)(div()).child(cellView(cell, row)));
    if (row.kind === "palette") return v_flex().gap(6).child(label(t)(div()).child(row.title)).child(h_flex().gap(2).children(cells));
    if (row.kind === "reset") return h_flex().children(cells);
    const middle = row.kind === "stepper" ? [div().w(40).text_center().child(shown[row.key])] : [];
    return h_flex().items_center().gap(8).child(rowTitle(t)(div()).child(row.title))
      .child(h_flex().items_center().gap(4).children([cells[0], ...middle, ...cells.slice(1)]));
  };
  const block = (rs, gap) => v_flex().gap(gap).children(rs.map((row) => rowView(row, rows.indexOf(row))));

  // A changed line as it will look: the rest of the line tinted, the changed word stronger.
  const sample = (kind, color, word) => h_flex().w_full().h(22).px(8).items_center().bg(tint(color, cfg.line))
    .child(div().w(14).text_color(color).child(kind === "+" ? "+" : "−"))
    .child(div().child("const n = "))
    .child(div().px(1).bg(tint(color, cfg.word)).child(word))
    .child(div().child(";"));
  const preview = v_flex().rounded(5).overflow_hidden().border_1().border_color(t.border)
    .child(sample("-", removedColor(cfg, t), "42")).child(sample("+", addedColor(cfg, t), "43"));

  return v_flex().size_full().p(14).gap(14).bg(t.popover ?? t.background).text_color(t.foreground).text_size(12)
    .track_focus(nav.handle).on_mouse_down("left", () => nav.handle.focus()).on_key_down((e, cx) => nav.onKey(e, cx))
    .child(h_flex().items_center()
      .child(div().flex_1().font_semibold().child("Diff colors"))
      .child(div().id("cfg-close").w(22).h(22).rounded(5).flex().items_center().justify_center().cursor_pointer().hover((s) => s.bg(t.hover))
        .on_click(() => closeOverlay(props()?.overlay)).child("✕")))
    .child(block(rows.slice(0, 3), 14))
    .child(block(rows.slice(3, 8), 8))
    .child(preview)
    .child(block(rows.slice(8), 8));
}
