// Word-level marks inside a changed line. Pure: no Herdr imports.
// A run of "-" rows followed by "+" rows is paired in order; each pair is diffed by token
// (words, spaces, punctuation) and the tokens that differ become row.marks = [[start, end], ...]
// (character offsets in row.text). A pair that shares almost nothing gets no marks: the whole
// line is already the change.
const TOKEN = /\w+|\s+|[^\w\s]/g;
const MAX_TOKENS = 400; // shortcut: LCS is quadratic; longer lines (minified) skip the marks.

const tokenize = (text) => {
  const out = [];
  for (const m of text.matchAll(TOKEN)) out.push([m.index, m.index + m[0].length, m[0]]);
  return out;
};

// Ranges of `a` and of `b` that are not in their longest common token subsequence.
export function diffRanges(a, b) {
  const ta = tokenize(a), tb = tokenize(b);
  if (ta.length > MAX_TOKENS || tb.length > MAX_TOKENS) return null;
  const w = tb.length + 1, L = new Uint16Array((ta.length + 1) * w);
  for (let i = ta.length - 1; i >= 0; i--)
    for (let j = tb.length - 1; j >= 0; j--)
      L[i * w + j] = ta[i][2] === tb[j][2] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
  const ra = [], rb = [];
  let i = 0, j = 0, kept = 0;
  while (i < ta.length && j < tb.length) {
    if (ta[i][2] === tb[j][2]) { kept += ta[i][1] - ta[i][0]; i++; j++; }
    else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) ra.push([ta[i][0], ta[i++][1]]);
    else rb.push([tb[j][0], tb[j++][1]]);
  }
  while (i < ta.length) ra.push([ta[i][0], ta[i++][1]]);
  while (j < tb.length) rb.push([tb[j][0], tb[j++][1]]);
  return { a: merge(ra), b: merge(rb), kept };
}

function merge(ranges) {
  const out = [];
  for (const [s, e] of ranges) {
    if (out.length && out.at(-1)[1] === s) out.at(-1)[1] = e;
    else out.push([s, e]);
  }
  return out;
}

export function markWords(rows) {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].kind !== "-") continue;
    let j = i; while (rows[j]?.kind === "-") j++;
    let k = j; while (rows[k]?.kind === "+") k++;
    for (let n = 0; n < Math.min(j - i, k - j); n++) {
      const del = rows[i + n], add = rows[j + n];
      const d = diffRanges(del.text, add.text);
      if (!d) continue;
      // Less than a third in common: not an edit of the same line.
      if (d.kept * 3 < Math.min(del.text.length, add.text.length) || d.kept === 0) continue;
      if (d.a.length) del.marks = d.a;
      if (d.b.length) add.marks = d.b;
    }
    i = k - 1;
  }
}

// Cuts [text, color] pieces at the mark boundaries -> [text, color, marked].
export function splitMarks(pieces, marks) {
  if (!marks?.length) return pieces.map(([s, c]) => [s, c, false]);
  const out = [];
  let pos = 0;
  for (const [s, c] of pieces) {
    const end = pos + s.length;
    let at = pos;
    for (const [ms, me] of marks) {
      if (me <= at || ms >= end) continue;
      const from = Math.max(ms, at), to = Math.min(me, end);
      if (from > at) out.push([s.slice(at - pos, from - pos), c, false]);
      out.push([s.slice(from - pos, to - pos), c, true]);
      at = to;
    }
    if (at < end) out.push([s.slice(at - pos), c, false]);
    pos = end;
  }
  return out;
}
