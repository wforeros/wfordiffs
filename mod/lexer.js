// Fallback syntax lexer, used when bat is not installed. Pure: no Herdr imports.

// Syntax: one line at a time, so block comments and multi-line strings stay plain.
// This is the fallback when bat isn't installed, not the main highlighter.
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
