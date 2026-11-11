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
- **`node`**: only for the tests. `install.sh` skips them when it's missing.
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

The script copies `mod/` to `<app home>/mods/gitdiff` (staged, then one swap),
checks it with `herdr-app` when it finds one (`HERDR_APP_BIN` to pick it), and
never touches `keys.json` or the layouts.

To show it, put the `gitdiff` mod in a layout's panel, for example the block
that holds the Changes panel:

```json
{ "id": "changes", "type": "block", "content": { "mod": "gitdiff" } }
```

## Shortcuts

The mod exposes three commands. Bind them in `keys.json` as `gitdiff.<command>`;
they reach the mod only while it's shown.

| Command | Does |
|---|---|
| `refresh` | Reloads the file list now. |
| `expand-all` | Opens every changed file (at most 50). |
| `collapse-all` | Closes them all. |

```json
{ "global": { "alt-r": "gitdiff.refresh", "alt-e": "gitdiff.expand-all", "alt-shift-e": "gitdiff.collapse-all" } }
```

Showing or hiding the panel is not a mod command (a hidden mod can't receive
one). It's a layout command, `layout.toggle {"id": "panel"}`, bound in the
person's `keys.json` (and in tmux-prefix). See the `dots` repo's `herdr/app`.

## Long lines

The list scrolls down only: the file rows keep their place, and their `+N`/`−N`
counts stay at the right edge whatever a diff below does.

A file that is open and holds a line wider than the panel gets a horizontal bar
of its own, along the bottom of *that* file: sideways wheel (or shift+wheel, for
a mouse), drag its thumb, or click the track to jump. A file whose lines fit
gets none, and the other files are unaffected. A plain vertical wheel always
scrolls the list: the sideways motion is the mod's own, not a second scroll area
on top of the list, which made both move at once and the panel drift diagonally. The header's **wrap** button drops all those
bars and breaks long lines onto more rows instead, keeping their colors; the
line numbers stay on the first row, and the wrapped rest sits under the text
with no numbers of its own. The choice is per panel copy, not saved.

Layout notes, if you touch the render: never nest a second scroll area inside the
list (that is what made the wheel scroll both axes); the sideways offset is
applied as a negative left margin on that file's rows, clipped by the box.

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
node tests/run.mjs
```
