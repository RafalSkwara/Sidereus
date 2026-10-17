---
change_id: auth-loose-ends
title: Auth loose ends: signed-in auth pages and sign-up next
status: planned
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Notes

M-4 S-06 (GitHub #174), ui-auth D1 and D2. D1: a signed-in visitor opening /auth/signin or /auth/signup lands on /tonight. D2: sign-up from a gated link continues to the requested page via `next`, as sign-in does with `safeNextPath`. `safeNextPath` stays the one rule for a safe `next`; no open redirects; never forward Supabase `error.message`; the service worker's purge on `POST /api/auth/signin` and `/api/auth/signup` must keep working; S-07 logging conventions (`log-failure.ts`) apply. Modest tests (owner preference).
