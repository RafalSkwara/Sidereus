# Auth Loose Ends (M-4 S-06) — Plan Brief

> Full plan: `context/changes/auth-loose-ends/plan.md`
> Research: `context/changes/auth-loose-ends/research.md`

## What & Why

Two loose ends from the ui-auth pass (D1, D2; GitHub #174). A signed-in visitor who opens `/auth/signin` or `/auth/signup` should not see a form: they go to the safe `?next=` or to `/tonight`. A visitor who signs up from a gated link should continue to that page afterwards, as sign-in already does (PRD Access Control: "continues to the requested page afterwards").

## Starting Point

The middleware gates only protected paths, so the two auth pages render for a signed-in user. `safeNextPath` and `signInUrl` carry `next` through sign-in, but the sign-in page's "Sign up" link, the sign-up page, `POST /api/auth/signup` and onboarding all drop it; onboarding always ends on `/tonight`.

## Desired End State

Signed in, both auth pages answer a 302. From `/log` the path sign-in → sign-up → onboarding → `/log` keeps `next` all the way; on the hosted project the confirm-email page's "back to sign in" link keeps it too. Every redirect without `next` is byte-identical to today's. An unsafe `next` is ignored everywhere and never reaches a URL, a log or Supabase.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where a new user lands after sign-up from a gated link | Onboarding first, then `next` (`/onboarding?next=…`) | A new user has no gear and onboarding is the only automatic first-run setup; skipping it leaves empty pages | Plan (agent's earlier decision stands) |
| Signed in on an auth page with a safe `?next=` | Go to `next`; else `/tonight` | The owner's wording says `/tonight`; honouring a safe `next` costs nothing and matches sign-in | Plan (agent's earlier decision stands) |
| How `next` reaches the onboarding POST | Query on the wizard's `action` URL | The island stays untouched; browsers keep a form action's query on `POST` | Research |
| Confirm-email page | Carries `next` to its "back to sign in" link only | Hosted confirmation is on, so otherwise D2 never works there; the email's own link is Supabase's | Plan |
| One rule for a safe `next` | `safeNextPath`; new `withNext(path, next)` builds the URLs | No second spelling of the rule; `signInUrl` keeps its output | Research |
| Logging | None new | An unsafe `next` is ignored, so no new failure branch; S-07 conventions unchanged | Research |
| Tests | No new unit test; smoke steps with exact `Location`s; one e2e journey; manual purge check | Test-diet rubric: HTTP smoke and one journey hold the behaviour, a unit test would restate the code | Plan (owner preference) |
| Note on the sign-up page from a gated link | Not added | Owner decision, 2026-10-17: the sign-in note one click earlier is the only cue | Owner |

## Scope

**In scope:** the middleware redirect (D1); `next` through the sign-in link, sign-up page, form and route, confirm-email and onboarding (D2); smoke steps; one e2e journey; the `CLAUDE.md` and test-plan counts.

**Out of scope:** `next` in the Supabase email, a D1 redirect on `/auth/confirm-email`, any change to `src/sw.ts` or `safeNextPath`, new logs, new strings, database changes.

## Architecture / Approach

`isAuthEntryPath` and `withNext` join `safeNextPath` in `src/lib/auth-redirect.ts`. The middleware redirects a signed-in `GET` of an auth entry path right after resolving the user. The sign-up route mirrors `signin.ts` (read `next` through `safeNextPath`, keep it on failures with `URLSearchParams`, carry it to `/onboarding` or confirm-email); the onboarding page and route read it the same way and finish on `next ?? "/tonight"`. The service worker is untouched: its purge depends on the two POST pathnames, which stay.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. D1 | Middleware redirect, three smoke steps | A redirect loop or an open redirect (neither: `safeNextPath` refuses `/auth*` and foreign origins) |
| 2. D2 | `next` through links, form, sign-up route, confirm-email, onboarding; smoke steps | A redirect that is no longer byte-identical without `next`, breaking existing specs |
| 3. Journey and docs | One e2e journey through the service worker, helper split, docs and counts, manual purge check | The purge path (verified by hand) and the full e2e run before the PR |

**Prerequisites:** local Supabase and a production preview (ports 4339 / 4407), `nvm use`.
**Estimated effort:** about 2 sessions across 3 phases, one PR.

## Open Risks & Assumptions

- The hosted project's confirmation email link carries no `next`; that stays parked with password reset (FR-003).
- Assumes a form action's query string survives a `POST` (true in browsers; the smoke step reads the rendered action and the e2e journey proves the submit).

## Success Criteria (Summary)

- Signed in, `/auth/signin` and `/auth/signup` never render; a safe `next` is honoured, an unsafe one ignored.
- From a gated link, a new user signs up, finishes onboarding and lands on the page they asked for, in English and Polish.
- The whole e2e suite and the smoke walk are green, and a sign-up still purges stored offline copies.
