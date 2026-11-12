# Architecture

## Files

```
mod/main.js       the GitDiff view: refresh loop, key commands, and render() composing the pieces below from its state
mod/view-state.js pure: initialState() (every field, grouped), commitSwitchState() (what a commit switch resets)
mod/git.js        makeGit({ exec, readTextFile }) -> load (changed files, or a commit's, plus the last 4 commits), diffFor (one file's rows), discard (one file's unstaged changes), history (the branch's newest commits, for the commits list's search), branches (the other branches, for the compare list); `load(loc, rev, against)` with a branch shows what HEAD adds since the merge base. A file whose text is not UTF-8 (base, commit or worktree side) is listed as binary: `notUtf8` runs `iconv` on the repo's machine, so the text never crosses `exec`
mod/highlight.js  makeHighlighter({ exec, settings }) -> bat colors; attachColors (pure)
mod/hscroll.js    one open file's sideways scrolling (bar, wheel, drag); state lives on the view
mod/parse.js      pure: numstat, name-status and unified-diff parsing
mod/ansi.js       pure: bat's ANSI output -> colored pieces
mod/lexer.js      pure: the fallback lexer used when bat is missing
mod/inline.js    pure: word-level marks inside a changed line (markWords, splitMarks)
mod/config.js    pure: tint colors and strengths (kept in shared("gitdiff.cfg"))
mod/settings-view.js  the gear window: palette, steppers, preview (same mod, props().settings)
mod/nvim.js       makeNvim({ exec }) -> hasNvim (is nvim on the repo's machine, cached per machine; the list's icon shows only then); FIND_NVIM (the launch, same spots)
mod/lazygit.js    makeLazygit({ exec }) -> hasLazygit (the same for lazygit: the header's Lazygit button shows only then); FIND_LAZYGIT (the launch)
mod/discard-view.js   the confirm dialog of a discard (same mod, props().discard); main.js does the work
mod/ask.js       pure: selected rows -> "<path>#L1-L3" reference
mod/tree.js      pure: changed files -> folder and file rows for the tree view
mod/metrics.js    pure: gutter widths, the per-character width estimate, and the design constants (row heights, indent, hatching)
mod/diff-colors.js  pure: the user's color, else the theme's, for added, removed, modified, a line, a status
mod/line-selection.js  pure: the selection of diff lines (isPicked, pressRow, extendTo)
mod/split-drag.js  pure: the divider's drag -> the tree's share of the body
mod/commit-message.js  pure: a message's subject and body, and a commit's short name
mod/ui/ui-buttons.js    textButton (the picker) and iconButton (the header's toggles, full, Lazygit, gear), for the header and the rows
mod/ui/ui-counts.js     the +N / −N counts and "binary"
mod/ui/ui-header.js     the header: title, picker button, toggles, totals
mod/ui/ui-commit-menu.js  the commit's message block and the picker (Uncommitted, Branches, Commits; the commits list has the search field)
mod/ui/ui-file-row.js   folder rows, file rows and the tree's guide lines
mod/ui/ui-error-bar.js  an error at the bottom of the panel, with Copy and dismiss buttons (a tool that could not open)
mod/ui/ui-diff-row.js   a diff's rows: code row, split row, hunk header, change bar, hatching
mod/wrap.js       pure: wrap mode's chunks for a word longer than the line
mod/commit-search.js  pure: the picker's search (filterCommits: a hash's start or part of a subject)
mod/sides.js      pure: a diff's rows -> pairs (old line left, new line right) for the split view
menu/lazygit.js    pure: FIND_LAZYGIT, a copy of mod/lazygit.js's for the menu
menu/main.js      the Changes menu (<leader>g), its own mod (herdr-gitdiff-menu): Herdr's menu look, a filter field, the shared views
tests/            node:test, one file per module (npm test)
```

