// Highlighting with bat: whole-file colors, so multi-line strings and comments come out right.
// makeHighlighter takes exec and settings from herdr; attachColors is pure.
import { EMPTY_TREE } from "./parse.js";
import { parseAnsi } from "./ansi.js";

// The core on wsl starts with a minimal PATH (no linuxbrew), so the usual spots are tried in turn.
// shortcut: bat is the only colorer; without it the built-in lexer (js, py, sh) is used.
const BAT = ["bat", "batcat", "/home/linuxbrew/.linuxbrew/bin/bat", "/usr/bin/bat", "/usr/bin/batcat"];

export function makeHighlighter({ exec, settings }) {
  // bat's path on this machine, looked up once per machine ("" when there's none).
  // Cache the promise, not the answer: several diffs ask at once.
  const batCache = {};
  function batFor(on) {
    const key = on ?? "";
    return (batCache[key] ??= (async () => {
      for (const bin of BAT) {
        try {
          const r = await exec(bin, ["--version"], { on });
          if (r.code === 0) return bin;
        } catch { /* not on this PATH */ }
      }
      return "";
    })());
  }

  // Colored lines of the new file and of the HEAD file, as bat sees them whole (multi-line strings and comments right).
  async function highlight(loc, f, base) {
    const bat = await batFor(loc.on);
    if (!bat) return null;
    const theme = settings().dark === false ? "Catppuccin Latte" : "Catppuccin Mocha";
    const out = {};
    // COLORTERM: without it bat paints 256-colour codes, not the theme's exact colors.
    if (f.status !== "D") {
      const r = await exec("sh", ["-c", 'COLORTERM=truecolor exec "$@"', "sh", bat, "--color=always", "-pp", "--tabs=4", "--wrap=never", "--theme", theme, "--", f.path], { cwd: loc.cwd, on: loc.on });
      if (r.code === 0) out.new = parseAnsi(r.stdout);
    }
    if (!f.untracked && f.status !== "A" && base !== EMPTY_TREE) {
      const r = await exec("sh", ["-c", 'git --no-optional-locks show "$1" | COLORTERM=truecolor "$2" --color=always -pp --tabs=4 --wrap=never --theme "$3" --file-name "$4"', "sh", `HEAD:${f.path}`, bat, theme, f.path], { cwd: loc.cwd, on: loc.on });
      if (r.code === 0) out.old = parseAnsi(r.stdout);
    }
    return out;
  }
  return { highlight };
}

// Puts bat's colors on each row, and only when bat's text is the row's text (else the lexer draws it).
export function attachColors(rows, hl) {
  if (!hl) return;
  for (const r of rows) {
    if (r.kind === "@") continue;
    const side = r.kind === "-" ? hl.old : hl.new, line = r.kind === "-" ? r.o : r.n;
    const pieces = side?.[line - 1];
    if (pieces && pieces.map((p) => p[0]).join("") === r.text) r.pieces = pieces;
  }
}
