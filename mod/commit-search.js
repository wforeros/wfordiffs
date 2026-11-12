// pure: the picker's search. A commit matches when the text is the start of its hash, or part of its subject.

/**
 * @param {{ sha: string, subject: string }[]} commits the branch's commits, newest first
 * @param {string} query what was typed; blank matches everything
 * @returns {{ sha: string, short: string, subject: string }[]} the matches, in the same order
 */
export function filterCommits(commits, query) {
  const q = query.trim().toLowerCase();
  if (!q) return commits;
  return commits.filter((c) => c.sha.toLowerCase().startsWith(q) || c.subject.toLowerCase().includes(q));
}
