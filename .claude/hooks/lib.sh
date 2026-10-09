# Shared by the Claude Code hooks in this directory (test rollout Phase 5, testing-quality-gates-wiring).
# Sourced, never run. bash 3.2-safe (macOS /bin/bash): no mapfile, no `set -u` with empty arrays.

# Per-agent state under the user's temp dir: the checkouts an agent edited (`<session>.<agent>.roots`) and its start
# fingerprints (`<session>.<agent>.start`, one "root<TAB>hash" line per checkout). `<agent>` is the payload's
# `agent_id` inside a subagent and `main` otherwise, so the parent and each subagent only ever answer for their own
# work. The directory is private to the user (mode 700, owned by them), or the hooks ignore it.
hook_state_dir() {
  local dir="${TMPDIR:-/tmp}/claude-hooks"
  mkdir -m 700 -p "$dir" 2>/dev/null
  [ -d "$dir" ] && [ -O "$dir" ] || return 1
  printf '%s' "$dir"
}

# "<session>.<agent>" for a hook payload, reduced to characters that are safe in a file name; empty without a session.
hook_state_key() {
  local sid agent
  sid=$(printf '%s' "$1" | jq -r '.session_id // empty' 2>/dev/null | tr -cd 'A-Za-z0-9_-')
  agent=$(printf '%s' "$1" | jq -r '.agent_id // empty' 2>/dev/null | tr -cd 'A-Za-z0-9_-')
  [ -n "$sid" ] || return 1
  printf '%s.%s' "$sid" "${agent:-main}"
}

# The git top-level of a directory, but only for a checkout that carries these hooks: other repositories under
# ~/projects, and Sidereus branches from before the hooks, are left alone.
hook_root() {
  local root
  root=$(git -C "$1" rev-parse --show-toplevel 2>/dev/null) || return 1
  [ -f "$root/.claude/hooks/end-of-turn.sh" ] || return 1
  printf '%s' "$root"
}

# What a checkout's uncommitted work looks like: the diff against HEAD, every untracked non-ignored file's name, a
# symlink's target (never followed), and each regular file's blob hash (one batched `git hash-object`, no shell per
# file and no argument-length limit), hashed together. Equal fingerprints mean nothing changed there in between.
fingerprint() {
  (
    cd "$1" || exit 1
    {
      git diff HEAD --binary 2>/dev/null
      git ls-files -o --exclude-standard -z 2>/dev/null | while IFS= read -r -d '' f; do
        if [ -L "$f" ]; then printf 'link %s -> %s\n' "$f" "$(readlink "$f")"; else printf 'file %s\n' "$f"; fi
      done
      git ls-files -o --exclude-standard -z 2>/dev/null | while IFS= read -r -d '' f; do
        [ -f "$f" ] && [ ! -L "$f" ] && printf '%s\n' "$f"
      done | git hash-object --stdin-paths 2>/dev/null
    } | git hash-object --stdin
  )
}
