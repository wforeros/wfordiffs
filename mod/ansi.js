// bat's ANSI output -> colored pieces per line. Pure: no Herdr imports.

// xterm 256-colour index -> hex; the 16 system colours are left to the terminal (null).
export function xterm256(n) {
  if (n < 16) return null;
  if (n >= 232) { const g = (8 + (n - 232) * 10).toString(16).padStart(2, "0"); return `#${g}${g}${g}`; }
  const level = [0, 95, 135, 175, 215, 255], c = n - 16;
  return "#" + [Math.floor(c / 36), Math.floor((c % 36) / 6), c % 6].map((i) => level[i].toString(16).padStart(2, "0")).join("");
}

// `bat --color=always` output (24-bit or 256-colour SGR) -> per line: [[text, "#rrggbb" | null], ...].
// Only the foreground matters here; bold, italics and resets are dropped.
export function parseAnsi(text) {
  const lines = [];
  for (const raw of text.split("\n")) {
    const pieces = [];
    let color = null, last = 0, m;
    const sgr = /\x1b\[([0-9;]*)m/g;
    while ((m = sgr.exec(raw))) {
      if (m.index > last) pieces.push([raw.slice(last, m.index), color]);
      const p = m[1].split(";").map(Number);
      if (p[0] === 38 && p[1] === 2) color = `#${[p[2], p[3], p[4]].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
      else if (p[0] === 38 && p[1] === 5) color = xterm256(p[2]); // bat without COLORTERM paints these
      else if (m[1] === "" || p[0] === 0 || p[0] === 39) color = null;
      last = m.index + m[0].length;
    }
    if (last < raw.length) pieces.push([raw.slice(last), color]);
    lines.push(pieces);
  }
  // bat ends its output with a newline: that's not an extra line.
  if (lines.length && lines.at(-1).length === 0) lines.pop();
  return lines;
}
