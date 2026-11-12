// Runs a program (lazygit, nvim, ...) in a terminal of its own and shows it in a window: over the panel's body
// (a "pane") or in a big dialog. One tool at a time: opening another closes the one that is up.
// The Herdr functions come in as arguments, so the tests hand it fakes (the same rule as git.js).
import { waitForScreen } from "./screen-wait.js";

/**
 * @typedef {object} Tool what to run
 * @property {string} id which tool it is ("lazygit"), so a button can ask whether its tool is the one up
 * @property {string} script a `sh -c` script that finds the program and execs it (FIND_LAZYGIT, FIND_NVIM)
 * @property {string[]} [args] arguments for the script ($1...)
 */

/**
 * @typedef {object} Spot where a pane window goes
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {object} ToolWindowDeps
 * @property {(args: string[]) => Promise<{ code: number, stdout: string, stderr: string }>} hc
 * @property {(name: string, args: object) => unknown} run herdr's run (terminal.kill)
 * @property {(options: object) => string} openOverlay
 * @property {(id: string) => void} closeOverlay
 * @property {() => { address: string }[]} terminals the live terminals
 */

/**
 * @param {ToolWindowDeps} deps
 */
export function makeToolWindow({ hc, run, openOverlay, closeOverlay, terminals }) {
  /** @type {{ id: string, address: string, overlay: string|null }|null} the pane tool, if one is up */
  let current = null;
  let opening = false;
  let follow = 0;
  let away = false; // the window is off its place for a resize (see resized)

  const alive = (address) => terminals().some((t) => t.address === address);
  const shut = (overlay) => { if (overlay) { try { closeOverlay(overlay); } catch { /* already gone */ } } };
  const layoutOf = (address) => ({ type: "column", children: [{ type: "block", content: { terminal: address } }] });

  // A window opened again under the same key keeps its old spot and size, so a new frame means closing the old
  // window (the tool keeps running) and opening another, with no key.
  function place(spot) {
    shut(current.overlay);
    current.overlay = openOverlay({ kind: "window", frame: "none", at: { x: spot.x, y: spot.y }, width: spot.width, height: spot.height, layout: layoutOf(current.address) });
  }

  // Notices when the tool ends (its window closes by itself), so `onEnd` can show the panel's files again.
  // Each tick takes the cx its callback is given: the one captured before would be stale by then.
  function watch(cx, onEnd) {
    const address = current.address;
    const tick = (cx) => cx.timer.after(1000, (cx) => {
      if (current?.address !== address) return;
      if (!alive(address)) { current = null; onEnd(cx); return; }
      tick(cx);
    });
    tick(cx);
  }

  return {
    /**
     * Whether a pane tool is up, read from its terminal and not from a flag: a tool that ended while nobody
     * was watching never counts.
     * @param {string} [id] ask about this tool only
     */
    isUp(id) { return !!current && alive(current.address) && (id === undefined || current.id === id); },

    /**
     * Starts a tool and shows it once it has drawn (not blank first). Closes the pane tool that is up.
     * No pane.focus: the app only focuses a terminal of a visible layout block, so for a window's terminal it
     * reports "no such pane" (a notice, not a throw). A click in the window focuses it.
     * @param {object} o
     * @param {Tool} o.tool
     * @param {{ cwd: string, on: string|null }} o.loc where to run it
     * @param {object} o.cx for the timers (waiting, watching)
     * @param {Spot|null} [o.spot] a window over the panel's body; without one, the big dialog (which closes itself when the tool exits)
     * @param {(cx: object) => void} [o.onEnd] a pane tool ended by itself
     * @returns {Promise<boolean>} false when another start was still going
     */
    async open({ tool, loc, cx, spot = null, onEnd = () => {} }) {
      if (opening) return false; // a second click while the first is still starting it
      opening = true;
      try {
        if (current) this.close();
        const r = await hc(["run", "--json", "--bg", "--no-parent", "--rm", "--cwd", loc.cwd, ...(loc.on ? ["--on", loc.on] : []), "--", "sh", "-c", tool.script, "sh", ...(tool.args ?? [])]);
        if (r.code !== 0) throw new Error(r.stderr.trim() || "hc run failed");
        const address = JSON.parse(r.stdout).address;
        await waitForScreen({ read: async () => (await hc(["read", address])).stdout, sleep: (ms) => new Promise((done) => cx.timer.after(ms, () => done())) });
        if (spot) { current = { id: tool.id, address, overlay: null }; place(spot); watch(cx, onEnd); }
        else openOverlay({ kind: "dialog", width: 0.94, height: 0.9, layout: layoutOf(address) });
        return true;
      } finally { opening = false; }
    },

    /**
     * The tool's window is away from the panel's body (a resize in progress), so the body has nothing over it.
     * It stays true a moment after the window is back, so the body changes under a window already drawn and not
     * before it: the other order shows the body for an instant.
     */
    isAway() { return !!current && away; },

    /** Closes the pane tool: its window and its terminal. */
    close() {
      if (!current) return;
      away = false;
      const { address, overlay } = current;
      current = null;
      shut(overlay);
      try { run("terminal.kill", { terminal: address }); } catch { /* already dead */ }
    },

    /**
     * The panel is being resized: the window goes away at the first change (the tool keeps running) and comes
     * back in the new frame once the size has been still for a moment.
     * @param {object} cx
     * @param {() => Spot|null} nextSpot the panel's body now (null while it can't be measured)
     * @param {(cx: object) => void} onChange the tool ended meanwhile, or the window is back (isAway changed)
     */
    resized(cx, nextSpot, onChange) {
      if (!current) return;
      shut(current.overlay); current.overlay = null; away = true;
      const n = ++follow;
      cx.timer.after(200, (cx) => {
        if (n !== follow || !current) return;
        if (!alive(current.address)) { current = null; away = false; onChange(cx); return; }
        const spot = nextSpot();
        if (!spot) return;
        place(spot);
        cx.timer.after(150, (cx) => { if (n === follow && current) { away = false; onChange(cx); } });
      });
    },
  };
}
