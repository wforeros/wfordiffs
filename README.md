# herdr-gitdiff

A Changes panel for the [Herdr](https://herdr.dev) desktop app: the changed
files of the shown repo, each one opening inline into its diff with line
numbers, `+`/`−` tints and syntax colors. Read-only: no commits, no branches.

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

## Behavior

- git runs where the shown space lives: `on: "wsl"` for the WSL machine.
- Refreshes every 5 seconds; a file's diff loads when you open it.
- Untracked files show as added. Binary files show `binary`.

## Limits

- Syntax highlighting is a small per-line lexer (keywords, strings, comments,
  numbers, calls) for js/ts, python and shell. Block comments and multi-line
  strings stay plain.
- No virtual list: very large diffs render every row.
- Spaces on Windows (no `wsl` machine) would run git on Windows; not tested.

## Tests

```sh
node tests/run.mjs
```
