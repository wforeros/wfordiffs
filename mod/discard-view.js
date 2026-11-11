// The confirmation before a discard: a small dialog over the panel (props().discard). Discarding
// cannot be undone, so the button is red and the text says what goes. main.js holds the state
// and does the work; this only draws it.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";

export function discardView(t, { target, busy, error, onConfirm, onCancel }) {
  const name = target.path.split("/").pop();
  const title = target.untracked ? `Delete ${name}?` : `Discard changes to ${name}?`;
  const detail = target.untracked
    ? `${target.path} is new and git doesn't track it yet, so it can't be restored.`
    : `The unstaged changes to ${target.path} are lost; the file goes back to its staged version. Staged changes stay. This can't be undone.`;
  const button = (id, text, primary, action) => h_flex().id(id).h(32).px(14).items_center().rounded(8).border_1().cursor_pointer()
    .border_color(primary ? t.ansi1 : t.border).bg(primary ? t.ansi1 : t.raised)
    .text_color(primary ? t.background : t.foreground).text_size(12.5).font_medium()
    .hover((s) => s.opacity(0.88)).on_click(action).child(text);

  return v_flex().id("herdr-gitdiff-discard").size_full().min_h(0).p(18).bg(t.popover).text_color(t.foreground).text_size(12.8)
    .child(div().text_size(15).font_semibold().child(title))
    .child(div().pt(8).text_color(t.muted).child(detail))
    .when(Boolean(error), (el) => el.child(div().pt(12).text_size(12).text_color(t.ansi1).child(error)))
    .child(div().flex_1())
    .child(h_flex().pt(16).gap(8).justify_end()
      .child(button("discard-cancel", "Cancel", false, onCancel))
      .child(button("discard-ok", busy ? "Working…" : target.untracked ? "Delete" : "Discard", true, busy ? () => {} : onConfirm)));
}
