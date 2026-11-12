// An error at the bottom of the panel: what went wrong, with a button to copy it and one to dismiss it.
// It only draws: the view hands in the text and what each button does.
import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { removedColor } from "../diff-colors.js";
import { textButton } from "./ui-buttons.js";

// Styles (see CLAUDE.md). `px` scales a size at 12px to the panel's font.
const bar = (theme, cfg) => (el) => el.flex_none().px(14).py(8).gap(6).bg(theme.raised)
  .border_t(1).border_color(removedColor(cfg, theme));
const heading = (theme, cfg, px) => (el) => el.flex_1().text_size(px(11)).font_semibold().text_color(removedColor(cfg, theme));
const message = (theme, px) => (el) => el.max_h(px(96)).overflow_hidden().whitespace_normal().text_size(px(11)).text_color(theme.foreground);

/**
 * @typedef {object} ErrorBarOptions
 * @property {string} text the error
 * @property {boolean} copied the text was just copied: the button says so
 * @property {object} cfg the user's colors (config.js)
 * @property {(n: number) => number} px scales a size at 12px to the panel's font
 * @property {(event: object, cx: object) => void} onCopy
 * @property {(event: object, cx: object) => void} onDismiss
 */

/**
 * @param {object} theme herdr's theme colors
 * @param {ErrorBarOptions} o
 */
export function errorBar(theme, o) {
  return bar(theme, o.cfg)(v_flex())
    .child(h_flex().items_center().gap(4)
      .child(heading(theme, o.cfg, o.px)(div()).child("Error"))
      .child(textButton({ id: "wfordiffs-error-copy", label: o.copied ? "Copied ✓" : "Copy error", bordered: true, onClick: o.onCopy }, theme))
      .child(textButton({ id: "wfordiffs-error-close", label: "✕", tooltip: "Dismiss", onClick: o.onDismiss }, theme)))
    .child(message(theme, o.px)(div()).child(o.text));
}
