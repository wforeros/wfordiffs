// Git output parsing: numstat, name-status and unified diff rows. Pure: no Herdr imports.

export const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"; // diffs a repo with no commits

export const records = (text) => text.split("\0").filter(Boolean);

// `git diff --numstat -z --no-renames` -> [{ path, add, del, binary }]
export function parseNumstat(text) {
  return records(text).map((rec) => {
    const [a, d, ...p] = rec.split("\t");
    return { path: p.join("\t"), add: +a || 0, del: +d || 0, binary: a === "-" };
  });
}

// `git diff --name-status -z --no-renames` -> { path: "M" | "A" | "D" | "U" ... }
export function parseNameStatus(text) {
  const st = records(text), status = {};
  for (let i = 0; i + 1 < st.length; i += 2) status[st[i + 1]] = st[i][0];
  return status;
}

// A block of changes: a run of consecutive changed rows (the "+" and "-" lines, or the split view's pairs
// that hold them). Returns copies: each changed row gets its block's number (blk), and the first row of
// a block gets first: true. Any other row (a context line, a hunk header) ends the run.
/**
 * @param {object[]} rows a file's diff rows (or a split view's pairs, with `changed` for them)
 * @param {(row: object) => boolean} [changed] which rows change (the list's "+" and "-" by default)
 * @returns {object[]} copies of the rows: blk on each changed row, and first on a block's first row
 */
export function numberBlocks(rows, changed = (r) => r.kind === "+" || r.kind === "-") {
  let n = -1, inRun = false;
  return rows.map((r) => {
    if (!changed(r)) { inRun = false; return r; }
    if (!inRun) { n++; inRun = true; return { ...r, blk: n, first: true }; }
    return { ...r, blk: n };
  });
}

// Unified diff text -> rows: "@" headers, "+", "-" and " " lines with their numbers.
export function parseDiff(text) {
  const out = [];
  let o = 0, n = 0, inHunk = false;
  for (const line of text.split("\n")) {
    const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (h) { inHunk = true; o = +h[1]; n = +h[2]; out.push({ kind: "@", text: line }); continue; }
    if (!inHunk || line.startsWith("\\")) continue;
    const body = line.slice(1).replace(/\t/g, "    ");
    if (line[0] === "+") out.push({ kind: "+", text: body, n: n++ });
    else if (line[0] === "-") out.push({ kind: "-", text: body, o: o++ });
    else if (line[0] === " ") out.push({ kind: " ", text: body, o: o++, n: n++ });
  }
  return out;
}
