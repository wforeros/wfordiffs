# Changes panel

A panel that lists the files changed in the shown repo, each opening inline into its diff with line numbers, `+`/`−` tints and syntax colors. It can discard unstaged changes after a confirmation. It makes no commits and no branches.

![Changes panel](preview.png)

## What you see

- **Header:** the title, a picker for the commit being shown (the uncommitted changes, or one of the last 4 commits), the toggles **wrap**, **split** and **tree**, the totals of `+N` and `−N` across the changed files, and the buttons **full**, the gear, **Lazygit** (when installed) and the nvim icon (when installed).
- **File list:** one row per changed file: its icon, its name, its `+N` and `−N` counts in green and red, and a trash icon when it has unstaged changes. Deleted files have no nvim icon. Untracked files count as added; binary files show `binary` in place of counts.
- **Tree (when **tree** is on):** a second column on the right, with the folders that hold a change and the files under them. Each folder has a chevron that folds or unfolds it. Drag the line between the two columns to resize them.
- **An open file:** under its row, its diff. Each line has its old and new line numbers, a green row for added lines, a red row for removed lines, and syntax colors. A changed line's exact changed words have a stronger tint than the rest of the line.
- **Split view (when **split** is on):** the old file on the left (*Before*), the new file on the right (*After*). A side with no line across from a change is hatched with thin grey diagonals. A new file has one column.

## How it behaves

- The file list refreshes every 5 seconds. A file's diff loads when it opens.
- Click the panel first to give it the keyboard. `j` and `k` move a highlighted cursor down and up over the files, and the list scrolls to it. `l` or `enter` opens the cursor's diff; `h` closes it; `enter` also closes it. `ctrl-d` and `ctrl-u` move the cursor a tenth of the visible list.
- Hover a line of an open diff and a `+` shows in front of its numbers. Press it to select the line; drag over more lines to select a range. On release the reference `<full path>#L12-L14` (or `#L12` for one line) is copied to the clipboard.
- Click a changed line to select its block of consecutive changed lines. Hovering or selecting a block shows a `...` button on its first line. Its menu has "Abrir en nvim", which opens the file at that line.
- Click the trash icon of a file with unstaged changes: a dialog asks first. For a tracked file, the unstaged changes are discarded and staged changes stay. For an untracked file, the file is deleted. The button is red. This cannot be undone.
- **wrap** breaks long lines onto more rows, keeping their colors. Without it, a file with a line wider than the panel gets a horizontal bar of its own at its bottom.
- **split**, **tree** and **wrap** are one shared choice, saved in Herdr's shared settings. The menu and the full-screen copy show the same choice.
- **full** (or the `fullscreen` command) opens the same panel in a large dialog over the window. Esc or a click outside closes it.
- The gear opens a small window to pick the added and removed colors from a palette, set how strong the tints are, and set the font size from 9 to 24 px (default 12). **Reset** restores the defaults.
- The mod has these commands for keys: `refresh` and `collapse-all`, besides the ones that open full screen and lazygit. They reach the panel only while it is shown.
- A second mod, the Changes menu, opens with a key from the tmux-style prefix (`<leader>G`) as a popup at the top of the window. It has a filter field and rows: Open pane (shows the panel in the side panel), Fullscreen, Lazygit (which opens lazygit in the repo in a big dialog), and Split view, Tree and Wrap (with *on* or *off* on the right; the rows stay open after a toggle). Esc or a click outside closes it.

The mod has no agent states: it shows the repo's changes only.

## Built from

- **Two mods:** `wfordiffs` (the panel: `mod/main.js`, `mod/mod.json` with `"focusable": true`, `mod/ui/` for drawing, and `mod/icons/`) and `wfordiffs-menu` (`menu/main.js`, `menu/mod.json` with a popup overlay, top, 240 by 303 px, 40 px down).
- **Herdr functions:** `exec`, `spaces`, `focused`, `readTextFile`, `nextCommand`, `theme`, `settings`, `shared`, `setShared`, `openOverlay`, `closeOverlay`, `notify`, `props` and `hc`, from the `herdr` module. The panel uses the `gpui-kit` and `gpui-base` builders for its drawing.
- **Programs run through `exec`:** `git` on the repo's machine, `sh` (to start `bat` and to find `nvim` and `lazygit`), and, when present, `bat` for highlighting, `nvim` and `lazygit`.
- **Art:** the icons in `mod/icons/` are drawn after Lucide (ISC) and taken from herdr-git-graph (MIT). Keep `LICENSE-lucide.txt` beside them. The nvim mark is Simple Icons (CC0).

