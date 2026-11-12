// The confirmation before a discard: a small dialog over the panel (props().discard). Discarding
// cannot be undone, so the button is red and the text says what goes (confirm-view.js draws it).
import { confirmView } from "./confirm-view.js";

export function discardView(t, { target, busy, error, onConfirm, onCancel }) {
  const name = target.path.split("/").pop();
  return confirmView(t, {
    id: "wfordiffs-discard", busy, error, onConfirm, onCancel,
    title: target.untracked ? `Delete ${name}?` : `Discard changes to ${name}?`,
    detail: target.untracked
      ? `${target.path} is new and git doesn't track it yet, so it can't be restored.`
      : `The unstaged changes to ${target.path} are lost; the file goes back to its staged version. Staged changes stay. This can't be undone.`,
    action: target.untracked ? "Delete" : "Discard",
  });
}
