// Is lazygit installed where the repo lives? The header shows its button only then.
// makeLazygit takes herdr's exec, so tests can hand it a fake (the same shape as nvim.js).

// The core starts terminals with a minimal PATH (no linuxbrew), so the usual spots are tried in turn.
// One list for both: the check here and the launch in main.js (FIND_LAZYGIT) look in the same places.
const SPOTS = 'lazygit /home/linuxbrew/.linuxbrew/bin/lazygit /usr/local/bin/lazygit "$HOME/.local/bin/lazygit" /usr/bin/lazygit';

// Exits 0 when one of the spots has lazygit.
const PROBE = `for n in ${SPOTS}; do command -v "$n" >/dev/null 2>&1 && exit 0; done; exit 1`;

// Runs lazygit on the first spot that has it; without one it says so and waits, so the terminal shows why.
export const FIND_LAZYGIT = `for n in ${SPOTS}; do command -v "$n" >/dev/null 2>&1 && exec "$n"; done; echo "lazygit not found: install it, or put it on the PATH the app starts terminals with"; sleep 8`;

/**
 * @typedef {object} LazygitOptions
 * @property {(command: string, args: string[], options: { cwd: string, on: string | null }) => Promise<{ code: number }>} exec herdr's exec
 */

/**
 * @param {LazygitOptions} options
 * @returns {{ hasLazygit: (loc: { cwd: string, on: string | null }) => Promise<boolean> }}
 */
export function makeLazygit({ exec }) {
  // Whether lazygit is there, once per machine. Cache the promise, not the answer: refreshes ask at once.
  // shortcut: the answer stays until the app restarts; a lazygit installed meanwhile shows up after a restart.
  const cache = {};
  function hasLazygit(loc) {
    const key = loc.on ?? "";
    return (cache[key] ??= (async () => {
      try {
        const r = await exec("sh", ["-c", PROBE], { cwd: loc.cwd, on: loc.on });
        return r.code === 0;
      } catch {
        return false; // the probe could not run: no button, the same as no lazygit
      }
    })());
  }
  return { hasLazygit };
}
