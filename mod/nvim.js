// Is nvim installed where the repo lives? The list shows its icon only then.
// makeNvim takes herdr's exec, so tests can hand it a fake (the same shape as highlight.js).

// The core starts terminals with a minimal PATH (no linuxbrew), so the usual spots are tried in turn.
// One list for both: the check here and the launch in main.js (FIND_NVIM) look in the same places.
const SPOTS = 'nvim /home/linuxbrew/.linuxbrew/bin/nvim /usr/local/bin/nvim "$HOME/.local/bin/nvim" /usr/bin/nvim /opt/nvim/bin/nvim';

// Exits 0 when one of the spots has nvim.
const PROBE = `for n in ${SPOTS}; do command -v "$n" >/dev/null 2>&1 && exit 0; done; exit 1`;

// Runs nvim on the first spot that has it; without one it says so and waits, so the terminal shows why.
export const FIND_NVIM = `for n in ${SPOTS}; do command -v "$n" >/dev/null 2>&1 && exec "$n" "$@"; done; echo "nvim not found: install it, or put it on the PATH the app starts terminals with"; sleep 8`;

export function makeNvim({ exec }) {
  // Whether nvim is there, once per machine ("on"). Cache the promise, not the answer: refreshes ask at once.
  // shortcut: the answer stays until the app restarts; an nvim installed meanwhile shows up after a restart.
  const cache = {};
  function hasNvim(loc) {
    const key = loc.on ?? "";
    return (cache[key] ??= (async () => {
      try {
        const r = await exec("sh", ["-c", PROBE], { cwd: loc.cwd, on: loc.on });
        return r.code === 0;
      } catch {
        return false; // the probe could not run: no icon, the same as no nvim
      }
    })());
  }
  return { hasNvim };
}
