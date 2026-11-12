// pure: a commit message split for the panel: the subject (first line) shown always, the body
// (the rest, trimmed) folded behind "more".

/**
 * @param {string} message the whole message, as `git log --format=%B` gives it
 * @returns {{ subject: string, body: string }} body is "" when the message is one line
 */
export function splitMessage(message) {
  const subject = message.split("\n")[0];
  return { subject, body: message.slice(subject.length).trim() };
}

/**
 * The name a commit goes by in the panel: its short hash from the recent commits, else the first 7
 * characters of what was asked for.
 * @param {string} rev the commit's full hash
 * @param {{ sha: string, short: string }[]} commits the recent commits (git.js load)
 * @returns {string}
 */
export const shortRev = (rev, commits) => commits.find((c) => c.sha === rev)?.short ?? rev.slice(0, 7);
