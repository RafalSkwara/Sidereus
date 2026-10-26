#!/usr/bin/env bash
# PostToolUse (Write|Edit): lint the file the agent just edited, in its own checkout, so a lint error reaches the agent
# at once instead of at end of turn. Rules: the 10x-configure-hook skill (references/anthropic.md). Exit 2 + stderr is
# the only signal Claude sees. end-of-turn.sh still sweeps every changed file (shell rewrites never reach this hook).
export NO_COLOR=1 FORCE_COLOR=0
. "${BASH_SOURCE[0]%/*}/lib.sh" || { echo "lint-edited-file.sh: lib.sh is missing next to it." >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "lint-edited-file.sh needs jq (brew install jq) to read the hook payload." >&2; exit 2; }

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
[ -n "$FILE" ] || exit 0
case "$FILE" in
  /*) ;;
  *) FILE="${CWD:-$PWD}/$FILE" ;;
esac

# The files eslint.config.js covers: TS, TSX, Astro, JS.
case "$FILE" in
  *.ts | *.tsx | *.astro | *.js | *.mjs | *.cjs) ;;
  *) exit 0 ;;
esac
[ -f "$FILE" ] || exit 0

# Only checkouts that carry these hooks (lib.sh): other repositories and pre-hook branches are left alone.
ROOT=$(hook_root "$(dirname "$FILE")") || exit 0
cd "$ROOT" || exit 0

NVM_SH="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
if [ -s "$NVM_SH" ] && [ -f .nvmrc ]; then
  set --
  # shellcheck disable=SC1090
  . "$NVM_SH" >/dev/null 2>&1 && nvm use --silent >/dev/null 2>&1 ||
    { echo "lint-edited-file.sh ($ROOT): nvm could not switch to the version in .nvmrc." >&2; exit 2; }
fi
[ -x node_modules/.bin/eslint ] ||
  { echo "lint-edited-file.sh ($ROOT): eslint is not installed; run npm ci in this checkout." >&2; exit 2; }
[ -d .astro ] || node_modules/.bin/astro sync >/dev/null 2>&1 </dev/null

if ! OUT=$(node_modules/.bin/eslint --max-warnings 0 --no-warn-ignored -- "$FILE" 2>&1 </dev/null); then
  printf 'ESLint fails on %s:\n%s\n' "$FILE" "$(printf '%s\n' "$OUT" | tail -n 100)" >&2
  exit 2
fi
exit 0
