// pure: the divider between the list and the tree. Dragging it to the right makes the list wider,
// so the tree's share of the body smaller.

/**
 * The tree's new share of the body, kept between min and max.
 * @param {{ x: number, start: number }} drag where the press happened (px) and the share it started from
 * @param {number} x the mouse now, in px
 * @param {number} bodyW the body's width, in px
 * @param {number} min smallest share (0..1)
 * @param {number} max largest share (0..1)
 * @returns {number} the share, 0..1
 */
export function draggedShare(drag, x, bodyW, min, max) {
  const share = drag.start - (x - drag.x) / bodyW;
  return Math.min(max, Math.max(min, share));
}
