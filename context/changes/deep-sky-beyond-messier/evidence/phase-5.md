# Phase 5 evidence: contract migration and docs

Run on 2026-10-06 against local Supabase.

## 5.5: existing entries survive the drop

Done first, on the Phase 4 schema:

1. Before the drop, the local database held 995 Messier, 117 planet, 84 Moon and 5 deep-sky entries; only the Messier rows had `messier` filled. A new test user logged one entry of each kind (M31, the Moon, Jupiter, NGC7000) through the manual picker. M31 got `messier = 31` from the old trigger.
2. `npx supabase migration up` applied `20261006200000_drop_observation_messier.sql` without a reset. All 1,205 rows were kept, the `messier` column was gone, and the `observations_sync_target` trigger was gone.
3. After a rebuild with the regenerated types, the user's `/log` listed M31, NGC 7000, Jupiter and Moon (`phase-5/log-after-drop.png`), and each of the four entries was edited (rating 5) and saved: `?updated=` for NGC7000, jupiter, moon and M31.

## Gates

- 5.1: `npx supabase db reset` applied every migration cleanly, and `test:db` passed (110).
- 5.2: `npm run db:types` drops exactly the 3 `messier` lines (Row, Insert, Update); the regenerated file is committed.
- 5.3: `grep messier` over the drop migration, `tests/db` and `src/lib/observations` finds only the migration itself and the store's header comment.
- 5.4: vitest 807 passed (1 skipped, 6 todo); `astro check` 0 errors; eslint 0 errors; smoke passed; full e2e 31 passed, 2 skipped.
