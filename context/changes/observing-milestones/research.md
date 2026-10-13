---
date: 2026-10-11T12:00:00+02:00
researcher: Claude (observing-milestones agent)
git_commit: 3365b97
branch: feat/observing-milestones
repository: RafalSkwara/Sidereus
topic: "Observing milestones (M-3 S-06): celebrate a milestone once at save, list milestones on the progress page (FR-041, US-06)"
tags: [research, observations, progress, milestones, toasts, offline]
status: complete
last_updated: 2026-10-11
last_updated_by: Claude (observing-milestones agent)
---

# Research: Observing milestones (M-3 S-06)

Short research: the agent shipped S-05 observing-progress (`context/archive/2026-10-09-observing-progress/`) and reuses that context. The questions are only those S-06 adds.

## Research Question

Where in the code does a save happen, how does a save's result reach the next page, and what must a milestone celebration plug into, so that it shows once, at save, and never for an entry rated 1-2 (roadmap S-06 risk, `context/foundation/roadmap.md` "S-06")? The milestone set is PRD Open Question 18 (`context/foundation/prd.md:723-725`), owned by the owner.

## Summary

- **The rule already exists.**
  - Every milestone in the PRD's candidate set can be derived from S-05's pure `observingProgress(entries)` (`src/lib/progress/progress.ts`). It gives both checklists with `type` and `seen.firstNight` per object, plus the planet and Moon firsts with `firstNight`.
  - It applies `seenSummaries`, so only entries rated 3 or above count (`LOG_PENALTY_MIN_RATING`, `src/lib/engine/parameters.ts`). An entry rated 1-2 changes no checklist and therefore can reach no milestone, by construction.
- **No milestone state is stored anywhere.** Progress is computed on read from `observations` (S-05 decision). "Reached" can be derived the same way, including the night a milestone was reached:
  - first-of-a-kind: the earliest `firstNight` in the group;
  - count N: the N-th earliest `firstNight` in the list;
  - all of a set: the latest `firstNight`.
- **Saves happen in two routes, and both redirect.**
  - `POST /api/log` (`src/pages/api/log/index.ts`) creates an entry. It returns to the Tonight page in `from` with `?logged=<key>`, or to `/log?saved=<key>` for a manual entry.
  - `POST /api/log/[id]` (`src/pages/api/log/[id].ts`) edits an entry and returns to `/log?updated=<key>`, via `logNotice` in `src/lib/observations/redirect.ts:83`.
  - Delete (`/api/log/[id]/delete`) can only lose milestones, never reach one.
- **Save notices travel as fixed query params.**
  - Tonight shells read `?logged` and pass the text to their island (`src/pages/tonight/targets.astro:23-31`, same in `moon.astro` and `nights.astro`).
  - `/log` reads `saved`/`updated` through `readLogNotice` (`redirect.ts:91`).
  - Toasts clear only params in `TOAST_PARAMS` (`src/lib/toasts.ts`: `saved`, `updated`, `deleted`, `logged`, `skyChecked`) with `replaceState`.
- **Offline storage must never keep a celebration.** `NOTICE_PARAMS` (`src/lib/offline/copies.ts:35`, `logged`, `skyChecked`, `error`) marks Tonight URLs that are never stored, "so a copy stored with them would show 'Saved' forever". A new celebration param has to join this list, and `TOAST_PARAMS`, or a stored Tonight page would replay it.
- **The schema stays as it is.** No table is required for a derived milestone set. A stored "achieved" table would be the alternative if the owner wants a milestone to stay listed after the entry that reached it is deleted (see Open Questions).

## Detailed Findings

### Deriving milestones from S-05's model

- `ObservingProgress` = `{ messier: Checklist, caldwell: Checklist, firsts: First[] }`.
  - Checklist items carry `id`, `number`, `label`, `commonName`, `type` (a `DeepSkyType`, `src/lib/catalogue/index.ts:16-29`) and `seen: SeenSummary | null` (`count`, `firstNight`, `lastNight`).
  - `firsts` are the seven planets in solar order, then `moon`, each with `firstNight | null`.
