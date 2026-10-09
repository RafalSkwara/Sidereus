# Shared by the Claude Code hooks in this directory (test rollout Phase 5, testing-quality-gates-wiring).
# Sourced, never run. bash 3.2-safe (macOS /bin/bash): no mapfile, no `set -u` with empty arrays.

# Per-session state: the checkouts edited this turn (`<session>.roots`) and the turn-start fingerprints
# (`<session>.start`, one "root<TAB>hash" line per checkout).
hook_state_dir() {
  printf '%s/claude-hooks' "${TMPDIR:-/tmp}"
}

# The session id, reduced to characters that are safe in a file name.
hook_session_id() {
  printf '%s' "$1" | jq -r '.session_id // empty' 2>/dev/null | tr -cd 'A-Za-z0-9_-'
}

# The git top-level of a directory, but only for a checkout that carries these hooks: other repositories under
# ~/projects, and Sidereus branches from before the hooks, are left alone.
hook_root() {
  local root
  root=$(git -C "$1" rev-parse --show-toplevel 2>/dev/null) || return 1
  [ -f "$root/.claude/hooks/end-of-turn.sh" ] || return 1
  printf '%s' "$root"
}

# What a checkout's uncommitted work looks like: the diff against HEAD plus every untracked, non-ignored file
# (name and content), hashed. Equal fingerprints at turn start and turn end mean the turn changed nothing there.
fingerprint() {
  (
    cd "$1" || exit 1
    {
      git diff HEAD --binary 2>/dev/null
      git ls-files -o --exclude-standard -z 2>/dev/null |
        xargs -0 -I{} sh -c 'printf "%s\n" "$1"; cat "$1" 2>/dev/null' _ {}
    } | git hash-object --stdin
  )
}
