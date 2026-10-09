-- Account plans (roadmap F-01, FR-045): every account is on the free or the full plan, stored and enforced by the
-- server. A missing row means free, so no sign-up trigger and no backfill are needed.
--
-- The table is server-owned. A user may read their own row (the one RLS policy) and nothing else: insert, update,
-- delete and truncate are revoked from `anon` and `authenticated`. Supabase grants every new `public` table full
-- privileges to both roles, and with RLS on but no write policy a write would be a silent zero-row no-op instead
-- of an error, so the revoke is what makes a self-grant fail loudly with 42501. Writes are operator-only, through
-- the secret key (`npm run account:plan`), which bypasses RLS and grants. Proven by tests/db/account-plans.test.ts.
--
-- `current_plan()` is the helper future full-plan tables and RPCs call: the caller's plan, `free` without a row.
-- `security invoker`, so it runs under the caller's RLS and sees only their own row.
--
-- Additive (a new table and a new function, no change to existing objects), so it is safe to push before the app
-- deploy.

create table public.account_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('free', 'full')),
  updated_at timestamptz not null default now()
);

alter table public.account_plans enable row level security;

create policy "account_plans_select_own" on public.account_plans
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete, truncate on public.account_plans from anon, authenticated;

-- The caller's plan. `stable`, so a policy that calls it as `(select public.current_plan())` evaluates it once
-- per statement.
create function public.current_plan()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select p.plan from public.account_plans p where p.user_id = (select auth.uid())),
    'free'
  );
$$;

revoke execute on function public.current_plan() from public, anon;
grant execute on function public.current_plan() to authenticated;
