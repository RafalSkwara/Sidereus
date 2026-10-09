#!/usr/bin/env bash
# UserPromptSubmit: remember what the session's checkout looked like when the turn began, so end-of-turn.sh reacts
# only to this turn's changes and never sends the agent back for earlier work in progress or another agent's edits.
# On exit 0 this event's stdout is added to the prompt, so this script prints nothing and always exits 0: without
# jq or a checkout there is simply no fingerprint, and end-of-turn.sh then sweeps as if this hook did not exist.
. "${BASH_SOURCE[0]%/*}/lib.sh" 2>/dev/null || exit 0
command -v jq >/dev/null 2>&1 || exit 0

INPUT=$(cat)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
SID=$(hook_session_id "$INPUT")
[ -n "$SID" ] || exit 0

STATE=$(hook_state_dir)
mkdir -p "$STATE" 2>/dev/null || exit 0
# A new turn: forget the checkouts the last one edited (end-of-turn.sh clears them on green; a red turn keeps them).
: 2>/dev/null >"$STATE/$SID.roots"
: 2>/dev/null >"$STATE/$SID.start"

ROOT=$(hook_root "${CWD:-$PWD}") || exit 0
printf '%s\t%s\n' "$ROOT" "$(fingerprint "$ROOT")" >"$STATE/$SID.start" 2>/dev/null
exit 0
