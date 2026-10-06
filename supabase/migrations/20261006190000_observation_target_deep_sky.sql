-- Caldwell objects as observation targets (deep-sky-beyond-messier, phase 4): the closed target grammar shared with
-- `src/lib/targets` gains the NGC and IC keys (`NGC7000`, `IC405`: the catalogue's space-free ids, no leading
-- zero, up to four digits), next to the Messier ids (`M1`…`M110`), the seven planet keys and `moon`.
--
-- The check only fixes the shape. Whether the catalogue lists the object (`NGC1` is well-formed and unknown) is the
-- app's `isKnownTarget`, because the catalogue is data in the app, not in the database.
--
-- Additive and backward-compatible with the app deployed before it (CI migrates before it deploys): that app never
-- writes an NGC or IC key, and every key it does write still passes the check.
--
-- The `observations_sync_target` trigger needs no change: its `^M[0-9]{1,3}$` pattern never matches an NGC or IC
-- key, so such a row gets `messier = null` on insert (as a planet or the Moon does), and an edit to or from one
-- re-derives `messier` the same way. No new index. RLS is unchanged.

alter table public.observations
  drop constraint observations_target_key,
  add constraint observations_target_key check (
    target ~ '^M([1-9]|[1-9][0-9]|10[0-9]|110)$'
    or target in ('mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon')
    or target ~ '^(NGC|IC)[1-9][0-9]{0,3}$'
  );
