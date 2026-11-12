// pure: the lazygit launch, a copy of mod/lazygit.js's (the menu is its own mod and cannot import the panel's
// files). tests/lazygit.test.mjs keeps the two equal.

const SPOTS = 'lazygit /home/linuxbrew/.linuxbrew/bin/lazygit /usr/local/bin/lazygit "$HOME/.local/bin/lazygit" /usr/bin/lazygit';

export const FIND_LAZYGIT = `for n in ${SPOTS}; do command -v "$n" >/dev/null 2>&1 && exec "$n"; done; echo "lazygit not found: install it, or put it on the PATH the app starts terminals with"; sleep 8`;
