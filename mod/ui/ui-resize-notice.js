// What the panel says under lazygit's window: the window goes away while the panel is resized (a Herdr
// limitation), and this is what shows meanwhile. It only draws; `px` scales a size at 12px to the panel's font.
import { div } from "gpui-kit";
import { v_flex } from "gpui-base";

// Styles. One place each, so the builders below read as structure.
const stage = (theme) => (el) => el.flex_1().min_h(0).p(24).gap(10).items_center().justify_center().bg(theme.background);
const title = (theme, px) => (el) => el.text_size(px(18)).font_semibold().text_color(theme.foreground).text_center();
const hint = (theme, px) => (el) => el.max_w(px(320)).text_size(px(12)).text_color(theme.muted).text_center().whitespace_normal();
const apology = (theme, px) => (el) => el.text_size(px(11)).text_color(theme.dim).text_center();

/**
 * @typedef {object} ResizeNoticeOptions
 * @property {(n: number) => number} px scales a size at 12px to the panel's font
 */

/**
 * @param {object} theme herdr's theme colors
 * @param {ResizeNoticeOptions} options
 */
export function resizeNotice(theme, { px }) {
  return stage(theme)(v_flex())
    .child(title(theme, px)(div()).child("Resize in progress! :D"))
    .child(hint(theme, px)(div()).child("When you finish resizing, the pane will open again."))
    .child(apology(theme, px)(div()).child("Sorry, it is a herdr limitation"));
}
