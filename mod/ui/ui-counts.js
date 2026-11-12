// The "+N" and "−N" counts of a file row and of the header, and the "binary" that stands for them
// when a file has no lines to count. One size and the user's colors (diff-colors.js) in one place.
import { div } from "gpui-kit";
import { addedColor, removedColor } from "../diff-colors.js";

const COUNT_SIZE = 11; // px at the panel's 12px base

/**
 * @param {number} n lines added
 * @param {object} theme
 * @param {import("./diff-colors.js").ColorChoice} cfg
 * @param {(n: number) => number} px scales a size at 12px
 */
export const addedCount = (n, theme, cfg, px) =>
  div().text_size(px(COUNT_SIZE)).text_color(addedColor(cfg, theme)).child(`+${n}`);

/**
 * @param {number} n lines removed
 * @param {object} theme
 * @param {import("./diff-colors.js").ColorChoice} cfg
 * @param {(n: number) => number} px scales a size at 12px
 */
export const removedCount = (n, theme, cfg, px) =>
  div().text_size(px(COUNT_SIZE)).text_color(removedColor(cfg, theme)).child(`−${n}`);

/** What a binary file shows where the counts would be. */
export const binaryLabel = (theme, px) => div().text_size(px(COUNT_SIZE)).text_color(theme.dim).child("binary");
