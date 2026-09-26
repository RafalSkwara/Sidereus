-- First-run onboarding: save the "Home" site, the telescope and 0-10 eyepieces in one transaction
-- (roadmap S-03).
--
-- `security invoker`: the inserts run under the caller's RLS, `user_id` comes from the column
-- defaults (auth.uid()), and the existing table checks apply, so any failed row rolls back the whole
-- call. A user who already has a site or telescope is refused with `already_onboarded` (SQLSTATE
-- P0001), so a retry or a double submit cannot duplicate "Home". The per-user advisory lock is taken
-- before that check, so two concurrent calls cannot both pass it.
--
-- `eyepieces` is a JSON array of {name, focal_length_mm, afov_deg}.
--
-- This migration is additive (a new function only), which keeps it safe to push before the app deploy.

create function public.complete_onboarding(
  site_name text,
  latitude_deg numeric,
  longitude_deg numeric,
  bortle smallint,
  min_altitude_deg smallint,
  time_zone text,
  time_zone_source text,
  telescope_name text,
  aperture_mm numeric,
  focal_length_mm numeric,
  eyepieces jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('complete_onboarding:' || auth.uid()::text, 0));

  if exists (select 1 from public.sites s where s.user_id = auth.uid())
    or exists (select 1 from public.telescopes t where t.user_id = auth.uid()) then
    raise exception 'already_onboarded' using errcode = 'P0001';
  end if;

  insert into public.sites (name, latitude_deg, longitude_deg, bortle, min_altitude_deg, time_zone, time_zone_source)
  values (
    complete_onboarding.site_name,
    complete_onboarding.latitude_deg,
    complete_onboarding.longitude_deg,
    complete_onboarding.bortle,
    complete_onboarding.min_altitude_deg,
    complete_onboarding.time_zone,
    complete_onboarding.time_zone_source
  );

  insert into public.telescopes (name, aperture_mm, focal_length_mm)
  values (complete_onboarding.telescope_name, complete_onboarding.aperture_mm, complete_onboarding.focal_length_mm);

  insert into public.eyepieces (name, focal_length_mm, afov_deg)
  select e.item ->> 'name', (e.item ->> 'focal_length_mm')::numeric, (e.item ->> 'afov_deg')::smallint
  from pg_catalog.jsonb_array_elements(coalesce(complete_onboarding.eyepieces, '[]'::jsonb)) with ordinality as e (item, position)
  order by e.position;
end;
$$;

revoke execute on function public.complete_onboarding(
  text, numeric, numeric, smallint, smallint, text, text, text, numeric, numeric, jsonb
) from public, anon;

grant execute on function public.complete_onboarding(
  text, numeric, numeric, smallint, smallint, text, text, text, numeric, numeric, jsonb
) to authenticated;
