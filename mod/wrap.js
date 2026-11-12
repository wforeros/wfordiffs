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

// [text, color, marked] pieces -> pieces the wrapped row lays out as flex items. Neighbours with the same
// colour and mark are joined, so the text is laid out in long runs (one word and one space per item made
// the glyphs and the gaps between them look different from the unwrapped row). A run longer than `max`
// is split at its spaces into chunks of at most `max` characters; a word longer than that is cut.
export function breakRuns(pieces, max) {
  const runs = [];
  for (const [s, c, hit] of pieces) {
    if (!s) continue;
    const last = runs.at(-1);
    if (last && last[1] === c && last[2] === hit) last[0] += s;
    else runs.push([s, c, hit]);
  }
  const out = [];
  for (const [s, c, hit] of runs) {
    if (s.length <= max) { out.push([s, c, hit]); continue; }
    let cur = "";
    for (const word of s.match(/\s+|\S+/g) ?? []) {
      if (word.length > max) {
        if (cur) { out.push([cur, c, hit]); cur = ""; }
        for (let i = 0; i < word.length; i += max) out.push([word.slice(i, i + max), c, hit]);
        continue;
      }
      if (cur && cur.length + word.length > max) { out.push([cur, c, hit]); cur = ""; }
      cur += word;
    }
    if (cur) out.push([cur, c, hit]);
  }
  return out;
}

// A line's indentation, split off its first piece: { indent, runs } with the runs starting at the first text.
// The wrapped row lays its pieces out as flex items, and a long first piece cannot share a flex line with a
// separate indentation item: it moves to the next line and leaves the first one blank. The row draws the
// indentation and the first piece as one item instead. A line of only whitespace has no text to attach it to.
export function splitIndent(runs) {
  const [first, ...rest] = runs;
  const indent = first?.[0].match(/^\s+/)?.[0];
  if (!indent) return { indent: "", runs };
  const text = first[0].slice(indent.length);
  if (text) return { indent, runs: [[text, first[1], first[2]], ...rest] };
  return rest.length ? { indent, runs: rest } : { indent: "", runs };
}
