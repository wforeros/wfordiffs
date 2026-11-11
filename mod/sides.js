// A diff's rows as a side-by-side view: the old file on the left, the new one on the right. Pure: no Herdr imports.
// A context line shows on both sides. A run of "-" rows followed by a run of "+" rows is paired
// line by line; the side that runs out first is left empty. "@" headers pass through whole.
// Output rows: { kind: "pair", left, right } (left/right: the original row, or null), or the "@" row.
export function pairSides(rows) {
  const out = [];
  let i = 0;
  while (i < rows.length) {
    const r = rows[i];
    if (r.kind === "@" || r.kind === " ") {
      out.push(r.kind === "@" ? r : { kind: "pair", left: r, right: r });
      i++;
      continue;
    }
    if (r.kind !== "-" && r.kind !== "+") { i++; continue; } // not a diff line: nothing to show
    // A change: the removed lines, then the added ones (either run may be empty).
    const minus = [], plus = [];
    while (i < rows.length && rows[i].kind === "-") minus.push(rows[i++]);
    while (i < rows.length && rows[i].kind === "+") plus.push(rows[i++]);
    const n = Math.max(minus.length, plus.length);
    for (let k = 0; k < n; k++) out.push({ kind: "pair", left: minus[k] ?? null, right: plus[k] ?? null });
  }
  return out;
}
