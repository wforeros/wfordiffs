#!/usr/bin/env bash
# Installs the wfordiffs mods into a Herdr app home: the Changes panel (mod/) and its menu (menu/).
# Touches only mods/wfordiffs and mods/wfordiffs-menu: no keys, no layouts (the layout that
# shows them is yours to set), unless you ask with --button (then, also your layout and tab bar clones).
#
#   ./install.sh                     -> $HERDR_APP_HOME or ~/.config/herdr-app
#   HERDR_APP_HOME='C:\Users\me\.config\herdr-app' ./install.sh
#   ./install.sh --uninstall
#   ./install.sh --button            -> also adds a Diffviewer button next to Changes (top-right corner): see button-setup.mjs
#
# Under WSL, HERDR_APP_HOME may be the Windows form (C:\...) or the /mnt/c path.
# HERDR_APP_BIN: the herdr-app binary, used to check each mod before it lands.
# Unset, the first herdr-app on PATH is used; none found, the check is skipped.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
# A Windows home (C:\...) is seen from WSL as /mnt/c/...
[ -d "$HOME_DIR" ] || { W="$(command -v wslpath >/dev/null 2>&1 && wslpath -u "$HOME_DIR" 2>/dev/null || true)"; [ -n "$W" ] && HOME_DIR="$W"; }

# The mods: source folder, then the name it installs under (which is also its title in mod.json).
MODS=("mod:wfordiffs" "menu:wfordiffs-menu")

say() { printf 'wfordiffs: %s\n' "$*"; }
die() { printf 'wfordiffs: %s\n' "$*" >&2; exit 1; }

# Only ever replace or remove our own folder: its mod.json has our title.
ours() { [ ! -e "$1" ] || grep -q "\"title\"[[:space:]]*:[[:space:]]*\"$2\"" "$1/mod.json" 2>/dev/null; }

BUTTON=0
for a in "$@"; do
  case "$a" in
    --uninstall|--button) ;;
    *) die "unknown option: $a" ;;
  esac
  [ "$a" = "--button" ] && BUTTON=1
done

if [ "${1:-}" = "--uninstall" ]; then
  for m in "${MODS[@]}"; do
    name="${m#*:}"; DEST="$HOME_DIR/mods/$name"
    [ -d "$DEST" ] || { say "not installed in $HOME_DIR: $name"; continue; }
    ours "$DEST" "$name" || die "$DEST isn't $name's; leaving it"
    rm -rf "$DEST"
    say "removed $DEST"
  done
  exit 0
fi

[ -d "$HOME_DIR" ] || die "no Herdr app home at $HOME_DIR (start the app once, or set HERDR_APP_HOME)"
for m in "${MODS[@]}"; do
  name="${m#*:}"
  ours "$HOME_DIR/mods/$name" "$name" || die "$HOME_DIR/mods/$name exists and isn't $name's; not overwriting it"
done
if command -v node >/dev/null; then (cd "$ROOT" && node --test tests/*.test.mjs >/dev/null) || die "tests failed (npm test)"; else say "node not found: skipping tests"; fi
# Optional, but without it the colors fall back to a small lexer (js, py, sh only).
if ! command -v bat >/dev/null 2>&1 && ! command -v batcat >/dev/null 2>&1; then
  say "bat not found: diffs will use the plain fallback. Install it with 'apt install bat' (batcat), 'brew install bat', or put it on the PATH the app's mods see."
fi

BIN="${HERDR_APP_BIN:-$(command -v herdr-app 2>/dev/null || true)}"
mkdir -p "$HOME_DIR/mods"

for m in "${MODS[@]}"; do
  src="$ROOT/${m%%:*}"; name="${m#*:}"
  DEST="$HOME_DIR/mods/$name"; STAGE="$HOME_DIR/mods/.$name-install"
  rm -rf "$STAGE" && mkdir -p "$STAGE/$name"
  # Only the mod itself: the app writes its own jsconfig.json and *.d.ts next to it.
  for f in "$src"/*.js "$src"/mod.json; do cp "$f" "$STAGE/$name/"; done
  # The layer folders (mod/ui/, mod/utils/, mod/settings/): only their *.js, the same rule as the top level.
  for layer in ui utils settings; do
    if [ -d "$src/$layer" ]; then mkdir -p "$STAGE/$name/$layer" && cp "$src/$layer"/*.js "$STAGE/$name/$layer/"; fi
  done
  # Icons (drawn after Lucide, ISC): svgs, the custom ones, and their licence, never without it.
  [ -d "$src/icons" ] && cp -R "$src/icons" "$STAGE/$name/icons"

  if [ -n "$BIN" ]; then
    # A Windows binary needs a Windows path (wslpath when we're under WSL).
    P="$STAGE/$name"
    command -v wslpath >/dev/null 2>&1 && P="$(wslpath -w "$P")"
    # The app reads its home from HERDR_APP_HOME, in its own (Windows) form.
    APP_HOME_WIN="$HOME_DIR"; command -v wslpath >/dev/null 2>&1 && APP_HOME_WIN="$(wslpath -w "$HOME_DIR")"
    HERDR_APP_HOME="$APP_HOME_WIN" "$BIN" check "$P" >/dev/null || { rm -rf "$STAGE"; die "herdr-app check failed for $name"; }
  else
    say "no herdr-app binary found: skipping the check"
  fi

  # Swap in one rename, and only when it differs (each reload keeps the old build in memory).
  if [ -d "$DEST" ] && diff -rq -x jsconfig.json -x '*.d.ts' -x '.*' "$STAGE/$name" "$DEST" >/dev/null 2>&1; then
    rm -rf "$STAGE"; say "already up to date: $name in $HOME_DIR"; continue
  fi
  [ -d "$DEST" ] && mv "$DEST" "$HOME_DIR/mods/.$name-old"
  mv "$STAGE/$name" "$DEST"
  rm -rf "$STAGE" "$HOME_DIR/mods/.$name-old"
  say "installed $name into $HOME_DIR"
done

# On request only: the button needs edits to the user's layout and tab bar clones (button-setup.mjs says which).
if [ "$BUTTON" = 1 ]; then
  command -v node >/dev/null || die "--button needs node"
  node "$ROOT/button-setup.mjs" "$HOME_DIR"
fi
