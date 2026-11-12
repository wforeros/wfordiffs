// The chip that names the file being scrolled: it floats at the top of the list while the wheel turns, so a long
// diff does not lose its file. It only draws: the view hands in the path.
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { fileLabel } from "../file-label.js";

// Styles. `px` scales a size at 12px to the panel's font.
const chip = (theme, px) => (el) => el.absolute().top(px(6)).right(px(18)).max_w_full().px(px(8)).py(px(3)).gap(px(2)).rounded(5)
  .bg(theme.raised).border_1().border_color(theme.border).text_size(px(11));
const dirText = (theme) => (el) => el.min_w(0).truncate().text_color(theme.dim);
const nameText = (theme) => (el) => el.flex_none().font_semibold().text_color(theme.foreground);

/**
 * @typedef {object} ScrollChipOptions
 * @property {string} path the file under the pointer
 * @property {(n: number) => number} px scales a size at 12px to the panel's font
 */

/**
 * @param {object} theme herdr's theme colors
 * @param {ScrollChipOptions} options
 */
export function scrollChip(theme, { path, px }) {
  const { dir, name } = fileLabel(path);
  return chip(theme, px)(h_flex())
    .child(dirText(theme)(div()).child(dir))
    .child(nameText(theme)(div()).child(name));
}