## Install

`./install.sh` copies the two mods into the app home as `mods/wfordiffs` (the panel, from `mod/`) and `mods/wfordiffs-menu` (its menu, from `menu/`). It checks each with `herdr-app check` before it lands, replaces only a folder whose `mod.json` title is its own, and `./install.sh --uninstall` removes only those two.

The script never touches `keys.json` or any layout. Showing the panel and binding keys is the user's choice, and the user asks for it:

- **Layout:** to put the panel in a layout, the user adds a pane with `content.mod` set to `wfordiffs`.
- **As a button in the top-right corner:** Herdr's own layout draws a **Files** and a **Changes** button there. They open and close a side panel on the right of the window, hidden at first, 368 px wide and resizable by dragging its edge. The **Changes** button shows Herdr's own `changes` mod; this panel does not replace it, it gets a **Diffviewer** button beside it:
  1. Shipped layouts and tab bars are read-only, so clone the ones in use (`herdr-app do layout.clone '{"name":"main","as":"my-layout"}'` and `herdr-app do mod.clone '{"name":"tabs","as":"my-tabs"}'`), or use the clones the user already has.
  2. In the layout clone, keep `"id": "changes"` with `"mod": "changes"` and add a sibling block in the same `stack` `panel-body`:
     ```json
     { "id": "diffviewer", "type": "block", "content": { "mod": "wfordiffs" } }
     ```
  3. In the tab bar clone, add `"diffviewer"` to the `enabled` list and a button after Changes: `panelButton("diffviewer", "Diffviewer", "mods/wfordiffs/icons/split.svg")`. The icon is ours, so the button needs nothing from another mod.
  Save: the window follows within a second. The panel needs no `"focusable"` entry in the layout, because `mod/mod.json` already sets it. Keys can open it too: `"<key>": "<tab bar mod>.diffviewer"` in `keys.json`.
- **Keys:** to bind a command, the user adds `wfordiffs.<command>` (`refresh`, `collapse-all`, `fullscreen`, `lazygit-fullscreen`, `lazygit-pane`) in `keys.json`. The menu opens from its `<leader>G` binding, which is also theirs to set.

## Watch out

- Colors come from Catppuccin (Mocha, or Latte in light appearance), not from Herdr's theme.
- Without `bat`, highlighting is a small per-line lexer for js/ts, python and shell. Other languages come out in one color, and block comments and multi-line strings stay plain.
- Each opened file runs up to two `bat` calls, so opening many files at once is slow.
- There is no virtual list: a very large diff renders every row.
- Whether a file needs its horizontal bar is estimated from its longest line (9.6 px per character), not measured. The bar can appear late or not at all when the font or zoom changes.
- A single very long token (a minified line, a long URL) still needs the horizontal bar in wrap mode.
- git runs on the machine of the shown space. A Windows space with no WSL machine would run git on Windows; that is not tested.
- The panel never nests a second scroll area inside its list, and it does not use `overflow_scrollbar()`: the panel would be stuck on "could not be re-rendered".

## Done when

- `herdr-app check ~/.config/herdr-app/mods/wfordiffs` and the same for `wfordiffs-menu` pass.
- `npm test` passes (`bat` tests are skipped when `bat` is missing).
- On a repo with a modified file, a new file and a binary file, the panel lists all three with the right counts and marks, and `binary` shows for the binary one.
- `j` moves the highlighted row down and `enter` opens its diff with the `+` and `−` tints.
- Clicking the trash icon of a file with unstaged changes opens the confirm dialog, and cancelling it leaves the file as it was.
- **split** shows *Before* and *After* side by side, and the choice survives a restart.
