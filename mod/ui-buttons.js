// The small clickable things in the panel's header: a text button (wrap, split, tree, full, the
// commit picker) and an icon button (the gear). Each takes the theme and returns an element, so the
// header says what it has, not how a button is drawn.
import { div, svg } from "gpui-kit";

/**
 * A button with a word on it.
 * @param {object} options
 * @param {string} options.id element id (hover and tooltips need one)
 * @param {string} options.label
 * @param {boolean} [options.active] a toggle that is on: selected gray, full-strength text
 * @param {string} [options.color] text color when it should not follow `active` (the commit picker's follows the commit)
 * @param {boolean} [options.bordered] an outline, for the picker
 * @param {string} [options.tooltip]
 * @param {(event: object, cx: object) => void} options.onClick
 * @param {object} theme
 */
export function textButton({ id, label, active = false, color, bordered = false, tooltip, onClick }, theme) {
  const textColor = color ?? (active ? theme.foreground : theme.muted);
  let button = div().id(id).px(6).py(1).rounded(4).text_size(10).text_color(textColor)
    .cursor_pointer().hover((s) => s.bg(theme.hover));
  if (bordered) button = button.border_1().border_color(theme.border);
  if (active) button = button.bg(theme.selected);
  if (tooltip) button = button.tooltip(tooltip);
  return button.on_click(onClick).child(label);
}

/**
 * A square button with an svg on it.
 * @param {object} options
 * @param {string} options.id element id
 * @param {string} options.icon path from the app home, as the mod's icons are addressed
 * @param {string} options.tooltip
 * @param {(event: object, cx: object) => void} options.onClick
 * @param {number} [options.size] button side in px
 * @param {number} [options.iconSize] icon side in px
 * @param {object} theme
 */
export function iconButton({ id, icon, tooltip, onClick, size = 22, iconSize = 14 }, theme) {
  return div().id(id).w(size).h(size).flex_none().rounded(4).flex().items_center().justify_center()
    .cursor_pointer().hover((s) => s.bg(theme.hover)).tooltip(tooltip).on_click(onClick)
    .child(svg(icon).size(iconSize).text_color(theme.muted));
}
