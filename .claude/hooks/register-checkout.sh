#!/usr/bin/env bash
# PostToolUse (Write|Edit): record the checkout of the file just edited, so end-of-turn.sh sweeps it even when the
# session's cwd is elsewhere (~/projects, which is not a git repo, or another worktree). Checks nothing itself and
# always exits 0; a missing jq is reported by end-of-turn.sh.
. "${BASH_SOURCE[0]%/*}/lib.sh" 2>/dev/null || exit 0
command -v jq >/dev/null 2>&1 || exit 0

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
SID=$(hook_session_id "$INPUT")
[ -n "$FILE" ] && [ -n "$SID" ] || exit 0

case "$FILE" in
  /*) ;;
  *) FILE="${CWD:-$PWD}/$FILE" ;;
esac
DIR=$(dirname "$FILE")
[ -d "$DIR" ] || exit 0
# Any repository is recorded; end-of-turn.sh keeps only checkouts that carry these hooks.
ROOT=$(git -C "$DIR" rev-parse --show-toplevel 2>/dev/null) || exit 0

STATE=$(hook_state_dir)
mkdir -p "$STATE" 2>/dev/null || exit 0
grep -qxF "$ROOT" "$STATE/$SID.roots" 2>/dev/null || printf '%s\n' "$ROOT" >>"$STATE/$SID.roots" 2>/dev/null
exit 0
