// pure: the selection of diff lines to reference (ask.js turns the picked rows into the text).
// The view keeps the selection, and whether the mouse is still down.

/**
 * @typedef {object} Selection
 * @property {string} path the file
 * @property {number} from  row index of that file's diff where the press began
 * @property {number} to    row index where the mouse is now (can be above `from`)
 */

/**
 * Is row `index` of file `path` inside the selection?
 * @param {Selection|null} sel
 * @param {string} path
 * @param {number} index
 * @returns {boolean}
 */
export function isPicked(sel, path, index) {
  if (!sel || sel.path !== path) return false;
  return index >= Math.min(sel.from, sel.to) && index <= Math.max(sel.from, sel.to);
}

/**
 * A press on a row's "+". On a selected row it clears the selection; on any other it starts a new
 * one there, which stays open to extend while the mouse is down.
 * @param {Selection|null} sel
 * @param {string} path
 * @param {number} index
 * @returns {{ sel: Selection|null, dragging: boolean, cleared: boolean }}
 */
export function pressRow(sel, path, index) {
  if (isPicked(sel, path, index)) return { sel: null, dragging: false, cleared: true };
  return { sel: { path, from: index, to: index }, dragging: true, cleared: false };
}

/**
 * The mouse moved over row `index` of `path` while dragging: the selection reaches it, if it is
 * in the same file. Rows of another file leave it as it is.
 * @param {Selection|null} sel
 * @param {string} path
 * @param {number} index
 * @returns {Selection|null}
 */
export function extendTo(sel, path, index) {
  if (!sel || sel.path !== path) return sel;
  return { ...sel, to: index };
}
