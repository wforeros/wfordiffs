// Sizes shared by the code rows and by the estimate of how wide a diff is.
export const NUM_W = 30;  // one line-number gutter (fits three digits)
export const SIGN_W = 12; // the +/- column
// shortcut: 9.6px per character is an estimate of the mono advance at the panel's
// zoom; if a bar shows on a file that fits (or the reverse), tune this number.
export const CHAR_W = 9.6;
// Two number gutters and the sign, plus a little slack.
export const GUTTER_W = NUM_W * 2 + SIGN_W + 4;
