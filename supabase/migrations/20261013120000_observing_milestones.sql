-- Observing milestones (roadmap M-3 S-06, observing-milestones): the milestones a user has reached, kept for good.
--
-- One row per (user, milestone). The rule that decides a milestone is reached lives in TypeScript
-- (src/lib/progress/milestones.ts), derived from the log; this table only remembers the result, so a milestone
-- outlives the log entries that reached it (a deleted or re-rated entry loses nothing) and is celebrated exactly
-- once. The app's save routes insert the milestones a save reached with "insert, ignore duplicates, return what was
-- inserted": the unique key makes the insert store each milestone once per user, and two saves at the same moment
-- cannot both get the row back, so they cannot both celebrate. `reached_night` is the observing night (the log's
-- `night`, not a clock time) the milestone was reached on.
--
-- `key` is checked against the fixed set of 11 keys, in the order of MILESTONES; tests/db/milestones.test.ts keeps
-- this list and the TypeScript set in step. A new milestone is a new migration that widens the check.
--
-- Owned by an auth user like every per-user table (user_id defaults to auth.uid(), cascades on user deletion;
-- RLS with one policy per operation for `authenticated`, nothing for `anon`; isolation proven by tests/db/). The
-- unique key's index leads with user_id, so the table needs no separate user_id index. There is no function.
--
-- Accepted, not hardened (the owner accepted the same for sky_checks and observations on 2026-10-09): RLS lets a
-- user insert, change or delete their own rows directly through PostgREST, so a user can give themselves a
-- milestone. Only that user's own progress page reads the table, and progress is private (no sharing, no ranking
-- effect, no entitlement), so a forged row fools only its author. A server-owned table could not be written by the
-- app (the Worker has no secret key, and SECURITY DEFINER functions are banned in `public`), a SECURITY INVOKER
-- function would need the same insert grant, and re-checking the rule in SQL would duplicate the TypeScript rule.
-- tests/db/milestones.test.ts pins this, so a later hardening is a visible decision, not drift.
--
-- Additive (a new table and nothing else), so it is safe to push before the app deploy.

create table public.observing_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (
    key in (
      'first-moon',
      'first-planet',
      'all-planets',
      'first-galaxy',
      'first-globular',
      'first-nebula',
      'messier-10',
      'messier-25',
      'messier-50',
      'messier-110',
      'caldwell-all'
    )
  ),
  -- The observing night's evening date, as observations.night.
  reached_night date not null,
  created_at timestamptz not null default now(),
  constraint observing_milestones_user_key_key unique (user_id, key)
);

alter table public.observing_milestones enable row level security;

create policy "observing_milestones_select_own" on public.observing_milestones
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "observing_milestones_insert_own" on public.observing_milestones
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "observing_milestones_update_own" on public.observing_milestones
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "observing_milestones_delete_own" on public.observing_milestones
  for delete to authenticated
  using ((select auth.uid()) = user_id);
