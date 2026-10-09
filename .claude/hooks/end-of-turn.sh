#!/usr/bin/env bash
# Stop and SubagentStop (test rollout Phase 5, testing-quality-gates-wiring): before an agent finishes, run the whole
# unit suite and lint the changed files of every Sidereus checkout this turn changed, and send it back once with
# what failed. Rules: the 10x-configure-hook skill (references/anthropic.md). Exit 2 + stderr is the only signal that
# reaches the agent; on the retry pass (`stop_hook_active`, or Cursor's `loop_count`) it may finish, and a turn that
# is still red is reported to the user as a systemMessage instead. SubagentStop carries the same `stop_hook_active`
# plus `agent_id`/`agent_type`, and the parent's `session_id` (live hooks doc, checked 2026-10-09).
#
# Which checkouts: the session cwd's, unless its fingerprint still equals the one turn-start.sh took (nothing changed
# this turn), plus every checkout register-checkout.sh recorded this turn. Only checkouts that carry these hooks.
# Known limit: in a session whose cwd is not a checkout (~/projects), a file changed only through Bash is not seen.
export NO_COLOR=1 FORCE_COLOR=0
. "${BASH_SOURCE[0]%/*}/lib.sh" || { echo "end-of-turn.sh: lib.sh is missing next to it." >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "end-of-turn.sh needs jq (brew install jq) to read the hook payload." >&2; exit 2; }

INPUT=$(cat)
ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // empty' 2>/dev/null)
LOOPS=$(printf '%s' "$INPUT" | jq -r '.loop_count // empty' 2>/dev/null)
RETRY=0
if [ "$ACTIVE" = "true" ] || { [ -n "$LOOPS" ] && [ "$LOOPS" != "0" ]; }; then RETRY=1; fi
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
SID=$(hook_session_id "$INPUT")
STATE=$(hook_state_dir)
REGISTRY="$STATE/${SID:-none}.roots"
START="$STATE/${SID:-none}.start"

# Newline-separated root lists (no arrays: bash 3.2 and empty arrays do not mix).
ROOTS=""
add_root() {
  case "
$ROOTS
" in
    *"
$1
"*) ;;
    *) ROOTS="$ROOTS
$1" ;;
  esac
}

if CWD_ROOT=$(hook_root "${CWD:-$PWD}"); then
  STARTED=$(awk -F '\t' -v r="$CWD_ROOT" '$1 == r { print $2 }' "$START" 2>/dev/null)
  if [ -z "$STARTED" ] || [ "$STARTED" != "$(fingerprint "$CWD_ROOT")" ]; then add_root "$CWD_ROOT"; fi
fi
if [ -n "$SID" ] && [ -f "$REGISTRY" ]; then
  while IFS= read -r r; do
    [ -n "$r" ] && R=$(hook_root "$r") && add_root "$R"
  done <"$REGISTRY"
fi
[ -n "$ROOTS" ] || exit 0

REPORT=""
SUMMARY=""
add_report() {
  REPORT="$REPORT
$1
$(printf '%s\n' "$2" | tail -n 200)
"
}

while IFS= read -r ROOT; do
  [ -n "$ROOT" ] || continue
  cd "$ROOT" || continue

  CHANGED=$({ git diff --name-only HEAD; git ls-files -o --exclude-standard; } 2>/dev/null | sort -u)
  [ -n "$CHANGED" ] || continue

  # The repo's Node (.nvmrc), when nvm is installed; CI and other hosts use the node on PATH.
  NVM_SH="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [ -s "$NVM_SH" ] && [ -f .nvmrc ]; then
    # shellcheck disable=SC1090
    . "$NVM_SH" >/dev/null 2>&1 && nvm use --silent >/dev/null 2>&1 ||
      { add_report "Node ($ROOT):" "nvm could not switch to the version in .nvmrc."; continue; }
  fi
  if [ ! -x node_modules/.bin/eslint ] || [ ! -x node_modules/.bin/vitest ]; then
    add_report "Tools missing ($ROOT):" "node_modules/.bin/eslint or vitest is not installed; run npm ci in this checkout."
    continue
  fi
  # Generated types are gitignored; a fresh worktree has none, and type-aware lint misreads astro:* imports then.
  [ -d .astro ] || node_modules/.bin/astro sync >/dev/null 2>&1 </dev/null

  # Lint the changed files the linter covers (eslint.config.js: TS, TSX, Astro, JS). Explicit paths need
  # --no-warn-ignored, or an eslint-ignored generated file (database.types.ts) is a warning that fails the run.
  set --
  while IFS= read -r f; do
    case "$f" in
      *.ts | *.tsx | *.astro | *.js | *.mjs | *.cjs) [ -f "$f" ] && set -- "$@" "$f" ;;
    esac
  done <<EOF
$CHANGED
EOF
  if [ "$#" -gt 0 ]; then
    OUT=$(node_modules/.bin/eslint --max-warnings 0 --no-warn-ignored "$@" 2>&1 </dev/null) ||
      add_report "ESLint fails on changed files ($ROOT):" "$OUT"
    SUMMARY="$SUMMARY eslint $# file(s);"
  fi

  # The whole unit suite (seconds) unless the turn changed documentation only: it also runs the guards that read
  # files instead of importing them (no-console, runner zone, colours, this hook's own proof).
  NEEDS_TESTS=0
  while IFS= read -r f; do
    case "$f" in
      *.md | context/*) ;;
      *) NEEDS_TESTS=1 ;;
    esac
  done <<EOF
$CHANGED
EOF
  if [ "$NEEDS_TESTS" = 1 ]; then
    OUT=$(node_modules/.bin/vitest run 2>&1 </dev/null) || add_report "Unit tests fail ($ROOT):" "$OUT"
    SUMMARY="$SUMMARY vitest run;"
  fi
done <<EOF
$ROOTS
EOF

if [ -n "$REPORT" ]; then
  if [ "$RETRY" = 1 ]; then
    # Already sent back once: let it finish, but tell the user the turn ended red.
    jq -cn --arg m "end-of-turn.sh: the turn ended with failing checks:$REPORT" '{systemMessage: $m}'
    exit 0
  fi
  echo "Fix these before you finish:$REPORT" >&2
  exit 2
fi

# Green: start the next turn with an empty registry. The summary goes to the debug log only.
[ -n "$SID" ] && [ -f "$REGISTRY" ] && : >"$REGISTRY"
[ -n "$SUMMARY" ] && echo "end-of-turn.sh: clean:$SUMMARY"
exit 0
