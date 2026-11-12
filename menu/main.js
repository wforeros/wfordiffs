// The Changes menu (<leader>g in the tmux-style prefix). It looks and works as Herdr's own menu does
// (rows, the highlight, arrows, Enter, Esc, the hint on the right), with a filter field on top, and it
// opens at the top of the window like the picker. Fullscreen opens the panel full screen; Split view,
// Tree and Wrap switch the views the panel shows (the shared "gitdiff.view", as in mod/config.js).
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { theme, props, closeOverlay, openOverlay, shared, setShared } from "herdr";

const VIEW_KEY = "gitdiff.view";
function parseView(value) {
  let raw = value;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = {}; } }
  if (!raw || typeof raw !== "object") raw = {};
  return { side: raw.side === true, tree: raw.tree === true, wrap: raw.wrap === true };
}

export default class ChangesMenu extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.at = 0; this.query = "";
    // The filter is a text field, as in the picker: typing filters, enter runs the highlighted row.
    this.input = InputState.new({ placeholder: "Filter…" });
    this.input.on("change", (_e, cx) => { this.query = this.input.value(); this.at = 0; cx.notify(); });
    this.input.on("submit", (_e, cx) => this.choose(this.at, cx));
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
  }

  // The rows, filtered by the field. A toggle's hint says whether it is on.
  items() {
    const v = parseView(shared(VIEW_KEY));
    const all = [
      // Fullscreen shuts the menu and opens the panel full screen (its own dialog of herdr-gitdiff).
      { label: "Fullscreen", run: () => { openOverlay({ mod: "herdr-gitdiff", kind: "dialog", width: 0.94, height: 0.9, props: { full: true } }); } },
      // Lazygit shuts the menu and opens the panel's own copy in a dialog, which runs lazygit on the shown repo
      // (the header's button does the same). Without lazygit there, that copy says so.
      { label: "Lazygit", run: () => { openOverlay({ mod: "herdr-gitdiff", kind: "dialog", width: 0.94, height: 0.9, props: { lazygit: true } }); } },
      { label: "Split view", hint: v.side ? "on" : "off", run: (cx) => this.setView({ side: !v.side }, cx) },
      { label: "Tree", hint: v.tree ? "on" : "off", run: (cx) => this.setView({ tree: !v.tree }, cx) },
      { label: "Wrap", hint: v.wrap ? "on" : "off", run: (cx) => this.setView({ wrap: !v.wrap }, cx) },
    ];
    const q = this.query.trim().toLowerCase();
    return all.filter((it) => it.label.toLowerCase().includes(q));
  }

  setView(patch, cx) {
    setShared(VIEW_KEY, { ...parseView(shared(VIEW_KEY)), ...patch });
    cx.notify();
  }

  // Toggles keep the menu open (so the hint shows the new state); the other rows shut it, as Herdr's do.
  choose(i, cx) {
    const it = this.items()[i];
    if (!it) return;
    if (!it.hint) closeOverlay(props().overlay);
    it.run(cx);
  }

  // ↑/↓ move the highlight, round the list, as in Herdr's menu. Enter and Esc are handled above.
  key(e, cx) {
    const n = this.items().length;
    if (!n) return;
    const at = Math.min(this.at, n - 1);
    if (e.key === "down") this.at = (at + 1) % n;
    else if (e.key === "up") this.at = (at + n - 1) % n;
    else return;
    cx.stop_propagation(); cx.notify();
  }

  render() {
    const t = theme();
    const list = this.items(), at = Math.min(this.at, Math.max(0, list.length - 1));
    return v_flex().id("herdr-gitdiff-menu").track_focus(this.handle).w_full().min_h(0).p(5).bg(t.popover).text_size(12.8)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(div().px(9).pt(8).pb(4).text_size(11).text_color(t.dim).child("Herdr Diffview"))
      .child(h_flex().h(31).px(8).mb(4).items_center().rounded(7).border_1().border_color(t.border)
        .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground)))
      .children(list.length ? list.map((it, i) => h_flex().id(`mi-${i}`).h(31).px(8).gap(9).rounded(7).items_center().justify_between().text_color(t.foreground)
          .when(i === at, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => this.choose(i, cx))
          .child(div().flex_1().child(it.label))
          .child(div().text_size(11).text_color(t.dim).child(it.hint ?? "")))
        : [div().px(9).py(6).text_color(t.dim).child("Nothing matches")]);
  }
}
