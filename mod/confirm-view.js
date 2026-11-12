// A small confirmation dialog: a title, what happens, and Cancel / the action's button. It is the same mod opened
// as a dialog (props().discard, props().reset); main.js holds the state and does the work, this only draws it.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";

/**
 * @typedef {object} ConfirmOptions
 * @property {string} id element id of the dialog
 * @property {string} title
 * @property {string} detail what is lost or changed
 * @property {string} action the confirming button's text
 * @property {boolean} [busy] the work is running: the button says so and does nothing
 * @property {string|null} [error] what went wrong, shown above the buttons
 * @property {object} [handle] a focus handle: with it the dialog takes keys (see onKey)
 * @property {(event: object, cx: object) => void} [onKey]
 * @property {(event: object, cx: object) => void} onConfirm
 * @property {() => void} onCancel
 */

/**
 * @param {object} t herdr's theme colors
 * @param {ConfirmOptions} o
 */
export function confirmView(t, o) {
  const button = (id, text, primary, action) => h_flex().id(id).h(32).px(14).items_center().rounded(8).border_1().cursor_pointer()
    .border_color(primary ? t.ansi1 : t.border).bg(primary ? t.ansi1 : t.raised)
    .text_color(primary ? t.background : t.foreground).text_size(12.5).font_medium()
    .hover((s) => s.opacity(0.88)).on_click(action).child(text);

  return v_flex().id(o.id).size_full().min_h(0).p(18).bg(t.popover).text_color(t.foreground).text_size(12.8)
    .when(!!o.handle, (el) => el.track_focus(o.handle).on_mouse_down("left", () => o.handle.focus()).on_key_down((e, cx) => o.onKey(e, cx)))
    .child(div().text_size(15).font_semibold().child(o.title))
    .child(div().pt(8).text_color(t.muted).child(o.detail))
    .when(Boolean(o.error), (el) => el.child(div().pt(12).text_size(12).text_color(t.ansi1).child(o.error)))
    .child(div().flex_1())
    .child(h_flex().pt(16).gap(8).justify_end()
      .child(button(`${o.id}-cancel`, "Cancel", false, o.onCancel))
      .child(button(`${o.id}-ok`, o.busy ? "Working…" : o.action, true, o.busy ? () => {} : o.onConfirm)));
}
