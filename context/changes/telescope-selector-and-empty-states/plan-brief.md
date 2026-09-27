# Telescope Selector and Empty States — Plan Brief

> Full plan: `context/changes/telescope-selector-and-empty-states/plan.md`

## What & Why

Roadmap S-08 (FR-019, FR-021). A user who owns two or more telescopes can choose which one Tonight ranks for, and the ranking says which telescope it is. Deleting gear must leave Tonight honest instead of silently changing what it shows.

## Starting Point

Deletion is already unguarded, and the empty states for no site, no telescope and neither already exist on Tonight. With no eyepieces the ranking already drops the pair lines, but without saying why. Tonight always uses the oldest telescope, and there is no selector.

## Desired End State

With 2–3 telescopes, pill links under the Tonight title switch the ranking; with 4 or more, a dropdown does. The last pick is remembered on the device, and the ranking heading reads "For your <telescope>". With no eyepieces, a muted notice links to adding one. A Playwright spec walks every path: add, switch by pill and by dropdown, remember, and delete eyepieces, telescopes and the site.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Selector style | Pills for 2–3 telescopes, native dropdown for 4+ | One tap for the common case, still compact for big collections | Plan (user) |
| Default telescope | Remember the last pick in a `sidereus-telescope` cookie, else the oldest | Users who favour a second scope don't re-pick nightly; the ranking always names the scope, so the choice is never hidden | Plan (user) |
| No-eyepieces case | Short muted notice + link to `/gear/eyepieces/new` | Explains the missing pairs and gives a way back, like the other empty states | Plan (user) |
| How the choice reaches the ranking | `?telescope=<id>` on the page, passed to the server island as a prop | The island cannot see the page query; ids are safe in URLs, coordinates never travel | Plan (delegated) |
| Unknown, deleted or foreign id | Fall back to the oldest telescope silently | RLS already hides others' telescopes, and an error would punish a stale bookmark | Plan (delegated) |
| Post-log redirect | Unchanged (`/tonight?logged=N`) | The cookie brings the selection back | Plan (delegated) |
| Dropdown implementation | Plain Astro GET form + visible "Show" button, a small `<script>` adds submit-on-change and hides it; no React island | Works with no JS by construction and is covered by e2e | Plan review F1 (user) |
| E2E helper duplication | Extract `onboardInMadrid` / `waitForHydration` into `tests/e2e/helpers.ts` | A third copy would otherwise be needed | Plan (delegated) |

## Scope

**In scope:**
- Choice helper (`src/lib/tonight/telescope-choice.ts`) with unit tests
- Cookie write in the `/tonight` shell, prop into `TonightContent`
- `TelescopeSelector.astro`: pills, or a plain GET-form dropdown with a small submit-on-change script
- "For your <telescope>" line on the ranking; the no-eyepieces notice; EN + PL keys
- E2E spec for the selector and deletion empty states; shared e2e helper; CLAUDE.md line

**Out of scope:**
- Site switching and the 7-night view (S-05)
- Displaying log entries whose gear was deleted (S-07)
- Per-account (DB) telescope preference; delete-flow changes or undo

## Architecture / Approach

`/tonight?telescope=<id>` → the shell checks the UUID shape, sets the cookie and passes `telescopeId` (the query, else the cookie) into `<TonightContent server:defer>` → the island loads the user's telescopes as today and calls `chooseTelescope` (requested one if owned, else oldest) → `selectorKind(count)` picks none, pills or dropdown → `buildTonight` runs with the chosen telescope, unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Telescope selector | Choice helper, cookie, pills/dropdown, "For your …" line | Cookie set in the shell vs island request ordering |
| 2. No-eyepieces notice and deletion coverage | Notice + link, e2e spec over pills, dropdown and every delete path, shared e2e helper | E2E runtime and confirm-dialog handling |

**Prerequisites:** S-01, S-02, F-03 done (all merged); local Supabase + forecast fixture for e2e.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Whether an Astro component `<script>` runs inside server-island HTML is unverified; if it does not, the dropdown keeps its visible "Show" button (still works, one extra tap).
- The cookie is per device, not per account: two accounts on one browser share it. A foreign id falls back harmlessly.

## Success Criteria (Summary)

- A two-telescope user switches the ranking in one tap and sees which telescope it is for; the choice survives a reload.
- Deleting eyepieces, telescopes or the site never breaks Tonight; each case shows the matching message and link.
- The e2e spec pins these paths in CI.
