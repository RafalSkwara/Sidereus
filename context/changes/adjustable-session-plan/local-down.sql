-- Run by hand only, never as a migration (never put it in supabase/migrations/, never `supabase db reset`).
-- It puts the shared local Supabase stack back to main's schema after this change's migration
-- (20261014120000_session_plans.sql) was applied there for a verification run: it drops public.session_plans and
-- forgets the migration's version, so `npx supabase migration list` shows main's set again.

drop table if exists public.session_plans;

delete from supabase_migrations.schema_migrations where version = '20261014120000';
