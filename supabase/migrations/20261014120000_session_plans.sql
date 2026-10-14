-- Session plans (roadmap M-3 S-08, adjustable-session-plan): the list of targets a full-plan user arranged for the
-- Session plan of one site and night.
--
-- One row per (user, site, night), holding the whole ordered list of target keys (`targets`). A row exists only
-- while the user has edited that night's plan: resetting to the suggested plan deletes it, and a later change in
-- the suggestion never alters a saved list. The app applies the list to the freshly computed night and draws a row
-- only for a key the engine gives a window that night (src/lib/tonight/plan-edits.ts), so the table never decides
-- what is visible; it only remembers the user's order and picks.
--
-- `targets` is checked against the closed target grammar of `src/lib/targets` (the same three predicates as
-- `observations_target_key`, 20261006190000_observation_target_deep_sky.sql: `M1`..`M110`, `NGC<n>` / `IC<n>`,
-- the seven planets and `moon`) and holds at most 30 keys. Whether the catalogue lists an NGC or IC key is the
-- app's `isKnownTarget`, because the catalogue is data in the app, not in the database. Duplicates are refused by
-- the app's schema, not here.
--
-- A check constraint cannot hold a subquery, so each element is tested through the array joined with commas: the
-- joined text must be a comma-separated run of keys, and no element may itself carry a comma (`{"M31,M42"}` would
-- otherwise read as two keys), be empty or be null (a null element drops out of the join).
--
-- Owned by an auth user like every per-user table (user_id defaults to auth.uid(), cascades on user deletion;
-- RLS with one policy per operation for `authenticated`, nothing for `anon`; isolation proven by tests/db/). The
-- site is required and cascades: deleting a site deletes its plans. A foreign key check does not apply RLS, so the
-- insert and update policies also require the referenced site to be the caller's (as sky_checks does).
--
-- Additive (a new table and nothing else), so it is safe to push before the app deploy.

create table public.session_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  -- The observing night's evening date (local noon to noon at the site), as observations.night.
  night date not null,
  -- The user's ordered target keys.
  targets text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_plans_user_site_night_key unique (user_id, site_id, night),
  constraint session_plans_targets_max check (cardinality(targets) <= 30),
  constraint session_plans_targets_no_null check (array_position(targets, null) is null),
  constraint session_plans_targets_no_empty check ('' <> all (targets)),
  constraint session_plans_targets_no_comma check (position(',' in array_to_string(targets, '')) = 0),
  constraint session_plans_targets_keys check (
    array_to_string(targets, ',') ~ (
      '^('
      || '(M([1-9]|[1-9][0-9]|10[0-9]|110)|(NGC|IC)[1-9][0-9]{0,3}|mercury|venus|mars|jupiter|saturn|uranus|neptune|moon)'
      || '(,(M([1-9]|[1-9][0-9]|10[0-9]|110)|(NGC|IC)[1-9][0-9]{0,3}|mercury|venus|mars|jupiter|saturn|uranus|neptune|moon))*'
      || ')?$'
    )
  )
);

create index session_plans_user_id_idx on public.session_plans (user_id);
create index session_plans_site_id_idx on public.session_plans (site_id);

alter table public.session_plans enable row level security;

create policy "session_plans_select_own" on public.session_plans
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "session_plans_insert_own" on public.session_plans
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.sites s where s.id = site_id and s.user_id = (select auth.uid())
    )
  );

create policy "session_plans_update_own" on public.session_plans
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.sites s where s.id = site_id and s.user_id = (select auth.uid())
    )
  );

create policy "session_plans_delete_own" on public.session_plans
  for delete to authenticated
  using ((select auth.uid()) = user_id);
