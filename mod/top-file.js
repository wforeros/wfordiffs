// pure: which file is at the top of the list, from where one of its elements sits.
// The kit does not report the scroll position, but a wheel event carries the box of the element under the
// pointer and of the list, so the file at the top is found by walking up from that element.

/**
 * @param {string[]} paths the files in list order
 * @param {number} hit index of the file whose element is under the pointer
 * @param {number} gap px from the list's top edge down to where that file starts; <= 0 when it starts above
 * @param {(index: number) => number} heightOf the whole height of a file in px (its row, plus its diff when open),
 *   an estimate; asked only for the files the walk passes, so a start near the top costs nothing for the rest
 * @returns {string} the path of the file that covers the list's top edge
 */
export function topFile(paths, hit, gap, heightOf) {
  let i = hit;
  while (gap > 0 && i > 0) {
    i -= 1;
    gap -= heightOf(i);
  }
  return paths[i];
}
