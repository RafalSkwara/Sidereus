# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Put every module that touches site coordinates under the no-console lint

- **Context**: Any phase that adds a module, route or page reading `SiteRecord`s or coordinates (stores, API routes under `src/pages/api/`, pages, Tonight/forecast code) in Sidereus.
- **Problem**: The coordinate-privacy NFR is enforced by `no-console: error` only on the paths listed in `gearConfig.files` (eslint.config.js); new modules outside that list rely on comments alone (S-06 impl review F2: `src/lib/observations/**`, `src/pages/api/log/**`, `src/pages/log/**` were uncovered).
- **Rule**: When a change adds a file or directory that handles site records or coordinates, add its glob to `gearConfig.files` in `eslint.config.js` in the same phase, and list that edit in the plan's Changes Required.
- **Applies to**: plan, implement, impl-review

## Filter and order every per-user list query

- **Context**: Store methods that read a per-user table through PostgREST (`client.from(...).select(...)` without a single-row filter), especially reads that feed the ranking or any count shown to the user.
- **Problem**: PostgREST caps responses at `max_rows` (1000, `supabase/config.toml`) without an error; an unfiltered, unordered read is cut off arbitrarily, so counts go wrong and results can change between loads, breaking the determinism NFR (S-06 impl review F1: `listForRanking`).
- **Rule**: Never read a per-user list without narrowing it to the rows the caller needs and giving it a deterministic `.order()`; if the result can still approach `max_rows`, aggregate in SQL or paginate, and say which in the plan.
- **Applies to**: plan, plan-review, implement, impl-review
