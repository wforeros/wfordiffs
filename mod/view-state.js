// pure: the panel's state, one field per line and grouped by what it is for. The view takes
// these with Object.assign in init(); what needs gpui (the focus handle, the scroll handle) is
// created there.
import { EMPTY_TREE } from "./parse.js";
import { DEFAULTS } from "./config.js";

/** The state a commit switch starts over from: what the previous commit's view left behind. */
export function commitSwitchState() {
  return {
    message: "",
    msgOpen: false,
    files: [],
    open: new Set(),
    diffs: {},
    sel: null,
    block: null,
    hoverBlock: null,
    blockMenu: null,
    fp: "",
    loading: true,
  };
}

/** The state of a fresh panel (all three windows: the panel, the gear window, the discard dialog). */
export function initialState() {
  return {
    // The changes
    files: [],
    open: new Set(),          // paths of the files whose diff is open
    diffs: {},                // path -> its diff rows
    base: EMPTY_TREE,         // what the changes are against
    root: null,               // the repo's top folder
    loc: null,                // { cwd, on }: where git runs
    fp: "",                   // fingerprint of the files, so a refresh that changed nothing is cheap
    error: null,
    loading: true,
    busy: false,
    nvim: false,              // nvim is installed where the repo is: the list shows its icon (nvim.js)
    lazygit: false,           // lazygit is installed there too: the header shows its button (lazygit.js)

    // The commit shown (null: the uncommitted changes) and its picker
    rev: null,
    branch: null,             // a branch is compared with HEAD (rev is then "HEAD"); null: not comparing
    branches: [],             // the branches to pick from, read when the picker opens
    commits: [],
    message: "",
    msgOpen: false,           // the shown commit's message, folded or not
    menu: false,              // the picker beside the title is open
    sub: null,                // and the list beside it: "branches", "commits" or null
    query: "",                // the picker's search field's text: "" lists the recent commits
    branchCommits: [],        // the branch's commits, read when the picker opens, for the search

    // How it looks
    cfg: { ...DEFAULTS },     // tint colors and strengths, from shared(); set in the gear window
    k: 1,                     // font scale (cfg.font / DEFAULTS.font)
    wrap: false,              // off: one row per line and a horizontal bar; on: long lines break
    side: false,              // on: each diff shows the old file on the left and the new one on the right (sides.js)
    tree: false,              // on: the files show as a tree in a column on the right
    folded: new Set(),        // the tree's folders that are collapsed, by path ("" is the root)

    // Layout and dragging
    viewport: 0,              // the list's width in px, once measured (wrap cuts its code to it)
    widths: {},               // per scroll area (the list, the tree): its width, to size each file's bar
    heights: {},              // per scroll area: its height, so ctrl-d and ctrl-u move half a page
    bodyW: 0,                 // the body's width, for the divider
    split: 0.5,               // the list's share is 1 - split when the tree is on
    splitDrag: null,          // { x, start } while the divider is dragged
    offsets: {},              // per file id: sideways offset in px
    drag: null,               // { id, startX, startOff } while dragging a file's bar

    // Blocks of changes (parse.js numberBlocks): a click selects one, the pointer over one shows its "..."
    block: null,              // the selected block: { path, n }
    hoverBlock: null,         // the block under the pointer: { path, n }
    blockMenu: null,          // the block whose "..." menu is open: { path, n }

    // Selecting lines to reference (line-selection.js)
    sel: null,
    hover: null,              // the row key the pointer is over
    dragging: false,          // the mouse is down on a selection
    flash: "",                // a short message in the header

    // Keys
    cursor: null,             // the file the keys move on (its path), or null
    reveal: false,            // scroll the list to the cursor at the next render
    scrollFile: null,         // the file under the pointer while the wheel turns (its chip shows), or null
    heightMemo: {},           // per file: its height in the list, kept while its diff, the split view and the font stay (groupHeight)
    scrollSeq: 0,             // counts the wheel turns, so only the last one hides the chip

    // The discard dialog
    err: null,                // its error, when the discard failed
  };
}
