# herdr-gitdiff

A Changes panel for the [Herdr](https://herdr.dev) desktop app: the changed
files of the shown repo, each one opening inline into its diff with line
numbers, `+`/`−` tints and syntax colors. Read-only: no commits, no branches.

## Requirements

Required:

- **Herdr app** (`herdr-app`). Without it there's no mod.
- **git**, on the machine where the shown space lives.
- **`sh`** (POSIX). Used for two things: starting `bat` with
  `COLORTERM=truecolor`, and piping `git show HEAD:<file>` into `bat` on stdin.
  It's there on Linux, macOS and WSL; on a native Windows space it may be
  missing from the core's PATH.

Optional:

- **`bat`**: the good highlighting, with themes and every language it knows.
  Without it the mod still works, but falls back to the built-in lexer, which
  only colors js/ts, python and shell; JSON, `.zshrc`, `.md`, `.lua` and the
  rest come out in one color. Marked as `shortcut:` in `mod/main.js`.
- **`node`**: only for the tests (`npm test`). `install.sh` skips them when it's missing.
- **`wslpath`**: only when installing from WSL against the Windows app.

Where it runs: a mod's `exec` runs on the app's host, that is, Windows. When
that space has no `wsl` machine, `git` and `bat` must exist on Windows. With a
`wsl` space (the tested case) both run in WSL, and `bat` has to be installed
there.

## Install

```sh
HERDR_APP_HOME='C:\Users\<you>\.config\herdr-app' ./install.sh   # from WSL, for the Windows app
./install.sh                                                     # the app home on this machine
./install.sh --uninstall
```

The script copies `mod/` to `<app home>/mods/herdr-gitdiff` (staged, then one swap),
checks it with `herdr-app` when it finds one (`HERDR_APP_BIN` to pick it), and
never touches `keys.json` or the layouts.

To show it, put the `herdr-gitdiff` mod in a layout's panel, for example the block
that holds the Changes panel:

```json
{ "id": "changes", "type": "block", "content": { "mod": "herdr-gitdiff" } }
```

## Shortcuts

The mod exposes three commands. Bind them in `keys.json` as `herdr-gitdiff.<command>`;
they reach the mod only while it's shown.

| Command | Does |
|---|---|
| `refresh` | Reloads the file list now. |
| `expand-all` | Opens every changed file (at most 50). |
| `collapse-all` | Closes them all. |

```json
{ "global": { "alt-r": "herdr-gitdiff.refresh", "alt-e": "herdr-gitdiff.expand-all", "alt-shift-e": "herdr-gitdiff.collapse-all" } }
```

Showing or hiding the panel is not a mod command (a hidden mod can't receive
one). It's a layout command, `layout.toggle {"id": "panel"}`, bound in the
person's `keys.json` (and in tmux-prefix). See the `dots` repo's `herdr/app`.

## Long lines

The list scrolls down only, so the file rows and their `+N`/`−N` counts stay put. A
file that is open and holds a line wider than the panel gets a horizontal bar of its own,
along the bottom of *that* file: sideways wheel (or shift+wheel), drag its thumb, or click
the track to jump. Files whose lines fit get none. The bar follows the panel's size.

The header's **wrap** button drops the bars and breaks long lines onto more rows instead,
keeping their colors; the line numbers stay on the first row. The choice is per panel copy,
not saved.

The header's **tree** button adds a column on the right of the list: the same changes, as a tree
(each folder that holds a change and the files under it; a vertical line runs from each
folder's chevron down to its last row). Each folder has a chevron to fold or unfold its contents; files show just their icon,
and a click on one opens its diff. The list on the left stays as it is. Drag the line between the two to make the tree wider
or narrower (the list gets what is left). A click on a file in the tree opens its diff in the list (the tree only names the files). It is off by default and,
like wrap and the split, is not saved. How it is built is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Colors of the diff

Inside a changed line, the exact words that changed get a stronger tint than the rest of
the line (a `−` row followed by a `+` row are compared word by word; lines that share
almost nothing are left as a whole-line change). The **gear** in the header opens a small window to pick the green and the red from a
palette (or keep the theme's) and set how strong the line and the word tints are, with a
live preview; it also sets the **font size** of the panel (9 to 24 px, default 12): rows, gutters and counts scale with it; the diffs behind it update as you click. Herdr saves the choice (`shared`),
and **Reset** returns to the defaults.

## Referencing lines

Hover a line of an open diff and a **+** shows in front of its numbers. Press it to select
that line, or keep the button down and drag over more lines. On release the reference is
copied to the clipboard as `<full path>#L12-L14` (`#L12` for one line), ready to paste in
the chat with your agent; the header confirms it. Press the **+** of a selected line to
clear the selection.

## Open in nvim

Each row of the list (except deleted files) has a small nvim icon next to its counts. The tree
has neither: its rows only show where the changes are. It runs
`nvim <path>` in the repo's folder (on the same machine as the repo) in a big dialog over
the panel; when you quit nvim the dialog closes itself and you are back in Changes. Needs
`nvim` on the PATH of the terminals Herdr starts there. The icon is Neovim's mark from
Simple Icons (CC0; the mark is its owners' trademark).

## Behavior

- git runs where the shown space lives: `on: "wsl"` for the WSL machine.
- Refreshes every 5 seconds; a file's diff loads when you open it.
- Untracked files show as added. Binary files show `binary`.

## Limits

- Colors are always Catppuccin (Mocha, or Latte when the app is in light
  appearance), even if Herdr uses another theme.
- Every opened file runs up to two `bat` calls, so *expand-all* on many files
  takes longer.
- Without `bat`, syntax highlighting is a small per-line lexer (keywords,
  strings, comments, numbers, calls) for js/ts, python and shell. Block comments
  and multi-line strings stay plain.
- No virtual list: very large diffs render every row.
- Wrap breaks between tokens: a single very long token (a minified line, a long
  URL) still needs the horizontal bar.
- Whether a file needs its bar is estimated from its longest line (9.6 px per
  character), not measured, so the bar can appear on a file that just fits, or
  late on one that doesn't, when the font or zoom changes.
- Spaces on Windows (no `wsl` machine) would run git on Windows; not tested.

## Tests

```sh
npm test    # node --test tests/*.test.mjs; no dependencies
```

`bat` tests are skipped when it isn't installed.

## Icons

`mod/icons/` holds small ui icons (branch, commit, folder, copy, merge, push…),
taken from [herdr-git-graph](https://github.com/rabeeh-ta/herdr-git-graph)
(MIT), where most are drawn after [Lucide](https://lucide.dev) (ISC). Their
licence text ships beside them as `mod/icons/LICENSE-lucide.txt`: keep it there
when you copy an icon out, `install.sh` copies it with the rest.

In a mod, an icon is `svg("mods/herdr-gitdiff/icons/<name>.svg")` (tinted with the
text color) or `image(...)` for full color.
