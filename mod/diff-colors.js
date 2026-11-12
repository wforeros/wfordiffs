// pure: which color a change gets. The user's choice (cfg, from the gear window) wins;
// otherwise the theme's own colors. One place for a rule the rows, the header and the gear window share.

/**
 * @typedef {object} ColorChoice the user's colors from the gear window (config.js parseConfig)
 * @property {string} [added]
 * @property {string} [removed]
 * @property {string} [modified]
 */

export const addedColor = (cfg, theme) => cfg.added ?? theme.ansi2;
export const removedColor = (cfg, theme) => cfg.removed ?? theme.ansi1;
export const modifiedColor = (cfg, theme) => cfg.modified ?? theme.blocked;

/**
 * A diff line's kind -> its color.
 * @param {string|undefined} kind "+", "-", or anything else for a context line
 * @param {ColorChoice} cfg
 * @param {object} theme
 * @returns {string|null} null for a context line
 */
export function lineColor(kind, cfg, theme) {
  if (kind === "+") return addedColor(cfg, theme);
  if (kind === "-") return removedColor(cfg, theme);
  return null;
}

/**
 * A file's status -> its color.
 * @param {string|undefined} status "A" added, "D" deleted, anything else a modification
 * @param {ColorChoice} cfg
 * @param {object} theme
 * @returns {string}
 */
export function statusColor(status, cfg, theme) {
  if (status === "A") return addedColor(cfg, theme);
  if (status === "D") return removedColor(cfg, theme);
  return modifiedColor(cfg, theme);
}
