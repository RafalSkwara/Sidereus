-- Observation log (roadmap S-06, PRD FR-016): one row per "I looked at this object on this night".
--
-- Owned by an auth user like every per-user table (user_id defaults to auth.uid(), cascades on user
-- deletion; RLS with one policy per operation for `authenticated`, nothing for `anon`; isolation proven by
-- tests/db/). The row keeps the site and telescope it was made with by id and by name: the ids are nullable
-- and set to null when that gear is deleted, while the name snapshots keep the entry readable (FR-021).
--
-- A foreign key check does not apply RLS, so a bare reference would accept another user's site id. The
-- insert and update policies therefore also require the referenced site and telescope to be the caller's.
-- Additive (a new table only), so it is safe to push before the app deploy.

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  messier smallint not null check (messier between 1 and 110),
  -- The observing night's evening date (local noon to noon at the site), not a timestamp.
  night date not null,
  rating smallint not null check (rating between 1 and 5),
  site_id uuid references public.sites (id) on delete set null,
  telescope_id uuid references public.telescopes (id) on delete set null,
  site_name text not null check (char_length(trim(site_name)) between 1 and 60),
  telescope_name text not null check (char_length(trim(telescope_name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create index observations_user_id_idx on public.observations (user_id);
create index observations_site_id_idx on public.observations (site_id);
create index observations_telescope_id_idx on public.observations (telescope_id);

alter table public.observations enable row level security;

create policy "observations_select_own" on public.observations
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "observations_insert_own" on public.observations
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (site_id is null or exists (
      select 1 from public.sites s where s.id = site_id and s.user_id = (select auth.uid())
    ))
    and (telescope_id is null or exists (
      select 1 from public.telescopes t where t.id = telescope_id and t.user_id = (select auth.uid())
    ))
  );

create policy "observations_update_own" on public.observations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (site_id is null or exists (
      select 1 from public.sites s where s.id = site_id and s.user_id = (select auth.uid())
    ))
    and (telescope_id is null or exists (
      select 1 from public.telescopes t where t.id = telescope_id and t.user_id = (select auth.uid())
    ))
  );

create policy "observations_delete_own" on public.observations
  for delete to authenticated
  using ((select auth.uid()) = user_id);
