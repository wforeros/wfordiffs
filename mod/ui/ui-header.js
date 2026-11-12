// The panel's header: the title, the commit picker's button, how many files, the view toggles and
// the totals. It only draws: the view hands in the values and what each button does.
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { addedColor } from "../diff-colors.js";
import { textButton, iconButton } from "./ui-buttons.js";
import { addedCount, removedCount } from "./ui-counts.js";

const HEADER_H = 42;
const icon = (name) => `mods/wfordiffs/icons/${name}.svg`;

// Styles (see AGENTS.md).
const bar = (theme) => (el) => el.h(HEADER_H).flex_none().px(14).gap(8).items_center().border_b(1).border_color(theme.border);
const chip = (theme) => (el) => el.px(5).py(1).rounded(4).border_1().border_color(theme.border).text_size(10).text_color(theme.muted);
const notice = (theme, cfg) => (el) => el.min_w(0).truncate().text_size(10).text_color(addedColor(cfg, theme));

/**
 * @typedef {object} HeaderOptions
 * @property {(n: number) => number} px scales a size at 12px
 * @property {object} cfg the user's colors (config.js)
 * @property {string} revLabel the picker button's text: the commit or branch shown, or "Uncommitted"
 * @property {boolean} hasRev a commit is shown (its label takes the full text color)
 * @property {boolean} menuOpen the commit picker is open
 * @property {number} fileCount
 * @property {string} flash a short message (a copied reference), "" for none
 * @property {{ add: number, del: number }} totals lines added and removed over all the files
 * @property {{ wrap: boolean, side: boolean, tree: boolean }} view the shared toggles
 * @property {boolean} isFull this is the full screen copy (it has no "full" button)
 * @property {(cx: object) => void} onExpandAll open every file's diff
 * @property {(cx: object) => void} onCollapseAll close them all
 * @property {(cx: object) => void} onToggleMenu
 * @property {() => void} onOpenSettings
 * @property {(patch: object, cx: object) => void} onSetView patch of { wrap, side, tree }
 * @property {() => void} onOpenFull
 * @property {boolean} lazygit lazygit is installed where the repo is: its button shows
 * @property {boolean} lazygitOn lazygit is up over the panel: its button is lit, and a click closes it
 * @property {(cx: object) => void} onToggleLazygit opens lazygit, or closes it when it is up
 */

/**
 * @param {object} theme
 * @param {HeaderOptions} o
 */
export function header(theme, o) {
  const toggle = (name, iconName, tooltip) => iconButton({
    id: `wfordiffs-${name}`, icon: icon(iconName), tooltip, active: o.view[name],
    onClick: (_e, cx) => o.onSetView({ [name]: !o.view[name] }, cx) }, theme);
  return bar(theme)(h_flex())
    .child(div().font_semibold().child("WForDiffs"))
    .child(textButton({ id: "wfordiffs-rev", bordered: true, active: o.menuOpen, color: o.hasRev ? theme.foreground : theme.muted,
      tooltip: "Uncommitted changes, what this branch adds to another, or what a commit changed", label: o.revLabel,
      onClick: (_e, cx) => o.onToggleMenu(cx) }, theme))
    .child(chip(theme)(div()).child(`${o.fileCount} files`))
    .when(!!o.flash, (el) => el.child(notice(theme, o.cfg)(div()).child(o.flash)))
    .child(div().flex_1())
    // Only where lazygit is installed (lazygit.js); it opens lazygit in the repo, and while it is up it closes it.
    .when(o.lazygit, (el) => el.child(iconButton({ id: "wfordiffs-lazygit", icon: icon("lazygit"),
      active: o.lazygitOn, tooltip: o.lazygitOn ? "Close lazygit" : "Open lazygit in this repo",
      onClick: (_e, cx) => o.onToggleLazygit(cx) }, theme)))
    .child(iconButton({ id: "wfordiffs-expand", icon: icon("expand"), tooltip: "Expand all diffs",
      onClick: (_e, cx) => o.onExpandAll(cx) }, theme))
    .child(iconButton({ id: "wfordiffs-collapse", icon: icon("collapse"), tooltip: "Collapse all diffs",
      onClick: (_e, cx) => o.onCollapseAll(cx) }, theme))
    .child(toggle("wrap", "wrap", "Wrap long lines"))
    .child(toggle("side", "split", "Split: before on the left, after on the right"))
    .child(toggle("tree", "tree", "Tree: show the changed folders as a tree, on the right"))
    // Not in the full screen copy itself: it is full screen already.
    .child(o.isFull ? div() : iconButton({ id: "wfordiffs-full", icon: icon("fullscreen"),
      tooltip: "Open full screen (shortcut: wfordiffs.fullscreen)", onClick: o.onOpenFull }, theme))
    .child(iconButton({ id: "wfordiffs-config", icon: icon("settings"), tooltip: "Diff colors", onClick: o.onOpenSettings }, theme))
    .child(addedCount(o.totals.add, theme, o.cfg, o.px))
    .child(removedCount(o.totals.del, theme, o.cfg, o.px));
}
