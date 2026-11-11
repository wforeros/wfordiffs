// The changed files as a tree: only the folders that hold a change, then the files in them.
// Pure: no Herdr imports.

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// files -> display rows, in order. Rows:
//   folder: { kind: "dir", name, path, depth, open, through, hangs }
//   file:   { kind: "file", file, name, depth, through }
// through: one flag per folder above the row (columns 0..depth-1): true when that folder's line
// runs down past this row, false when this is the last row under that folder (the line stops at
// the middle of the row). hangs: a folder with rows under it, whose line starts at its own chevron.
// rootName: the folder the whole tree hangs from, as a first row at depth 0 (null: no such row).
// folded: the paths of the folders that are collapsed; their contents are not listed (their row is).
// Folders come before the files of the same folder, both sorted by name.
export function treeRows(files, rootName = null, folded = new Set()) {
  const root = { dirs: new Map(), files: [] };
  for (const file of files) {
    const parts = file.path.split("/"), name = parts.pop();
    let node = root;
    for (const [i, part] of parts.entries()) {
      if (!node.dirs.has(part)) node.dirs.set(part, { name: part, path: parts.slice(0, i + 1).join("/"), dirs: new Map(), files: [] });
      node = node.dirs.get(part);
    }
    node.files.push({ file, name });
  }
  const out = [];
  // `parents`: the folder rows above a row, for the lines (dropped from the result below).
  // `depth`: the depth of this node's children.
  const walk = (node, depth, parents) => {
    const kids = [
      ...[...node.dirs.values()].sort((a, b) => byName(a.name, b.name)).map((d) => ({ dir: d })),
      ...[...node.files].sort((a, b) => byName(a.name, b.name)).map((f) => ({ file: f.file, name: f.name })),
    ];
    for (const k of kids) {
      if (k.dir) {
        const d = k.dir, row = { kind: "dir", name: d.name, path: d.path, depth, open: !folded.has(d.path), parents };
        out.push(row);
        if (row.open) walk(d, depth + 1, [...parents, row]);
      } else out.push({ kind: "file", file: k.file, name: k.name, depth, parents });
    }
  };
  if (rootName === null) walk(root, 0, []);
  else {
    const row = { kind: "dir", name: rootName, path: "", depth: 0, open: !folded.has(""), parents: [] };
    out.push(row);
    if (row.open) walk(root, 1, [row]);
  }
  // The last row under each folder: that folder's line stops there.
  const lastOf = new Map();
  for (const r of out) for (const p of r.parents) lastOf.set(p, r);
  return out.map((row) => {
    const { parents, ...r } = row; // compared by the row itself, not the copy
    return {
      ...r,
      through: parents.map((p) => lastOf.get(p) !== row),
      ...(r.kind === "dir" ? { hangs: lastOf.has(row) } : {}),
    };
  });
}
