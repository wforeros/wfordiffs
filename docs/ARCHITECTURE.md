# Architecture

## Files

```
mod/main.js       the GitDiff view: state, refresh loop, key commands, render
mod/git.js        makeGit({ exec, readTextFile }) -> load (changed files), diffFor (one file's rows)
mod/highlight.js  makeHighlighter({ exec, settings }) -> bat colors; attachColors (pure)
mod/hscroll.js    one open file's sideways scrolling (bar, wheel, drag); state lives on the view
mod/parse.js      pure: numstat, name-status and unified-diff parsing
mod/ansi.js       pure: bat's ANSI output -> colored pieces
mod/lexer.js      pure: the fallback lexer used when bat is missing
mod/inline.js    pure: word-level marks inside a changed line (markWords, splitMarks)
mod/config.js    pure: tint colors and strengths (kept in shared("gitdiff.cfg"))
mod/settings-view.js  the gear window: palette, steppers, preview (same mod, props().settings)
mod/ask.js       pure: selected rows -> "<path>#L1-L3" reference
mod/tree.js      pure: changed files -> folder and file rows for the tree view
mod/metrics.js    gutter widths and the per-character width estimate
tests/            node:test, one file per module (npm test)
```

Only `main.js` and `hscroll.js` import from `herdr`/`gpui-*`. `git.js` and `highlight.js`
get `exec` (and `readTextFile`, `settings`) as arguments, so the tests hand them node's
`child_process` or a fake. The `parse`, `ansi` and `lexer` modules import nothing.

## Sideways scrolling

The list scrolls down only: file rows keep their place, and the `+N`/`−N` counts stay at
the right edge whatever a diff below does. A file that is open and holds a line wider than
the panel gets its own horizontal bar.

- Never nest a second scroll area inside the list: a plain wheel then moved both axes and
  the panel drifted diagonally. The sideways offset is the mod's own: a negative left margin
  on that file's rows, clipped by a box.
- The bar takes its length from the box (percentages), so it follows the panel's size.
  Only the thumb's share is computed, from the panel's width (`on_size_change`).
- Whether a file needs a bar is estimated from its longest line (`CHAR_W` in `metrics.js`),
  not measured.
- `wrap` drops the bars and lets long lines break between tokens.
- `overflow_scrollbar()` leaves the panel stuck on "could not be re-rendered"; the list uses
  one overflow area plus one `Scrollbar` instead.

## The tree column

The list is always the left column. The tree button (`this.tree`) adds a column on the right
with the folders that hold a change (`treeRows`), with a 1px divider between them. Each column is
its own `area()`: a scroll area with its own width (`this.widths[id]`, which sizes its diffs'
bars) and its own sideways offsets. Both can show the same file, so each column's ids and row
keys carry its prefix (`groups(tree)` marks the entries, `codeRow`'s `col`).

The line between them is `divider()`: a press on it starts a drag (`splitDrag`), the panel's
`on_mouse_move` moves `split` (the tree's share of the body, `SPLIT_MIN`..`SPLIT_MAX`), and the
release ends it. The list's width is `bodyW * (1 - split)` in px, from the body's `on_size_change`;
until the body is measured the two columns share it evenly.

## Folding the tree

`this.folded` holds the paths of the collapsed folders (`""` is the root). `treeRows` still returns a
collapsed folder's row, with `open: false`, but not the rows under it. A click on a folder row
(its chevron included) toggles its path in the set. Files in the tree have no chevron: a
spacer keeps their icons in line with the folders' icons, and a click opens the diff.
