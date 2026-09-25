# Handoff — 2026-09-25

Where Sidereus stands at the end of the S-01 session, and what to pick up next. Read this, then `context/foundation/roadmap.md`.

## Just finished: S-01 Sites and gear management

- Merged in PR #17 (merge commit `ff142e1`); archived at `context/archive/2026-09-24-sites-and-gear-management/`. Issue #4 is closed and the board card is `done`.
- **Shipped:**
  - `sites`, `telescopes` and `eyepieces` tables with per-operation RLS
  - `npm run test:db`, the isolation suite (21 tests)
  - `src/lib/gear/`: zod schemas, 0.01° rounding, time zone derived from coordinates unless pinned, and a store with fixed error messages
  - the `/gear` pages with create, edit and delete for all three
  - the smoke-test gear steps
- **CI:** the `smoke` job runs `test:db`, a types-drift check and the smoke test against local Supabase. The new `migrate` job pushes migrations to the hosted project on every push to `main`, using secrets in the GitHub `production` environment. The first run succeeded, and the tables exist in the hosted database.
- **Verification:**
  - All automated gates passed, and the break-checks were done.
  - The manual checks passed on production after the merge.
  - No `/10x-impl-review` was run, which the user accepted at archive time.

## Things a new session should know

- **Local `.env` and `.dev.vars` point at the hosted Supabase.** Schema changes reach it only through the `migrate` job after a merge, so run a feature that needs new tables against local Supabase or wait for the merge. Never run the smoke test against the hosted project: it signs up real users. The CLAUDE.md tripwires cover this.
- **App deploys are still manual.** Run `npx wrangler deploy` from an up-to-date `main`; F-02 automates this. Migrations run before the app deploys, so they must stay additive until F-02.
- **Gear routes redirect with fixed messages** such as "Could not save the site…", on purpose, so coordinates can't leak into URLs. To debug, reproduce the problem against local Supabase. A 302 has no response body in DevTools: read the `Location` header and turn on Preserve log.
- **Store read API:** `siteStore`, `telescopeStore` and `eyepieceStore` have `list`, `get`, `create`, `update` and `remove`.
  - `list` and `get` throw an Error with a fixed message when the database fails.
  - `get` returns `null` when the row is missing, belongs to someone else, or the id is malformed.
  - `toEngineSite(record)` turns a stored site into the engine's `Site`, ready for S-02.
- **Known loose ends from S-01, all minor:**
  - The gear Save button uses the purple auth style while the rest is amber.
  - The database rounds telescope and eyepiece mm values to 1 decimal without telling the user.
  - A manual time zone is stored as typed, so a case variant like "europe/warsaw" isn't converted to the canonical spelling.
- **Workflow memory:** mirror every status change on GitHub Projects board #1 (check `gh auth status` has the `project` scope first). Delegated subagents need the `nvm use` prefix, and their progress should be checked after a few minutes.
- **Untracked `.mcp.json`:** it has never been committed, by the user's choice. Leave it out of commits.

## Open items

1. **F-01 `verified-ephemeris-core` isn't archived yet.** The board says `done`, but issue #3 is still OPEN, the roadmap still says `in-progress`, and the folder is still under `context/changes/`. Run `/10x-archive verified-ephemeris-core` and close #3. S-02 lists F-01 as a prerequisite.
2. `context/changes/bootstrap-verification/` is still active. Check whether it should be archived.

## Suggested next task

- **S-02 `tonight-verdict-and-ranking`** (GitHub #7) is the north star: the Tonight verdict, the dark window and the ranked Messier objects. Its prerequisites are F-01 (open item 1) and S-01 (done). Start with `/10x-new tonight-verdict-and-ranking`, then run `/10x-plan`.
- Alternatives:
  - **S-09 `account-reset-and-long-session`** (#5): status `ready`, no prerequisites.
  - **F-02 `ci-test-and-deploy-gate`** (#6): removes the manual deploy.
