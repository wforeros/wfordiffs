// Pure helpers for gitdiff: git output parsing, the diff rows and a small
// per-line syntax lexer. No Herdr imports, so tests/ can run them under node.

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

// Syntax: one line at a time, so block comments and multi-line strings stay plain.
// shortcut: no real grammar (keywords, strings, comments, numbers, calls only); upgrade to a tree-sitter lexer if it misreads.
const LANGS = {
  js: ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"],
  py: ["py"],
  sh: ["sh", "bash", "zsh"],
};
const KEYWORDS = {
  js: "const let var function return if else for while do switch case break continue class extends new this super import export from default async await try catch finally throw typeof instanceof in of true false null undefined type interface enum implements",
  py: "def class return if elif else for while in not and or is None True False with as try except finally raise lambda yield pass break continue global nonlocal async await import from self",
  sh: "if then else elif fi for do done case esac while function export local return in",
};

export function langOf(path) {
  const ext = path.includes(".") ? path.split(".").pop().toLowerCase() : "";
  return Object.keys(LANGS).find((lang) => LANGS[lang].includes(ext)) ?? null;
}

const lexers = {};
function lexer(lang) {
  if (lexers[lang]) return lexers[lang];
  const comment = lang === "js" ? "\\/\\/.*" : "#.*";
  const parts = [
    `(?<c>${comment})`,
    `(?<s>"(?:\\\\.|[^"\\\\])*"?|'(?:\\\\.|[^'\\\\])*'?|\`(?:\\\\.|[^\`\\\\])*\`?)`,
    `(?<n>\\b\\d[\\w.]*)`,
    `(?<f>[A-Za-z_$][\\w$]*(?=\\s*\\())`,
    `(?<w>[A-Za-z_$][\\w$]*)`,
  ];
  const kw = new Set((KEYWORDS[lang] ?? "").split(" "));
  return (lexers[lang] = { re: new RegExp(parts.join("|"), "g"), kw });
}

// [text, color] pieces for one line; a null color means the default foreground.
// colors: { dim, ansi1 (numbers), ansi2 (strings), ansi4 (calls), ansi5 (keywords) }
export function tokens(text, lang, colors) {
  if (!lang) return [[text, null]];
  const { re, kw } = lexer(lang), out = [];
  const c = colors;
  let last = 0, m;
  re.lastIndex = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push([text.slice(last, m.index), null]);
    const g = m.groups, s = m[0];
    const color = g.c ? c.dim : g.s ? c.ansi2 : g.n ? c.ansi1 : g.f ? c.ansi4 : kw.has(s) ? c.ansi5 : null;
    out.push([s, color]);
    last = m.index + s.length;
  }
  if (last < text.length) out.push([text.slice(last), null]);
  return out;
}
