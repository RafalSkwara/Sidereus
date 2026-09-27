# Observation Log Management and Manual Entry — Plan Brief

> Full plan: `context/changes/observation-log-management/plan.md`

## What & Why

Roadmap slice S-07 (PRD FR-017, FR-022, FR-021; GitHub #12). Right now a beginner can only write to their observation log from the Tonight ranking and has no way to read it. This slice adds the log itself: view entries, fix or delete a mistaken one, add an entry for any Messier object by hand, and keep reading entries whose gear has been deleted. "Users mistype and log the wrong object; journals in software are edited" (PRD, FR-017).

## Starting Point

S-06 shipped the `observations` table with per-operation RLS, nullable gear references that become null when gear is deleted, and name snapshots, so **no migration is needed**. It also shipped `/log/new` (the object is fixed by the ranking), `POST /api/log`, and a store with only `create` and `listForRanking`. Tonight reads the log live on every load.

## Desired End State

A **Log** link in the top bar opens `/log`, with entries grouped by observing night, newest first, 50 per page. **Add entry** opens a form with a searchable object picker. Each entry opens an edit page with Delete at the bottom. Entries on deleted gear read "Cabin (deleted)" and can still be edited. Editing a rating down to 1-2, or deleting an entry, removes the object's penalty and "Seen" tag on Tonight at the next load. All copy is in EN and PL, with theme tokens only.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Log list layout | Grouped by observing night, newest first | The observing night is the log's unit, so the page reads like an observing journal (user) |
| Object picker for manual entry | Searchable combobox (number or name, diacritic-tolerant) | Faster on a phone than scrolling through 110 options (user) |
| Where edit and delete live | `/log/<id>` edit page with Delete + confirm at the bottom | Same pattern as gear, and the list stays uncluttered (user) |
| Schema | No migration | S-06's RLS, `set null` FKs and name snapshots already cover every operation (delegated) |
| Pagination | 50 entries per page, order night ↓, created_at ↓, id; fetch 51 rows to detect "older" | Lesson rule: every per-user list read is narrowed and deterministically ordered (delegated) |
| Manual vs ranking entry | Same `/log/new`; hidden `from=log` switches to picker mode and returns to `/log` | Reuses S-06's page, route and validation; the ranking flow is unchanged (delegated) |
| Editing an entry on deleted gear | Select offers "<name> (deleted)" as the kept value; the store allows it only when the id is already null | Keeps FR-021 entries editable without letting an edit null a live reference (delegated) |
| Night bound for a kept deleted site | Latest Tonight night over the user's current sites, else today at UTC+14 | The deleted site's time zone is gone, and this bound never rejects a real night (delegated) |
| Names after gear rename | Entry shows the name snapshot taken at its last save | Journal semantics, and an edit refreshes it (delegated) |
| Protecting `/log` | Segment-boundary matcher `isProtectedPath` replaces the `startsWith` check | `"/log/"` left `/log` open, and `"/log"` would also match `/login` (delegated) |
| Phase breakdown | 4 phases, as below | Approval delegated per the minimal-questions agreement; review the brief to adjust |

## Scope

**In scope:**
- Store `list` / `get` / `update` / `remove`, update schema, redirect helpers, and DB tests
- `/log` page (grouped, paginated, with notices and an empty state), the Log nav link, and route protection
- `MessierPicker` combobox, pure `filterMessier`, and manual mode on `/log/new`
- `/log/<id>` edit page, update and delete routes, "(deleted)" gear options
- EN + PL copy, unit, DB and e2e tests

**Out of scope:** migrations, penalty changes, non-Messier objects, notes, list filters, bulk or inline delete, undo, a link from Tonight's tag to the log, the post-login redirect (S-09).

## Architecture / Approach

Bottom-up, reusing S-06's shapes. The work runs **store** (paginated list, get, update with the ownership and kept-deleted rules, delete returning the object) → **read path** (`/log` server page, grouping consecutive entries by night) → **manual write path** (combobox island fed with options from the page, so the catalogue JSON stays out of the bundle) → **edit and delete** (`/log/<id>` + `POST /api/log/<id>` + `/delete`, redirecting to `/log?updated|deleted=<n>`). Tonight needs no code: it reads the log live.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Log store and schemas | list, get, update, remove + DB tests | The kept-deleted-gear rule and the fallback night bound |
| 2. Log page, nav, protection | `/log` grouped by night, Log link, `/log` gated | Protection gap on `/log`; grouping split across pages |
| 3. Manual entry with picker | Combobox + `/log/new?from=log` | Accessible combobox (keyboard, screen reader) |
| 4. Edit and delete | `/log/<id>`, update and delete routes, e2e journey | Editing entries whose gear was deleted |

**Prerequisites:** S-06 done (it is). Local Supabase for `test:db`, e2e and manual checks.
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- The combobox is the only new interactive component. If accessibility proves costly, a native `<select>` is a drop-in fallback with the same hidden `messier` field.
- A beginner's log is assumed to stay small. 50 per page keeps any single read far below `max_rows`.
- The e2e spec runs on the real clock, so it never asserts ranking positions. The effect of edits and deletes on the penalty is pinned by DB tests against `listForRanking`.

## Success Criteria (Summary)

- A user reads their whole log by night, fixes a wrong entry and deletes a duplicate in a few taps.
- A user logs any Messier object without going through Tonight.
- Entries whose site or telescope was deleted stay readable and editable, and Tonight reflects every edit and deletion.
