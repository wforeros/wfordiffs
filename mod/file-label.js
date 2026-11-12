// pure: a file path split for showing in a small label: its name, and the folder it is in.

/**
 * @param {string} path a repo-relative path, "/"-separated
 * @returns {{ dir: string, name: string }} dir is "" for a file at the top, else the folders with a trailing "/"
 */
export function fileLabel(path) {
  const at = path.lastIndexOf("/");
  return at < 0 ? { dir: "", name: path } : { dir: path.slice(0, at + 1), name: path.slice(at + 1) };
}
