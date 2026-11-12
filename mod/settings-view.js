// The small window behind the gear: pick the diff colors and how strong the tints are.
// It is the same mod opened as a window (props().settings); the choice goes to shared(), so the
// panel re-renders at once. No color-picker widget in the kit: a palette of swatches instead.
import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { setShared, closeOverlay, props } from "herdr";
import { addedColor, removedColor } from "./diff-colors.js";
import { CFG_KEY, DEFAULTS, FONT_MIN, FONT_MAX, tint, stepAmount } from "./config.js";

const GREENS = ["#a6e3a1", "#7ee787", "#56d364", "#2ea043", "#40c057", "#00d084"];
const AMBERS = ["#f9e2af", "#e3b341", "#d29922", "#fab387", "#ffa657", "#bf8700"];
const REDS = ["#f38ba8", "#ff7b72", "#f85149", "#e5534b", "#ff6b6b", "#d1242f"];

export function settingsView(t, cfg) {
  const set = (patch, cx) => { setShared(CFG_KEY, { ...cfg, ...patch }); cx.notify(); };
  const label = (text) => div().text_size(11).text_color(t.muted).child(text);

  const swatch = (key, color, themeColor) => {
    const chosen = cfg[key] === color;
    const fill = color ?? themeColor;
    return div().id(`sw-${key}-${color ?? "theme"}`).w(22).h(22).rounded(5).cursor_pointer().bg(fill)
      .border_2().border_color(chosen ? t.foreground : t.border)
      .tooltip(color ?? "Theme color")
      .on_click((_e, cx) => set({ [key]: color }, cx))
      .child(color === null ? div().size_full().flex().items_center().justify_center().text_size(9).text_color(t.background).child("A") : div());
  };
  const palette = (title, key, colors, themeColor) =>
    v_flex().gap(6).child(label(title))
      .child(h_flex().gap(6).children([swatch(key, null, themeColor), ...colors.map((c) => swatch(key, c, themeColor))]));

  const stepper = (title, key) => {
    const btn = (id, sign, dir) => div().id(`${key}-${id}`).w(24).h(24).rounded(5).border_1().border_color(t.border).flex().items_center().justify_center()
      .cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => set({ [key]: stepAmount(cfg[key], dir) }, cx)).child(sign);
    return h_flex().items_center().gap(8).child(div().w(70).text_color(t.muted).text_size(11).child(title))
      .child(btn("less", "−", -1)).child(div().w(40).text_center().child(`${Math.round(cfg[key] * 100)}%`)).child(btn("more", "+", 1));
  };

  const fontStep = (dir) => Math.min(FONT_MAX, Math.max(FONT_MIN, cfg.font + dir));
  const fontRow = () => {
    const btn = (id, sign, dir) => div().id(`font-${id}`).w(24).h(24).rounded(5).border_1().border_color(t.border).flex().items_center().justify_center()
      .cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => set({ font: fontStep(dir) }, cx)).child(sign);
    return h_flex().items_center().gap(8).child(div().w(70).text_color(t.muted).text_size(11).child("Font size"))
      .child(btn("less", "−", -1)).child(div().w(40).text_center().child(`${cfg.font}px`)).child(btn("more", "+", 1));
  };

  // Where the header's Lazygit button opens lazygit: over the panel's body, or in a big dialog.
  const lazygitRow = () => {
    const option = (id, text, full) => div().id(`lazygit-${id}`).px(8).h(24).rounded(5).flex().items_center().cursor_pointer()
      .border_1().border_color(cfg.lazygitFull === full ? t.foreground : t.border).hover((s) => s.bg(t.hover))
      .text_color(cfg.lazygitFull === full ? t.foreground : t.muted).on_click((_e, cx) => set({ lazygitFull: full }, cx)).child(text);
    return h_flex().items_center().gap(8).child(div().w(70).text_color(t.muted).text_size(11).child("Lazygit"))
      .child(option("panel", "In the panel", false)).child(option("full", "Fullscreen", true));
  };

  // A changed line as it will look: the rest of the line tinted, the changed word stronger.
  const sample = (kind, color, word) => {
    const sign = kind === "+" ? "+" : "−";
    return h_flex().w_full().h(22).px(8).items_center().bg(tint(color, cfg.line))
      .child(div().w(14).text_color(color).child(sign))
      .child(div().child("const n = "))
      .child(div().px(1).bg(tint(color, cfg.word)).child(word))
      .child(div().child(";"));
  };
  const added = addedColor(cfg, t), removed = removedColor(cfg, t);

  return v_flex().size_full().p(14).gap(14).bg(t.popover ?? t.background).text_color(t.foreground).text_size(12)
    .child(h_flex().items_center()
      .child(div().flex_1().font_semibold().child("Diff colors"))
      .child(div().id("cfg-close").w(22).h(22).rounded(5).flex().items_center().justify_center().cursor_pointer().hover((s) => s.bg(t.hover))
        .on_click(() => closeOverlay(props()?.overlay)).child("✕")))
    .child(palette("Added", "added", GREENS, t.ansi2))
    .child(palette("Removed", "removed", REDS, t.ansi1))
    .child(palette("Modified", "modified", AMBERS, t.blocked))
    .child(v_flex().gap(8).child(stepper("Line tint", "line")).child(stepper("Word tint", "word")).child(fontRow()).child(lazygitRow()))
    .child(v_flex().rounded(5).overflow_hidden().border_1().border_color(t.border).child(sample("-", removed, "42")).child(sample("+", added, "43")))
    .child(div().id("cfg-reset").self_start().px(8).py(3).rounded(5).border_1().border_color(t.border).cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { setShared(CFG_KEY, { ...DEFAULTS }); cx.notify(); }).child("Reset"));
}