Only `main.js`, `hscroll.js` and the `ui/ui-*.js` files import from `herdr`/`gpui-*` (the `ui-*` files only
from `gpui-*`: they draw from values and callbacks the view hands in and never read its state). `git.js` and `highlight.js`
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
same way. The nvim and discard buttons are hidden then. Hovering "Commits" opens the last 4 commits of
the branch (`COMMITS` in `git.js`) under a search field. Hovering "Branches" lists the other branches: picking one sets
`this.branch` (and `rev` to `"HEAD"`), and the panel shows HEAD against the merge base of the two, like a pull request.

## Full screen

`fullscreen` (the command, the header's **full** button) opens the mod again as a dialog over the window,
with `props: { full: true }` (`openFull`). It is an action, not a toggle: Esc or a click outside shuts the dialog (no `modal`, so the click outside closes it, as the nvim dialog's does). That dialog
is a copy of its own: it loads its own files and keeps its own picks, so it starts as the list does. Its
copy takes the keyboard as it opens (`init` calls `handle.focus()`), so the vim keys work at once, and hides the **full** button and ignores the command. `<mod>.<command>` reaches shown copies only, so the
command does nothing while the panel is hidden from the layout (the button and any caller that opens the
dialog directly still work).

## Keys in the panel

The root takes the keyboard (`track_focus(this.handle)`), and a click on it gives it (`handle.focus()`).
`key` handles `j`/`k` (the cursor moves over `this.files`), `l`/`h`/`enter` (the cursor's diff), and
stops the event only when it handles it. The cursor is a path (`this.cursor`), and its row is marked in
`fileRow`. The list is a `ScrollHandle` (`listScroll`): the rows are its children, so the cursor's row has
an index, and `scroll_to_item` runs once per key (`reveal`), not on every render.

The panel is `"focusable": true` in `mod.json`, so `pane.go` reaches it. Herdr then sends the `focus`
command (`nextCommand`), and the panel calls `handle.focus()`, the same as a click does.

## Blocks of changes

A block is a run of consecutive `+`/`-` rows (`numberBlocks` in `parse.js`; a split pair counts
through either side). `loadDiff` numbers each open diff's blocks, so a row knows its block (`blk`)
and whether it starts one (`first`). The split view's pairs take the same numbers.

- A click on a changed row selects its block (`selectBlock`). Nothing is tinted; a selected block
  only shows its button.
- Hovering a row sets the block under the pointer (`hoverBlockAt`). The first row of a hovered or
  selected block shows a `...` button at its top right (`blockButton`, drawn by `blockAction` in
  `mod/ui/ui-diff-row.js` as a `Popover` from gpui-base). It shows only where nvim can open the file
  (`showAction`, `nvimOpenable`).
- Its menu's "Abrir en nvim" opens the file at the block's first line (`openNvim` with `+N` before
  the path). The key `e` does the same with a selected block.
- The keys do not move between blocks: `j`/`k`/`h`/`l` work on the files as before.

## The shared views and the menu

Split, tree and wrap are one shared choice (`VIEW_KEY`, `parseView` in `config.js`), not each copy's own.
`render` reads it into the instance (`Object.assign`), and `setView` writes it, so the header buttons, the
menu and the full-screen copy agree. Herdr keeps `shared` state, so the choice survives a restart.

The menu is `menu/` (`herdr-gitdiff-menu`), opened with `mod.open` from the tmux-style prefix, so its
`mod.json` sets the place: a popup at the top, 40px down. Its rows are Herdr's menu's (31px, the highlight,
the hint on the right); its filter is an `InputState`, as in the picker. The toggles write the shared key
and stay open; Fullscreen opens the full-screen dialog of `herdr-gitdiff`. Lazygit opens a dialog with just lazygit's terminal (`openLazygit` in `menu/main.js`, the same `hc run` as the panel's `openTool`),
with no panel in between. The menu is its own mod, so it keeps a copy of `FIND_LAZYGIT` (`menu/lazygit.js`; a test keeps the two equal).

ctrl-d and ctrl-u move the cursor a tenth of the list's visible height (`heights`, set by the list's `on_size_change`), so the list follows it as it does for j and k.
