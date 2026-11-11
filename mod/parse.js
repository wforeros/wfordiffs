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
