# Plan row 3.5: service worker purge on sign-in and sign-up (2026-10-17)

`sw-purge-check.mjs` drives a real Chromium against a production preview (local Supabase, forecast fixture, real clock).
Per round: a Tonight copy is stored under the controlling worker; only the auth cookies are deleted (the copy stays, and
no signed-out page is rendered, because a signed-out render purges by itself: `data-signed-out` in `page-state.ts`); then
the same open page posts the form the way the form would, with `next`, and the stored copies must be gone.

- `sw-purge-check.log`: the current code. `POST /api/auth/signin` (`next=/gear`) and `POST /api/auth/signup`
  (`next=/log`) each purged every copy (`RESULT: purge on sign-in and sign-up still works`).
- `sw-purge-check-broken-worker.log`: sensitivity check, never committed as code. The same script against a build whose
  `src/sw.ts` lacked `/api/auth/signup` in `AUTH_POSTS`: round 1 passes, round 2 fails (the copy survives), so the
  script can tell a working purge from a broken one. `src/sw.ts` was restored with `git checkout`.
- Why not the literal plan wording ("open `/auth/signup`, sign up, check `/offline`"): opening the signed-out page
  already purges, so that sequence cannot show which of the two caused it.
