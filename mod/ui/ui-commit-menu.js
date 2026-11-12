// The commit picker's two pieces: the message block under the header (messageBox) and the menu
// that opens from the header's button (commitMenu). They only draw: the view owns the state and
// hands in what to show (plain values) and what to do (callbacks that take the gpui `cx`).
import { div } from "gpui-kit";
import { v_flex, h_flex, Input } from "gpui-base";
import { splitMessage } from "../commit-message.js";

// Styles. Each one takes an element and returns it styled, and is named for what it is, so the
// builders below read as structure. `px` scales a size at 12px to the panel's font.

// A block set apart from the list: raised, an accent bar on its left, a line under it.
const card = (theme) => (el) => el.flex_none().px(14).py(8).gap(4).bg(theme.raised)
  .border_l(3).border_color(theme.accent ?? theme.muted).border_b(1);
const caption = (theme, px) => (el) => el.text_size(px(10)).text_color(theme.dim);
const subjectText = (theme, px, open) => (el) => el.flex_1().min_w(0).font_semibold().text_size(px(13))
  .text_color(theme.foreground).whitespace_normal().when(!open, (e) => e.truncate());
const foldToggle = (theme, px) => (el) => el.flex_none().text_size(px(10)).text_color(theme.muted);
const bodyText = (theme, px) => (el) => el.whitespace_normal().text_size(px(11)).text_color(theme.muted);
// A floating panel: the picker and its lists.
const popup = (theme) => (el) => el.rounded(6).border_1().border_color(theme.border).bg(theme.popover ?? theme.background).py(4);
// A row of the picker; `active` is the one in use.
const menuRow = (theme, px, active) => (el) => el.px(10).h(px(26)).flex().items_center().cursor_pointer()
  .hover((s) => s.bg(theme.hover)).when(active, (e) => e.bg(theme.selected));
// The search field, on top of the commits.
const searchField = (theme, px) => (el) => el.h(px(26)).mx(4).mt(4).mb(2).px(8).rounded(4).border_1().border_color(theme.border).items_center();

/**
 * @typedef {object} MessageBoxOptions
 * @property {string} message the commit's whole message
 * @property {string} short   its abbreviated hash
 * @property {boolean} open   the body is unfolded
 * @property {(n: number) => number} px scales a size at 12px
 * @property {(cx: object) => void} onToggle fold or unfold the body
 */

/**
 * The shown commit's message: the subject in bold under a "COMMIT <hash>" line; the body folds
 * under "more ▾" when there is one.
 * @param {object} theme
 * @param {MessageBoxOptions} options
 */
export function messageBox(theme, { message, short, open, px, onToggle }) {
  const { subject, body } = splitMessage(message);
  const subjectRow = h_flex().id("wfordiffs-msg").gap(8).items_start()
    .when(!!body, (e) => e.cursor_pointer())
    .on_click((_e, cx) => { if (body) onToggle(cx); })
    .child(subjectText(theme, px, open)(div()).child(subject))
    .when(!!body, (e) => e.child(foldToggle(theme, px)(div()).child(open ? "less ▴" : "more ▾")));
  const bodyBox = v_flex().id("wfordiffs-msg-body").max_h(px(180)).overflow_y_scroll()
    .child(bodyText(theme, px)(div()).child(body));
  return card(theme)(v_flex())
    .child(caption(theme, px)(div()).child(`COMMIT ${short}`))
    .child(subjectRow)
    .when(open && !!body, (e) => e.child(bodyBox));
}

/**
 * @typedef {object} CommitMenuOptions
 * @property {number} left px from the panel's left edge to the picker's button, where the menu opens
 * @property {string|null} rev the commit shown (null: the uncommitted changes)
 * @property {string|null} branch the branch HEAD is compared with (null: none)
 * @property {string[]} branches the branches the list offers
 * @property {{ sha: string, short: string, subject: string }[]} commits the commits the list shows (the recent ones, or the search's matches)
 * @property {string} query the search field's text ("" when there is none)
 * @property {"branches"|"commits"|null} sub the list open beside the menu
 * @property {(n: number) => number} px scales a size at 12px
 * @property {(sub: "branches"|"commits"|null, cx: object) => void} onSub open a list, or close it
 * @property {(sha: string|null, cx: object) => void} onPick show a commit (null: the uncommitted changes)
 * @property {(name: string, cx: object) => void} onPickBranch compare HEAD with a branch
 * @property {object} searchInput the search field's text (the view's InputState)
 */

/**
 * The picker: Uncommitted, Branches and Commits. Hovering Branches lists the branches to compare with;
 * hovering Commits lists the recent commits under a search field, which filters the whole branch.
 * @param {object} theme
 * @param {CommitMenuOptions} options
 */
export function commitMenu(theme, { left, rev, branch, branches, commits, query, sub, px, onSub, onPick, onPickBranch, searchInput }) {
  const row = (id, active) => menuRow(theme, px, active)(div().id(id));
  const search = searchField(theme, px)(h_flex().id("wfordiffs-search").w_full())
    .child(Input.new(searchInput).flex_1().h_full().text_size(px(11)).text_color(theme.foreground));
  const uncommitted = row("rev-uncommitted", !rev).w(150)
    .on_hover((hovered, cx) => { if (hovered && sub && !(sub === "commits" && query)) onSub(null, cx); })
    .on_click((_e, cx) => onPick(null, cx))
    .child("Uncommitted");
  const entry = (kind, label, active) => h_flex().w(150).child(row(`rev-${kind}`, active || sub === kind).w_full().justify_between()
    .on_hover((hovered, cx) => { if (hovered && sub !== kind) onSub(kind, cx); })
    .on_click((_e, cx) => onSub(kind, cx))
    .child(label)
    .child(div().text_color(theme.dim).child("›")));
  const note = (text) => div().px(10).py(4).text_color(theme.dim).child(text);
  const branchRows = branches.map((name) => row(`branch-${name}`, name === branch)
    .on_click((_e, cx) => onPickBranch(name, cx))
    .child(div().min_w(0).truncate().child(name)));
  const commitRows = commits.map((c) => row(`rev-${c.sha}`, c.sha === rev && !branch).gap(8)
    .on_click((_e, cx) => onPick(c.sha, cx))
    .child(div().text_color(theme.dim).flex_none().child(c.short))
    .child(div().min_w(0).truncate().child(c.subject)));
  const branchList = popup(theme)(v_flex()).w(260).id("wfordiffs-branches").max_h(px(260)).overflow_y_scroll()
    .children(branchRows.length ? branchRows : [note("No other branches")]);
  const commitList = popup(theme)(v_flex()).w(260).child(search)
    .children(commitRows.length ? commitRows : [note(query ? "Nothing matches" : "No commits")]);
  // The picker takes the clicks in it, so the panel does not take the keyboard from the field.
  return h_flex().absolute().top(40).left(left).items_start()
    .on_mouse_down("left", (_e, cx) => { searchInput.focus(); cx.stop_propagation(); })
    .child(popup(theme)(v_flex().w(150)).child(uncommitted)
      .child(entry("branches", "Branches", !!branch)).child(entry("commits", "Commits", !!rev && !branch)))
    .when(!!sub, (e) => e.child(div().w(4).h(1)).child(sub === "branches" ? branchList : commitList));
}
