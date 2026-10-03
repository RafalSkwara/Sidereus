-- Sky checks (roadmap M-2 S-07, verdict-check): the sky headline Tonight showed for a site and night, and the
-- user's later answer about how the sky really was.
--
-- One row per (user, site, night). Tonight records it through `record_sky_verdict` after each signed-in view of
-- the night: before the dark window starts every view overwrites the headline, after it the row is frozen (a first
-- view after dark still inserts), and an answered row never changes. The decision uses the database clock, so
-- concurrent renders of the Tonight island (its preload, reloads) all agree.
--
-- Owned by an auth user like every per-user table (user_id defaults to auth.uid(), cascades on user deletion;
-- RLS with one policy per operation for `authenticated`, nothing for `anon`; isolation proven by tests/db/). The
-- site is kept by id and by name: the id is set to null when the site is deleted, while the name snapshot keeps
-- the row readable, as observations do. The unique key is NULLS DISTINCT (the default), so rows of two deleted
-- sites that share a night both survive, and PostgREST can still upsert on it for live sites.
--
-- A foreign key check does not apply RLS, so the insert and update policies also require a referenced site to be
-- the caller's.
--
-- Additive (a new table and two functions), so it is safe to push before the app deploy.

create table public.sky_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  site_id uuid references public.sites (id) on delete set null,
  site_name text not null check (char_length(trim(site_name)) between 1 and 60),
  -- The observing night's evening date (local noon to noon at the site), as observations.night.
  night date not null,
  -- The headline id Tonight showed (src/lib/tonight/format.ts). A night with no dark window is never recorded.
  headline text not null check (headline in ('go', 'marginal', 'no-go', 'humidityCap', 'fallbackCap', 'noForecast')),
  dark_start timestamptz not null,
  shown_at timestamptz not null default now(),
  answer text check (answer in ('clear', 'partly', 'cloudy')),
  answered_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sky_checks_user_site_night_key unique (user_id, site_id, night)
);

create index sky_checks_user_id_idx on public.sky_checks (user_id);
create index sky_checks_site_id_idx on public.sky_checks (site_id);

alter table public.sky_checks enable row level security;

create policy "sky_checks_select_own" on public.sky_checks
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "sky_checks_insert_own" on public.sky_checks
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (site_id is null or exists (
      select 1 from public.sites s where s.id = site_id and s.user_id = (select auth.uid())
    ))
  );

create policy "sky_checks_update_own" on public.sky_checks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (site_id is null or exists (
      select 1 from public.sites s where s.id = site_id and s.user_id = (select auth.uid())
    ))
  );

create policy "sky_checks_delete_own" on public.sky_checks
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Records the headline Tonight showed for the caller's site and night. `security invoker`: it runs under the
-- caller's RLS, so a site that is not the caller's reads as missing and nothing is written. The parameters share
-- their names with columns, so the conflict target is the named constraint and every parameter is qualified.
create function public.record_sky_verdict(
  site_id uuid,
  night date,
  headline text,
  dark_start timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  shown_site_name text;
begin
  select s.name into shown_site_name from public.sites s where s.id = record_sky_verdict.site_id;
  if shown_site_name is null then
    return;
  end if;

  insert into public.sky_checks as existing (site_id, site_name, night, headline, dark_start)
  values (
    record_sky_verdict.site_id,
    shown_site_name,
    record_sky_verdict.night,
    record_sky_verdict.headline,
    record_sky_verdict.dark_start
  )
  on conflict on constraint sky_checks_user_site_night_key do update
    set headline = excluded.headline,
      dark_start = excluded.dark_start,
      site_name = excluded.site_name,
      shown_at = pg_catalog.now()
    where pg_catalog.now() < existing.dark_start
      and existing.answer is null;
end;
$$;

revoke execute on function public.record_sky_verdict(uuid, date, text, timestamptz) from public, anon;
grant execute on function public.record_sky_verdict(uuid, date, text, timestamptz) to authenticated;

-- The caller's answered nights counted by headline and answer, so the tally never reads rows one by one and
-- never meets PostgREST's max_rows. `security invoker`: RLS scopes it to the caller.
create function public.sky_check_tally()
returns table (headline text, answer text, nights bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.headline, c.answer, pg_catalog.count(*) as nights
  from public.sky_checks c
  where c.answer is not null
  group by c.headline, c.answer
  order by c.headline, c.answer;
$$;

revoke execute on function public.sky_check_tally() from public, anon;
grant execute on function public.sky_check_tally() to authenticated;
