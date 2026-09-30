-- Observation target identity (roadmap M-2 S-01 planets-on-tonight, phase 2): the log stops being Messier-only.
--
-- `target` is the entry's target key, a closed grammar shared with `src/lib/targets`: a Messier catalogue id
-- (`M1`…`M110`) or one of the seven planet keys. S-02 and S-03 extend the grammar together with this check.
--
-- Additive and backward-compatible with the app deployed before it (CI migrates before it deploys): that app
-- inserts and updates `messier` only and reads `messier`. The new app writes `target` only. A BEFORE trigger
-- keeps the two columns consistent for both, so they can never drift apart:
--
-- - a missing `target` is filled from `messier` (the old app's insert);
-- - a missing `messier` is filled from a Messier `target` (the new app's insert);
-- - on update, a changed `target` with an unchanged `messier` re-derives `messier` (null for a planet), and a
--   changed `messier` with an unchanged `target` re-derives `target` (the old app's edit);
-- - a pair that still disagrees is rejected.
--
-- `target` can be NOT NULL although inserts may omit it: NOT NULL is checked after BEFORE row triggers.
-- `messier` stays, nullable (planets have none), with its 1..110 check, until a later contract migration drops
-- it once no old app can be running. No new index: reads filter by user and order by night. RLS is unchanged.

alter table public.observations add column target text;

update public.observations set target = 'M' || messier;

alter table public.observations
  alter column target set not null,
  add constraint observations_target_key check (
    target ~ '^M([1-9]|[1-9][0-9]|10[0-9]|110)$'
    or target in ('mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune')
  ),
  alter column messier drop not null;

create function public.observations_sync_target()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.target is distinct from old.target and new.messier is not distinct from old.messier then
      -- The new app edits the target: the old number no longer applies.
      new.messier := null;
    elsif new.messier is distinct from old.messier and new.target is not distinct from old.target then
      -- The old app edits the number: the old key no longer applies.
      new.target := null;
    end if;
  end if;

  if new.target is null and new.messier is not null then
    new.target := 'M' || new.messier;
  elsif new.messier is null and new.target ~ '^M[0-9]{1,3}$' then
    -- An out-of-range number is left to the checks on both columns.
    new.messier := substring(new.target from 2)::smallint;
  end if;

  if new.messier is not null and new.target is distinct from 'M' || new.messier then
    raise exception 'observations: target % does not match messier %', new.target, new.messier
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger observations_sync_target
  before insert or update on public.observations
  for each row execute function public.observations_sync_target();
