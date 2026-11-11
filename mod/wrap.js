// Wrap mode's line breaks for text with no gap in it. Pure: no Herdr imports.
// The rows break between their pieces (flex items), so a word longer than the row has no
// break in it and runs off to the right. Such a word is cut into chunks that fit a line.
import { CHAR_W, GUTTER_W } from "./metrics.js";

// Most characters one line of code can hold at this zoom (k), in a panel `viewport` wide.
// shortcut: a margin of two characters for the estimate; a chunk is never wider than a line.
export function wrapChars(viewport, k) {
  const room = (viewport || 320) - GUTTER_W * k;
  return Math.max(8, Math.floor(room / (CHAR_W * k)) - 2);
}

// [text, color, marked] pieces -> the same pieces, with each run of non-space text longer
// than `max` cut into chunks of at most `max` characters (colour and mark kept).
export function breakRuns(pieces, max) {
  const out = [];
  for (const [s, c, hit] of pieces) {
    for (const run of s.match(/\s+|\S+/g) ?? []) {
      if (/\s/.test(run) || run.length <= max) { out.push([run, c, hit]); continue; }
      for (let i = 0; i < run.length; i += max) out.push([run.slice(i, i + max), c, hit]);
    }
  }
  return out;
}
