-- Sites and gear: the first per-user tables (roadmap S-01).
--
-- Each row is owned by an auth user (user_id defaults to auth.uid(), cascades on user deletion).
-- Ranges are enforced here as well as in the app. RLS is enabled with one policy per operation,
-- granted to `authenticated` only; `anon` gets nothing. Isolation is proven by tests/db/.
-- This migration is additive (new tables only), which keeps it safe to push before the app deploy.

-- sites -----------------------------------------------------------------------------------------

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  latitude_deg numeric(4, 2) not null check (latitude_deg between -90 and 90),
  longitude_deg numeric(5, 2) not null check (longitude_deg between -180 and 180),
  bortle smallint not null check (bortle between 1 and 9),
  min_altitude_deg smallint not null default 15 check (min_altitude_deg between 0 and 60),
  time_zone text not null,
  time_zone_source text not null check (time_zone_source in ('auto', 'manual')),
  created_at timestamptz not null default now()
);

create index sites_user_id_idx on public.sites (user_id);

alter table public.sites enable row level security;

create policy "sites_select_own" on public.sites
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "sites_insert_own" on public.sites
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "sites_update_own" on public.sites
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "sites_delete_own" on public.sites
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- telescopes ------------------------------------------------------------------------------------

create table public.telescopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  aperture_mm numeric(6, 1) not null check (aperture_mm between 20 and 1000),
  focal_length_mm numeric(6, 1) not null check (focal_length_mm between 100 and 5000),
  created_at timestamptz not null default now()
);

create index telescopes_user_id_idx on public.telescopes (user_id);

alter table public.telescopes enable row level security;

create policy "telescopes_select_own" on public.telescopes
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "telescopes_insert_own" on public.telescopes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "telescopes_update_own" on public.telescopes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "telescopes_delete_own" on public.telescopes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- eyepieces -------------------------------------------------------------------------------------

create table public.eyepieces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  focal_length_mm numeric(4, 1) not null check (focal_length_mm between 2 and 60),
  afov_deg smallint not null check (afov_deg between 30 and 120),
  created_at timestamptz not null default now()
);

create index eyepieces_user_id_idx on public.eyepieces (user_id);

alter table public.eyepieces enable row level security;

create policy "eyepieces_select_own" on public.eyepieces
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "eyepieces_insert_own" on public.eyepieces
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "eyepieces_update_own" on public.eyepieces
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "eyepieces_delete_own" on public.eyepieces
  for delete to authenticated
  using ((select auth.uid()) = user_id);
