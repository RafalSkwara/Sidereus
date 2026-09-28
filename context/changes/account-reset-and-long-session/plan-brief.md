# Rolling 30-Day Session and Continue-After-Sign-In — Plan Brief

> Full plan: `context/changes/account-reset-and-long-session/plan.md`

## What & Why

The last M-1 slice (roadmap S-09, GitHub #5). A user sent to sign-in from a page they asked for lands back on that exact page afterwards, and a session ends only after 30 days without use (PRD Access Control and NFR session longevity). Password reset (FR-003) is cut to Parked. Supabase's built-in email reaches only project team members, which fails the PRD's own "no extra email setup" condition.

## Starting Point

The middleware sends anonymous users to a bare `/auth/signin`, and sign-in always lands on `/tonight`. `@supabase/ssr` 0.12.7 writes auth cookies with a fixed 400-day lifetime and ignores `cookieOptions.maxAge`. Refreshes re-write them hourly while in use, so today's session rolls over 400 days. The PRD, roadmap and tech-stack still promise reset.

## Desired End State

Signed out, opening `/log/new?object=31&night=…` shows sign-in with "Sign in to continue.", and signing in lands on that same prefilled form. A wrong password keeps the target. Unsafe or missing targets fall back to `/tonight`. The auth cookie lives 30 days from the last refresh. The documents record that reset is parked and why.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Password reset (FR-003) | Cut to Parked; S-09 ships session + continue only | Built-in Supabase email only reaches team members, so the PRD's condition fails | User (2026-09-28) |
| Idle lifetime | Exactly 30 days since the last refresh | Matches the PRD number; shorter exposure on shared devices | User |
| Sign-in note | One line "Sign in to continue." only when redirected | Explains why the user is on sign-in without mapping URLs to page names | User |
| Where the lifetime is enforced | Our `setAll` via `withSessionMaxAge`, removals kept at 0 | The library overrides `maxAge` itself | Delegated |
| `next` validation | Same-origin path only; not `//`, `/\`, `/api/`, `/auth/`; query kept, fragment dropped | Closes open redirects and never GETs a POST route | Delegated |
| Which requests carry `next` | Only GETs of gated non-API pages | Gated API routes are POST targets | Delegated |
| Sign-up link | Does not carry `next` | New accounts must onboard first anyway | Delegated |

## Scope

**In scope:**
- `src/lib/auth-redirect.ts` guard, middleware redirect with `?next=`, sign-in route/page/form, EN/PL note
- `src/lib/session-cookie.ts` 30-day lifetime used in `src/lib/supabase.ts`
- Smoke steps (exact `?next=`, safe/unsafe `next`, `Max-Age=2592000`), one e2e spec
- PRD, roadmap, tech-stack and CLAUDE.md corrections

**Out of scope:**
- Password reset; `next` through sign-up; redirecting signed-in users off `/auth/signin`
- Preserving a form POST whose session expired; server-side session caps

## Architecture / Approach

Two pure, unit-tested modules next to the middleware (like `protected-routes.ts`): one decides safe `next` targets, the other the cookie lifetime. The middleware, the sign-in route and page call the first; the Supabase client's `setAll` calls the second. The smoke test proves both over HTTP, and one e2e spec proves the browser flow.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Continue after sign-in | `?next=` through middleware → sign-in → target, with the note | Open-redirect shapes; the guard's tests carry them |
| 2. 30-day session + docs | Auth cookie `Max-Age=2592000`; FR-003 parked in PRD/roadmap/tech-stack | Library behaviour change in a future `@supabase/ssr`; the smoke assertion catches it |

**Prerequisites:** F-03 done (tokens, message catalogue). Local Supabase for smoke and e2e. No migration.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- "30 days idle" counts from the last token refresh, which happens at most hourly during use, so the window can be up to an hour shorter than "30 days since the last visit".
- Existing sessions keep the 400-day cookie until their next refresh re-writes it.
- An expired session during a form POST still loses that submission (unchanged, out of scope).

## Success Criteria (Summary)

- Following a bookmark or shared link while signed out ends on that page after one sign-in.
- A user who hasn't opened the app for 30 days is asked to sign in again. Anyone using it at least monthly never is.
- No document still promises password reset in M-1.
