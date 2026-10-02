-- The Moon as an observation target (roadmap M-2 S-02 moon-as-target, phase 2): the closed target grammar shared
-- with `src/lib/targets` gains the key `moon`, next to the Messier ids (`M1`…`M110`) and the seven planet keys.
--
-- Additive and backward-compatible with the app deployed before it (CI migrates before it deploys): that app never
-- writes `moon`, and every key it does write still passes the check.
--
-- The `observations_sync_target` trigger needs no change: `moon` does not match its Messier pattern, so a `moon`
-- row gets `messier = null` on insert (as a planet does), and an edit to or from `moon` re-derives `messier` the
-- same way. No new index. RLS is unchanged.

alter table public.observations
  drop constraint observations_target_key,
  add constraint observations_target_key check (
    target ~ '^M([1-9]|[1-9][0-9]|10[0-9]|110)$'
    or target in ('mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon')
  );
