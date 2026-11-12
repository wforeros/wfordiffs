# wfordiffs

A Changes panel for [Herdr](https://herdr.dev): the files changed in the repo you're viewing, each one opening into its diff.

![Changes panel](preview.png)

## Features

- List of changed files with `+N` / `−N` counts, untracked files and binary files marked.
- Picker: Uncommitted (the default), Branches or Commits.
- Branches: pick one to compare it with the current branch (what the current branch adds since they met, as a pull request shows it).
- Commits: the last 4; the search field sits in this list. Search commits by the start of their hash or part of their subject, among the newest 500 of the branch; Enter shows the first match.
- Inline diff with line numbers, added and removed tints, and syntax colors.
- Exact changed words get a stronger tint inside each line.
- Toggle between the unified view and split view (*Before* / *After*).
- Toggle a tree view of the changed files, with folders that fold and unfold.
- The settings window works from the keyboard: `h` `j` `k` `l` or the arrows move over the options, `Enter` (or space) presses one, `Esc` closes. Enter on the chosen color lets it go. Reset asks for confirmation first (Enter confirms, Esc cancels).
- Header buttons to expand or collapse every diff (also the `expand-all` and `collapse-all` commands; expanding opens up to 50 files).
- While you scroll the list, a chip at the top names the file at the top of the list, when that file's diff is taller than the list (wheel only).
- Toggle line wrap for long lines.
- Select lines or blocks and copy a `path#L12-L14` reference to the clipboard.
- Discard unstaged changes per file, with a confirmation.
- Customize the added and removed colors from a palette, the tint strength, the font size (9–24 px) and where Lazygit and Neovim open (over the panel or fullscreen) from the gear settings, with a reset to defaults.
- Keyboard navigation (`j`, `k`, `l`, `h`, `enter`) and commands `refresh`, `expand-all`, `collapse-all`, `fullscreen`, `lazygit-fullscreen`, `lazygit-pane`.
- Makes no commits and no branches.

### Optional extras

- **Open in Neovim**: with `nvim` installed, the list's nvim icon opens the file, and a block's menu opens it at that line, over the panel's body like Lazygit, or in a large dialog if the gear settings say Fullscreen for Neovim (the full-screen copy always uses the dialog). Quitting nvim brings the list back.
- **Lazygit**: with `lazygit` installed, the header's button opens it over the panel's body (the header stays; click again to close it), or in a large dialog if the gear settings say Fullscreen. The menu offers both: Lazygit > Fullscreen and Lazygit > Pane. The commands `lazygit-fullscreen` (a large dialog over the window) and `lazygit-pane` (over the panel's body) can be bound as `wfordiffs.<command>` in `keys.json`.

Without them the mod works, but these options don't appear.

## Dependencies

Required:

- **Herdr app** (`herdr-app`). Without it there is no mod.
- **git**, on the machine where the shown space lives.
- **sh** (POSIX). Used to start `bat` and to look for `nvim` and `lazygit`.
- **bash**, to run `install.sh`.

Optional:

- **bat** (or `batcat` on Debian/Ubuntu): full syntax highlighting for every language it knows. Without it, only JavaScript/TypeScript, Python and shell are colored; other languages show in one color.
- **nvim**: enables "Open in Neovim" from a block's menu.
- **lazygit**: enables the Lazygit button and the menu's "Lazygit > Fullscreen" and "Lazygit > Pane" entries.
- **node**: only to run the tests (`npm test`). `install.sh` skips them when it's missing.
- **wslpath**: only when installing from WSL into the Windows app.

Running on Windows: when the Herdr space is a WSL machine, git, bat, nvim and lazygit must be installed inside WSL.

## Install

Ask your AI agent:

> Read ~/.config/herdr-app/AGENTS.md, then add this mod: https://github.com/wforeros/wfordiffs

The agent follows [RECIPE.md](RECIPE.md), the step-by-step brief for installing this mod.

Manual install: `./install.sh` (use `--uninstall` to remove).

## Backlog

This list grows as the mod is used. Pending items:

- **Send change context to the AI chat automatically.** Today it's hard to give an agent the context of the changes. Improve how the selected diff or file changes are packaged so they can be sent to the chat in one step.
