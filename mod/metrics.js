// Sizes shared by the code rows and by the estimate of how wide a diff is.
export const NUM_W = 30;  // one line-number gutter (fits three digits)
export const ADD_W = 16;  // the "+" that starts a selection, after the numbers
export const PAD_L = 10;  // the inset before the numbers: the file row's chevron sits at it too
// shortcut: 9.6px per character is an estimate of the mono advance at the panel's
// zoom; if a bar shows on a file that fits (or the reverse), tune this number.
export const CHAR_W = 9.6;
// The inset, the "+", two number gutters, plus a little slack.
export const GUTTER_W = PAD_L + ADD_W + NUM_W * 2 + 4;
