#!/usr/bin/env bash
# UserPromptSubmit (the main thread) and SubagentStart (a subagent): remember what the agent's checkout looked like
# when its turn or run began, so end-of-turn.sh skips a checkout this agent did not change. A checkout the agent did
# change is then held to all of its uncommitted work. Each agent has its own state (lib.sh), so a new prompt never
# erases a running subagent's record, and a subagent is never judged on what the parent left half done.
# UserPromptSubmit adds stdout to the prompt, so this script prints nothing and always exits 0: without jq, a session
# or a checkout there is simply no fingerprint, and end-of-turn.sh then sweeps as if this hook did not exist.
. "${BASH_SOURCE[0]%/*}/lib.sh" 2>/dev/null || exit 0
command -v jq >/dev/null 2>&1 || exit 0

INPUT=$(cat)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
KEY=$(hook_state_key "$INPUT") || exit 0
STATE=$(hook_state_dir) || exit 0

# A new turn or run for this agent: forget what it edited last time.
: 2>/dev/null >"$STATE/$KEY.roots"
: 2>/dev/null >"$STATE/$KEY.start"

ROOT=$(hook_root "${CWD:-$PWD}") || exit 0
printf '%s\t%s\n' "$ROOT" "$(fingerprint "$ROOT")" 2>/dev/null >"$STATE/$KEY.start"
exit 0
