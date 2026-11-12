// pure: wait until a terminal has drawn something. A window opened on a terminal that is still starting shows
// it blank (lazygit takes a moment to paint its first frame), so the panel opens the window after this.
// Takes `read` and `sleep` as arguments, so the tests hand it fakes.

/**
 * @typedef {object} ScreenWaitOptions
 * @property {() => Promise<string>} read the terminal's screen as text (`hc read <address>`)
 * @property {(ms: number) => Promise<void>} sleep
 * @property {number} [every] ms between looks
 * @property {number} [limit] ms to wait at most; past it the window opens anyway
 */

/**
 * @param {ScreenWaitOptions} options
 * @returns {Promise<boolean>} true when something was drawn, false when the limit ran out first
 */
export async function waitForScreen({ read, sleep, every = 60, limit = 2500 }) {
  for (let waited = 0; waited <= limit; waited += every) {
    let text = "";
    try { text = await read(); } catch { /* the terminal is not readable yet */ }
    if (text.trim()) return true;
    await sleep(every);
  }
  return false;
}
