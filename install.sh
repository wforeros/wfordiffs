#!/usr/bin/env bash
# Installs the gitdiff mod into a Herdr app home. Touches only mods/gitdiff:
# no keys, no layouts (the layout that shows it is yours to set).
#
#   ./install.sh                     -> $HERDR_APP_HOME or ~/.config/herdr-app
#   HERDR_APP_HOME='C:\Users\me\.config\herdr-app' ./install.sh
#   ./install.sh --uninstall
#
# HERDR_APP_BIN: the herdr-app binary, used to check the mod before it lands.
# Unset, the first herdr-app on PATH is used; none found, the check is skipped.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/mod"
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
DEST="$HOME_DIR/mods/gitdiff"
STAGE="$HOME_DIR/mods/.gitdiff-install"

say() { printf 'gitdiff: %s\n' "$*"; }
die() { printf 'gitdiff: %s\n' "$*" >&2; exit 1; }

# Only ever replace or remove our own folder.
ours() { [ ! -e "$1" ] || grep -q '"title"[[:space:]]*:[[:space:]]*"gitdiff"' "$1/mod.json" 2>/dev/null; }

if [ "${1:-}" = "--uninstall" ]; then
  [ -d "$DEST" ] || { say "not installed in $HOME_DIR"; exit 0; }
  ours "$DEST" || die "$DEST isn't gitdiff's; leaving it"
  rm -rf "$DEST"
  say "removed $DEST"
  exit 0
fi

[ -d "$HOME_DIR" ] || die "no Herdr app home at $HOME_DIR (start the app once, or set HERDR_APP_HOME)"
ours "$DEST" || die "$DEST exists and isn't gitdiff's; not overwriting it"
if command -v node >/dev/null; then node "$ROOT/tests/run.mjs" >/dev/null || die "tests failed (node tests/run.mjs)"; else say "node not found: skipping tests"; fi

BIN="${HERDR_APP_BIN:-$(command -v herdr-app 2>/dev/null || true)}"

mkdir -p "$HOME_DIR/mods"
rm -rf "$STAGE" && mkdir -p "$STAGE/gitdiff"
cp -R "$SRC/." "$STAGE/gitdiff/"

if [ -n "$BIN" ]; then
  # A Windows binary needs a Windows path (wslpath when we're under WSL).
  P="$STAGE/gitdiff"
  command -v wslpath >/dev/null 2>&1 && P="$(wslpath -w "$P")"
  "$BIN" check "$P" >/dev/null || { rm -rf "$STAGE"; die "herdr-app check failed"; }
else
  say "no herdr-app binary found: skipping the check"
fi

# Swap in one rename, and only when it differs (each reload keeps the old build in memory).
if [ -d "$DEST" ] && diff -rq -x jsconfig.json -x '*.d.ts' -x '.*' "$STAGE/gitdiff" "$DEST" >/dev/null 2>&1; then
  rm -rf "$STAGE"; say "already up to date in $HOME_DIR"; exit 0
fi
[ -d "$DEST" ] && mv "$DEST" "$HOME_DIR/mods/.gitdiff-old"
mv "$STAGE/gitdiff" "$DEST"
rm -rf "$STAGE" "$HOME_DIR/mods/.gitdiff-old"
say "installed into $HOME_DIR"
