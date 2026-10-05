# Landing page in Nightfall, signed-out only — Plan Brief

> Full plan: `context/changes/ui-landing/plan.md`
> Research: `context/changes/ui-landing/research.md`

## What & Why

The landing page `/` is the last S-10 view still in its pre-Nightfall form, and the decided rule "`/` is for
signed-out visitors; a signed-in user goes to `/tonight`" was never built. Five charges (C1–C5): hand-rolled CTAs
with a near-invisible focus ring, off-role type and radii, a composition that doesn't show the product's look, the
missing redirect, and a product screenshot of a Tonight page that no longer exists.

## Starting Point

`Welcome.astro` uses colour tokens but no shared component and no type role (13 scan hits); `GET /` returns 200 for a
signed-in user; `public/landing/tonight.png` is the old gold/serif Tonight.

## Desired End State

A visitor opens `/` into Tonight's sky (the Nightfall signature) with the question as the headline, "Get started"
and "Sign in" as the app's real buttons, then two ruled bands (how it works, what Tonight looks like now). A
signed-in user never sees it: `/` sends them to `/tonight`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where the redirect lives | `index.astro`, 302 | One page, one rule; the middleware stays about gating | Plan (delegated) |
| Hero | `TonightSky` + `PageHeader`, Topbar on a zenith strip | Reuses the signature and the `TonightPageSky` pattern; no new component | Plan (visual) |
| `h1` | The tagline, not "Sidereus" | The name is already in the Topbar; the question is the hook | Plan (visual) |
| Alignment | Left, like `/gear` and `/tonight` | One reading line across the app | Plan (visual) |
| New tokens | None | Every value the view needs exists | Research |
| Screenshot | Recapture EN/dark 1280×800 with the existing spec | Same tool, same framing as before | Plan |
| Tests | One modest e2e (redirect + CTA hrefs) | Pins what screenshots can't show | Plan |

## Scope

**In scope:** `index.astro`, `Welcome.astro`, `landing.*` keys, `tonight.png`, one CLAUDE.md line, one e2e spec.

**Out of scope:** Topbar/TabBar/shell edits, new tokens or components, new copy claims, per-locale screenshots.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Entry point and copy | Redirect + keys | e2e sign-up against shared local Supabase |
| 2. The view in Nightfall | Rebuilt `Welcome` | PL overflow at 390 px |
| 3. Screenshot, states, guard | New image, matrix, rule | Capture spec drift after S-11 |

**Prerequisites:** local Supabase running; ports 4324/4403.
**Estimated effort:** one session.

## Open Risks & Assumptions

- The capture spec signs up a user on local Supabase (allowed: local stack, throwaway email).
- Merge conflicts with the other UI passes are limited to `en.ts`/`pl.ts` (`landing.*` only) and `CLAUDE.md` (one line).

## Success Criteria (Summary)

- Signed-in `/` → `/tonight`; signed-out `/` reads as Nightfall in all themes and both languages at 390 and 1280 px.
- Zero scan hits; all repo checks green.
