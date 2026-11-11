// Turns a selection of diff rows into the message sent to an agent. Pure: no Herdr imports.

// The line a row stands for: new-file number for "+" and context rows, old-file number for "-".
const lineOf = (row) => (row.kind === "-" ? row.o : row.n);

// Rows from..to (either order), without hunk headers.
export function selectedRows(rows, from, to) {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return rows.slice(a, b + 1).filter((r) => r.kind !== "@");
}

// "path:12-14" (new-file lines; old-file lines are marked "was ..." when the range has only deletions).
export function reference(path, picked) {
  const news = picked.filter((r) => r.kind !== "-").map(lineOf);
  if (news.length) {
    const lo = Math.min(...news), hi = Math.max(...news);
    return `${path}:${lo === hi ? lo : `${lo}-${hi}`}`;
  }
  const olds = picked.map(lineOf);
  const lo = Math.min(...olds), hi = Math.max(...olds);
  return `${path} (removed, was line${lo === hi ? ` ${lo}` : `s ${lo}-${hi}`})`;
}

// The text for the agent: where, the code with its diff marks, then the person's words.
export function buildMessage(path, picked, note) {
  const code = picked.map((r) => `${r.kind === " " ? " " : r.kind}${r.text}`).join("\n");
  return `${reference(path, picked)}\n\`\`\`diff\n${code}\n\`\`\`\n${note.trim()}`;
}
