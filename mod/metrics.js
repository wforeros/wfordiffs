// Sizes shared by the rows and by the estimate of how wide a diff is. Pixels at the panel's 12px
// base: the view scales them with its font (px()).
export const NUM_W = 30;  // one line-number gutter (fits three digits)
export const ADD_W = 16;  // the "+" that starts a selection, after the numbers
export const PAD_L = 10;  // the inset before the numbers: the file row's chevron sits at it too
// shortcut: 9.6px per character is an estimate of the mono advance at the panel's
// zoom; if a bar shows on a file that fits (or the reverse), tune this number.
export const CHAR_W = 9.6;
// The inset, the "+", two number gutters, plus a little slack.
export const GUTTER_W = PAD_L + ADD_W + NUM_W * 2 + 4;

// Row heights, GitHub-like: a file row is tall, with its name larger and bold, so the files
// stand out from the lines of their diffs; a line of code has room above and below it.
export const FILE_H = 36, LINE_H = 26, FILE_NAME = 13;
// A hunk header, and the Before/After row of the split view: grey bands, shorter than a line of code.
export const HUNK_H = 22;
// How far each level of the tree is pushed right. A row's first SLOT px are its chevron (a file in
// the tree has an empty slot); its guide lines run through the middle of those.
export const INDENT = 14, SLOT = 12;
// The split view's hatching gray is the dim text color darkened by this factor (config.js shade).
export const HATCH_SHADE = 0.6;
