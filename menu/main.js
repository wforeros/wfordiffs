// The Changes menu (<leader>G in the tmux-style prefix). It looks and works as Herdr's own menu does
// (rows, the highlight, arrows, Enter, Esc, the hint on the right), with a filter field on top, and it
// opens at the top of the window like the picker. Fullscreen opens the panel full screen, Open pane in the side panel; Split view,
// Tree and Wrap switch the views the panel shows (the shared "gitdiff.view", as in mod/config.js); Settings opens
// the panel's settings window.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { theme, props, closeOverlay, openOverlay, shared, setShared, run, layout } from "herdr";

const VIEW_KEY = "gitdiff.view";
function parseView(value) {
  let raw = value;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = {}; } }
  if (!raw || typeof raw !== "object") raw = {};
  return { side: raw.side === true, tree: raw.tree === true, wrap: raw.wrap === true };
}

// Finds the stack child that holds the panel (a block of mod "wfordiffs") and the stack it sits in.
function panelSlot(node, stack = null) {
  for (const child of node?.children ?? []) {
    if (child.type === "block" && child.content?.mod === "wfordiffs" && node.type === "stack") return { stack: node.id, child: child.id };
    const found = panelSlot(child, stack);
    if (found) return found;
  }
  return null;
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
      // Open pane shows the panel in the window's side panel (what its top-right button does), without
      // toggling it closed: it selects the panel's view in the stack and shows the side panel. Needs a layout
      // that has the panel in a stack; otherwise the row does nothing.
      { label: "Open pane", run: () => {
        const slot = panelSlot(layout());
        if (!slot) return;
        run("layout.select", slot);
        run("layout.show", { id: "panel" });
      } },
      // Fullscreen shuts the menu and opens the panel full screen (its own dialog of wfordiffs).
      { label: "Fullscreen", run: () => { openOverlay({ mod: "wfordiffs", kind: "dialog", width: 0.94, height: 0.9, props: { full: true } }); } },
      // Both Lazygit rows ask the panel (its commands `lazygit-fullscreen` and `lazygit-pane`): the menu is shut
      // before a row runs, so anything it waited for (hc) would come back to a menu that is gone. The panel knows
      // the repo and closes its own lazygit first. Like any mod command they reach shown copies only.
      { label: "Lazygit > Fullscreen", run: () => { run("wfordiffs.lazygit-fullscreen"); } },
      { label: "Lazygit > Pane", run: () => { run("wfordiffs.lazygit-pane"); } },
      { label: "Split view", hint: v.side ? "on" : "off", run: (cx) => this.setView({ side: !v.side }, cx) },
      { label: "Tree", hint: v.tree ? "on" : "off", run: (cx) => this.setView({ tree: !v.tree }, cx) },
      { label: "Wrap", hint: v.wrap ? "on" : "off", run: (cx) => this.setView({ wrap: !v.wrap }, cx) },
      // Settings opens the panel's gear window (colors, font, where the tools open). The same window, key and
      // size as the header's gear in mod/main.js: change them together.
      { label: "Settings", run: () => { openOverlay({ mod: "wfordiffs", kind: "window", key: "gitdiff-settings", width: 300, height: 596, props: { settings: true } }); } },
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
    return v_flex().id("wfordiffs-menu").track_focus(this.handle).w_full().min_h(0).p(5).bg(t.popover).text_size(12.8)
      .on_key_down((e, cx) => this.key(e, cx))
      .child(div().px(9).pt(8).pb(4).text_size(11).text_color(t.dim).child("WForDiffs"))
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