- Type groups available for "first of a kind": `galaxy`, `globular-cluster`, `open-cluster`, `planetary-nebula`, `nebula`, `emission-nebula`, `reflection-nebula`, `supernova-remnant`, `cluster-with-nebula`, `asterism`, `double-star`, `other`. The PRD candidates need:
  - "first galaxy" = `galaxy`;
  - "first globular cluster" = `globular-cluster`;
  - "first nebula": the planetary, emission, reflection, generic nebula, supernova-remnant and cluster-with-nebula types. Which ones count is a definition to fix in the plan.
- The PRD candidate "the Moon's terminator" cannot be derived: the log records the target `moon`, not what was looked at. "First Moon" is the derivable equivalent.

### The save routes

- **Create** (`src/pages/api/log/index.ts`): parse, `isKnownTarget`, `observationStore.create`, then redirect. It runs with the request's RLS client (`context.locals.supabase`). Every `?error=` value is a fixed key, and nothing is logged.
- **Edit** (`src/pages/api/log/[id].ts`): parse, `isKnownTarget`, `observationStore.update`, then `logNotice("updated", target)`.
- **Reads:** `observationStore.listSeenEntries(client)` (S-05) is the one exact read of the rated ≥ 3 entries. It takes an exact count, pages past `max_rows`, and usually makes one request. It throws `LOAD_FAILED` with a cause.
- **Implication:** "reached by this save" = milestones reached after the write minus those reached before it, both derived from the same read and the same rule. For an entry rated 1-2 the two sets are equal, so the difference is empty. That is the roadmap's guard, and it falls out of the rule.

### Notices, toasts and offline

- `Notice` with `toast` and `param` (CLAUDE.md "Notices") is fixed from first paint. `ToastRegion` adopts it, runs a 10 s timer and clears the named param.
- Tonight's `logged` notice is built in the page shell and rendered inside the island, which is why copies with `?logged` are never stored (`copies.ts:35`, `tonightPageOf`/store guard near `:129`).
- `/log` renders its notice in the page itself (`src/pages/log/index.astro`, `readLogNotice`).

### The progress page

- `/log/progress` (`src/pages/log/progress.astro`) renders bands for Firsts, Messier and Caldwell from `observingProgress(entries)`. A "Milestones" band slots in the same way. Shared parts: `Band`, `divide-y` rows, `formatShortDate`, and the same row pattern as the Firsts band.

## Code References

- `src/lib/progress/progress.ts`: `observingProgress`, `Checklist`, `First`.
- `src/lib/engine/log.ts`: `seenSummaries`, `SeenSummary.firstNight`.
- `src/lib/observations/store.ts`: `listSeenEntries`, `create`, `update`.
- `src/pages/api/log/index.ts`, `src/pages/api/log/[id].ts`: the save routes and their redirects.
- `src/lib/observations/redirect.ts:83-101`: `logNotice`, `readLogNotice`.
- `src/pages/tonight/{targets,moon,nights}.astro`: shells reading `?logged`.
- `src/lib/toasts.ts`: `TOAST_PARAMS`.
- `src/lib/offline/copies.ts:35`: `NOTICE_PARAMS`.
- `src/pages/log/progress.astro`: the progress page.

## Architecture Insights

- **Milestones are a projection of progress, which is a projection of the log.** A pure `milestonesOf(progress)` next to `observingProgress` keeps one rule end to end and is testable with hand-written entries (test-plan §6.3).
- **The celebration is a notice.** It belongs in the existing toast pipeline (fixed param, never a value, cleared on show, never stored offline), not in a new mechanism.

## Historical Context (from prior changes)

- `context/archive/2026-10-09-observing-progress/`: the progress model, the paged seen read, the "not seen yet" mark, and the decision to compute on read with no stored counters.
- `context/archive/2026-10-05-offline-night-plan/`: why notice params are never stored offline.
- `context/archive/2026-10-08-ui-user-adjustments/`: toasts and `TOAST_PARAMS`.

## Related Research

- `context/archive/2026-10-09-observing-progress/research.md`

## Open Questions

These are for the owner; the plan proposes defaults.

1. **The milestone set** (PRD OQ 18): which milestones, and which types count as a "nebula".
2. **What happens when the reaching entry is deleted or re-rated.** Does the milestone disappear with it (derived), or stay listed forever (stored)? And should reaching it again celebrate again?
3. **What the celebration looks like:** the existing toast with a distinct icon and a link to progress, or something bigger.
