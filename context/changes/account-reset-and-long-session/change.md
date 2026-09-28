---
change_id: account-reset-and-long-session
title: Password reset, rolling 30-day session and redirect continue after sign-in
status: implementing
created: 2026-09-28
updated: 2026-09-28
archived_at: null
---

## Notes

Roadmap S-09 (GitHub issue #5). PRD refs: FR-001, FR-002, FR-003; NFR session longevity (rolling 30 days); Access Control (continue to the requested page after sign-in). FR-003 (reset) is cut-order #3.

### 2026-09-28 — paused before planning (deferred to the end of M-1)

- **Finding:** FR-003's condition ("only if the auth provider sends email with no extra setup") does not hold. Supabase's built-in email "will refuse to deliver messages to addresses that are not part of the project's team" and is limited to 2 messages/hour (https://supabase.com/docs/guides/auth/auth-smtp). Reset for real users needs custom SMTP plus a redirect-URL allowlist entry in the hosted dashboard. `tech-stack.md` line 28-30 is wrong on this point.
- **Decision (user):** option 1: cut FR-003 (cut-order #3) to Parked. S-09 ships the rolling 30-day session and redirect-continue only. PRD / roadmap / tech-stack.md corrections go with this change. The whole slice waits until the very end of the milestone.
- **Findings for the plan:** `@supabase/ssr` 0.12.7 cookie default maxAge is 400 days, re-set only on token refresh (jwt_expiry 3600); middleware redirects to `/auth/signin` with no `next`; `api/auth/signin.ts` always goes to `/tonight`.
