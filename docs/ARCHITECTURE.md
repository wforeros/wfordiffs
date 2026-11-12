# Architecture

## Files

```
mod/main.js       the GitDiff view: state, refresh loop, key commands, render
mod/git.js        makeGit({ exec, readTextFile }) -> load (changed files, or a commit's, plus the last 4 commits), diffFor (one file's rows), discard (one file's unstaged changes)
mod/highlight.js  makeHighlighter({ exec, settings }) -> bat colors; attachColors (pure)
mod/hscroll.js    one open file's sideways scrolling (bar, wheel, drag); state lives on the view
mod/parse.js      pure: numstat, name-status and unified-diff parsing
mod/ansi.js       pure: bat's ANSI output -> colored pieces
mod/lexer.js      pure: the fallback lexer used when bat is missing
mod/inline.js    pure: word-level marks inside a changed line (markWords, splitMarks)
mod/config.js    pure: tint colors and strengths (kept in shared("gitdiff.cfg"))
mod/settings-view.js  the gear window: palette, steppers, preview (same mod, props().settings)
mod/nvim.js       makeNvim({ exec }) -> hasNvim (is nvim on the repo's machine, cached per machine; the list's icon shows only then); FIND_NVIM (the launch, same spots)
mod/discard-view.js   the confirm dialog of a discard (same mod, props().discard); main.js does the work
mod/ask.js       pure: selected rows -> "<path>#L1-L3" reference
mod/tree.js      pure: changed files -> folder and file rows for the tree view
mod/metrics.js    gutter widths and the per-character width estimate
mod/wrap.js       pure: wrap mode's chunks for a word longer than the line
mod/sides.js      pure: a diff's rows -> pairs (old line left, new line right) for the split view
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
- `wrap` drops the bars and lets long lines break between tokens. A word with no gap in it
  (a long string, a URL) is cut into chunks that fit a line first (`wrap.js`); otherwise it
  would run off to the right, out of sight.
- `overflow_scrollbar()` leaves the panel stuck on "could not be re-rendered"; the list uses
  one overflow area plus one `Scrollbar` instead.

## The split view

The header's **split** button (`this.side`) shows each diff as pairs: the old file on the left, the new
one on the right (`pairSides` in `sides.js`). A change pairs its removed lines with its added ones in order;
the side that runs out first is left empty. Both halves are in the same row, so they scroll down together;
the sideways offset is one per file (`hscroll`), shared by both halves, each half a clip of its own.
`wrap` applies to both halves at once, and a pair is as tall as its taller side.
A new file (status `A`, untracked included) has no old side, so `groups` gives it its plain one-column body.

Shortcut: the split rows have no "+" to select a line for its reference (the list view keeps it).

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

## Showing a commit

The dropdown beside the title sets `this.rev` (`null`: the uncommitted changes). With a `rev`, `load` diffs
`rev^` (or the empty tree for a root commit) against `rev`, with no untracked files, and `diffFor` and
`highlight` read that commit's files from git, not the worktree. The list and the tree show the result the
same way. The nvim and discard buttons are hidden then. Hovering "Committed" opens the last 4 commits of
the branch (`COMMITS` in `git.js`).

## Full screen

`fullscreen` (the command, the header's **full** button) opens the mod again as a dialog over the window,
with `props: { full: true }` (`openFull`). It is an action, not a toggle: Esc or a click outside shuts the dialog (no `modal`, so the click outside closes it, as the nvim dialog's does). That dialog
is a copy of its own: it loads its own files and keeps its own picks, so it starts as the list does. Its
copy hides the **full** button and ignores the command. `<mod>.<command>` reaches shown copies only, so the
command does nothing while the panel is hidden from the layout (the button and any caller that opens the
dialog directly still work).
