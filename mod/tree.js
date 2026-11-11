// The changed files as a tree: only the folders that hold a change, then the files in them.
// Pure: no Herdr imports.

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// files -> display rows, in order. Each row has its depth, whether it is the last of its
// siblings (`last`), and `guides`: for each ancestor at depth 1..depth-1, whether that ancestor
// has later siblings (so a guide line runs past this row). A folder row:
// { kind: "dir", name, path, depth, add, del, guides, last } (add and del are the totals of every
// change below it). A file row: { kind: "file", file, name, depth, guides, last }.
// rootName: the folder the whole tree hangs from, as a first row at depth 0 (null: no such row).
// Folders come before the files of the same folder, both sorted by name.
// shortcut: folders are not collapsible; every folder with a change is shown.
export function treeRows(files, rootName = null) {
  const root = { dirs: new Map(), files: [], add: 0, del: 0 };
  for (const file of files) {
    const parts = file.path.split("/"), name = parts.pop();
    let node = root;
    node.add += file.add; node.del += file.del;
    for (const [i, part] of parts.entries()) {
      if (!node.dirs.has(part)) node.dirs.set(part, { name: part, path: parts.slice(0, i + 1).join("/"), dirs: new Map(), files: [], add: 0, del: 0 });
      node = node.dirs.get(part);
      node.add += file.add; node.del += file.del;
    }
    node.files.push({ file, name });
  }
  const out = [];
  // `depth`: the depth of this node's children; `guides`: the ancestors' flags, for those children.
  const walk = (node, depth, guides) => {
    const kids = [
      ...[...node.dirs.values()].sort((a, b) => byName(a.name, b.name)).map((d) => ({ dir: d })),
      ...[...node.files].sort((a, b) => byName(a.name, b.name)).map((f) => ({ file: f.file, name: f.name })),
    ];
    kids.forEach((k, i) => {
      const last = i === kids.length - 1;
      if (k.dir) {
        const d = k.dir;
        out.push({ kind: "dir", name: d.name, path: d.path, depth, add: d.add, del: d.del, guides, last });
        walk(d, depth + 1, [...guides, !last]);
      } else out.push({ kind: "file", file: k.file, name: k.name, depth, guides, last });
    });
  };
  if (rootName === null) walk(root, 0, []);
  else {
    out.push({ kind: "dir", name: rootName, path: "", depth: 0, add: root.add, del: root.del, guides: [], last: true });
    walk(root, 1, []);
  }
  return out;
}
