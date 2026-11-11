// Turns a selection of diff rows into a reference to paste in the chat. Pure: no Herdr imports.

// The line a row stands for: new-file number for "+" and context rows, old-file number for "-".
const lineOf = (row) => (row.kind === "-" ? row.o : row.n);

// Rows from..to (either order), without hunk headers.
export function selectedRows(rows, from, to) {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return rows.slice(a, b + 1).filter((r) => r.kind !== "@");
}

// "<full path>#L12" or "<full path>#L12-L14". New-file lines; a selection of only
// deleted lines falls back to their old-file numbers.
export function reference(fullPath, picked) {
  const news = picked.filter((r) => r.kind !== "-").map(lineOf);
  const lines = news.length ? news : picked.map(lineOf);
  const lo = Math.min(...lines), hi = Math.max(...lines);
  return `${fullPath}#L${lo}${hi === lo ? "" : `-L${hi}`}`;
}
