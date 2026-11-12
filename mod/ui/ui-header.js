// The panel's header: the title, the commit picker's button, how many files, the view toggles and
// the totals. It only draws: the view hands in the values and what each button does.
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { addedColor } from "../diff-colors.js";
import { textButton, iconButton } from "./ui-buttons.js";
import { addedCount, removedCount } from "./ui-counts.js";

const HEADER_H = 42;
const SETTINGS_ICON = "mods/herdr-gitdiff/icons/settings.svg";

// Styles (see AGENTS.md).
const bar = (theme) => (el) => el.h(HEADER_H).flex_none().px(14).gap(8).items_center().border_b(1).border_color(theme.border);
const chip = (theme) => (el) => el.px(5).py(1).rounded(4).border_1().border_color(theme.border).text_size(10).text_color(theme.muted);
const notice = (theme, cfg) => (el) => el.min_w(0).truncate().text_size(10).text_color(addedColor(cfg, theme));

/**
 * @typedef {object} HeaderOptions
 * @property {(n: number) => number} px scales a size at 12px
 * @property {object} cfg the user's colors (config.js)
 * @property {string} revLabel the picker button's text: the commit shown, or "Uncommitted"
 * @property {boolean} hasRev a commit is shown (its label takes the full text color)
 * @property {boolean} menuOpen the commit picker is open
 * @property {number} fileCount
 * @property {string} flash a short message (a copied reference), "" for none
 * @property {{ add: number, del: number }} totals lines added and removed over all the files
 * @property {{ wrap: boolean, side: boolean, tree: boolean }} view the shared toggles
 * @property {boolean} isFull this is the full screen copy (it has no "full" button)
 * @property {(cx: object) => void} onToggleMenu
 * @property {() => void} onOpenSettings
 * @property {(patch: object, cx: object) => void} onSetView patch of { wrap, side, tree }
 * @property {() => void} onOpenFull
 * @property {boolean} lazygit lazygit is installed where the repo is: its button shows
 * @property {(cx: object) => void} onOpenLazygit
 */

/**
 * @param {object} theme
 * @param {HeaderOptions} o
 */
export function header(theme, o) {
  const toggle = (name, label, tooltip) => textButton({
    id: `herdr-gitdiff-${name}`, label, tooltip, active: o.view[name],
    onClick: (_e, cx) => o.onSetView({ [name]: !o.view[name] }, cx) }, theme);
  return bar(theme)(h_flex())
    .child(div().font_semibold().child("Herdr Diffview"))
    .child(textButton({ id: "herdr-gitdiff-rev", bordered: true, active: o.menuOpen, color: o.hasRev ? theme.foreground : theme.muted,
      tooltip: "Uncommitted changes, or what a recent commit changed", label: o.revLabel,
      onClick: (_e, cx) => o.onToggleMenu(cx) }, theme))
    .child(chip(theme)(div()).child(`${o.fileCount} files`))
    .when(!!o.flash, (el) => el.child(notice(theme, o.cfg)(div()).child(o.flash)))
    .child(div().flex_1())
    .child(iconButton({ id: "herdr-gitdiff-config", icon: SETTINGS_ICON, tooltip: "Diff colors", onClick: o.onOpenSettings }, theme))
    // Only where lazygit is installed (lazygit.js); it opens lazygit in the repo.
    .when(o.lazygit, (el) => el.child(textButton({ id: "herdr-gitdiff-lazygit", label: "Lazygit",
      tooltip: "Open lazygit in this repo", onClick: (_e, cx) => o.onOpenLazygit(cx) }, theme)))
    .child(toggle("wrap", "wrap"))
    .child(toggle("side", "split", "Before on the left, after on the right"))
    .child(toggle("tree", "tree", "Show the changed folders as a tree, on the right"))
    // Not in the full screen copy itself: it is full screen already.
    .child(o.isFull ? div() : textButton({ id: "herdr-gitdiff-full", label: "full",
      tooltip: "Open full screen (shortcut: herdr-gitdiff.fullscreen)", onClick: o.onOpenFull }, theme))
    .child(addedCount(o.totals.add, theme, o.cfg, o.px))
    .child(removedCount(o.totals.del, theme, o.cfg, o.px));
}
