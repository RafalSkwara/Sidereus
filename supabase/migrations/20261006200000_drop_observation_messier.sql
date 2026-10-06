-- Contract step of the observation target expand/contract (deep-sky-beyond-messier, phase 5; the expand half is
-- `20260930120000_observation_target.sql`, planned in S-01 under `context/archive/2026-09-30-planets-on-tonight/plan.md:485`).
--
-- `observations.messier` was kept, nullable, with its `observations_sync_target` trigger, so the app deployed before
-- target keys could keep writing and reading it while CI migrated ahead of the deploy. The deployed app writes and reads
-- `target` only, so the column and the trigger that kept the two in step have no reader left. The column is fully
-- derivable from `target` (`M<n>` for a Messier key, null for every other), so no data is lost.
--
-- Not backward-compatible with an app version from before S-01, which S-01 anticipated; rolling back that far is no
-- longer supported. `target` and `observations_target_key` are unchanged. The column's check constraint goes with it.

drop trigger observations_sync_target on public.observations;

drop function public.observations_sync_target();

alter table public.observations drop column messier;
