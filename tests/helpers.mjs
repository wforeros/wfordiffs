// Shared by the tests: a scratch git repo, and an exec/readTextFile shaped like herdr's, over node.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const git = (cwd, ...args) =>
  execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", maxBuffer: 1e8 });

export function scratchRepo() {
  const dir = mkdtempSync(join(tmpdir(), "gitdiff-"));
  git(dir, "init", "-q");
  return dir;
}
export const write = (dir, name, text) => writeFileSync(join(dir, name), text);

export async function exec(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: opts.cwd, encoding: "utf8", maxBuffer: 1e8 });
  if (r.error) throw r.error;
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
export async function readTextFile(path) {
  try { return readFileSync(path, "utf8"); } catch { return null; }
}
export const batBin = ["bat", "batcat"].find((b) => spawnSync(b, ["--version"]).status === 0);
