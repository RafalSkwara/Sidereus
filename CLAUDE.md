# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Sidereus** — a web app that tells a beginner amateur astronomer whether tonight is worth setting up for (go / marginal / no-go) and which Messier objects to point at, with an eyepiece pair from their own kit. Product requirements, invariants and tunable scoring parameters live in `@context/foundation/prd.md`; the stack rationale in `@context/foundation/tech-stack.md`. Work runs through the 10x `context/` workflow with in-flight changes under `context/changes/<id>/`.

The codebase is currently the untouched `10x-astro-starter` scaffold plus `context/`. No product code exists yet; the starter's auth flow and dashboard are the only features.

## Tripwires (read first)

- **Never write to `context/archive/`.** Archived changes are immutable; open a new change instead.
- **CI does not run.** `.github/workflows/ci.yml` triggers on `master`, but the repo's default branch is `main`. Fix the branch filter before relying on CI.
- **`createClient()` in `@src/lib/supabase.ts` returns `null`** when `SUPABASE_URL` / `SUPABASE_KEY` are unset (both are `optional: true` in the `astro:env` schema). Every caller must handle `null`; the app boots without Supabase and `@src/lib/config-status.ts` renders a warning banner via the layout.
- **Error-response shape for API routes**: no JSON errors. Routes redirect back to the originating page with `?error=<encoded message>`; the `.astro` page reads `Astro.url.searchParams.get("error")` and passes it to the React form as `serverError`. Follow this in new routes.
- **`npm audit` needs `--registry https://registry.npmjs.org`** on this machine: the default registry is a private Nexus mirror that rejects the advisories endpoint.
- **Node ≥ 24.16** (`.nvmrc` pins 24.21.0, `package.json` engines enforce it). Two ESLint Astro packages declare narrow `engines.node` ranges; mismatch warnings at install are upstream noise, not blockers.
- **Deploy target is Cloudflare Workers** (with static assets), never Pages: `@astrojs/cloudflare` v13+ dropped Pages support. `name` is `sidereus` in `package.json` and `wrangler.jsonc`; `tech-stack.md` says `cloudflare-workers`. Platform decision and risk register: `context/foundation/infrastructure.md`.

## Commands

```bash
npm run dev          # Astro dev server on the Cloudflare workerd runtime, http://localhost:4321
npm run build        # production SSR build (@astrojs/cloudflare adapter)
npm run preview      # serve the production build
npm run lint         # ESLint (type-checked); lint:fix to auto-fix
npm run format       # Prettier (astro + tailwind plugins)
npx astro check      # TS/Astro type check — CI runs this, `npm run lint` does not
npx astro sync       # regenerate .astro/types.d.ts (CI runs it before lint)
npm run smoke        # scripts/smoke.mjs: HTTP walk of signup→signin→dashboard→signout against BASE_URL
npx supabase start   # local Supabase (Docker); email confirmations are disabled in supabase/config.toml
npx wrangler deploy  # deploy (secrets via `npx wrangler secret put`)
```

There is **no unit test runner**. The smoke script is the only automated check and needs a running server plus a reachable Supabase with email confirmation off. When adding a test framework, wire it into the `ci` job.

Pre-commit runs lint-staged (husky); the file globs are in `@package.json`.

Env: `SUPABASE_URL`, `SUPABASE_KEY` in `.env` (Node/astro CLI) **and** `.dev.vars` (Cloudflare local dev). Both gitignored.

## Architecture

Stack and versions: `@README.md`. `output: "server"` — every page and route is SSR by default; no `prerender` flags needed. React islands only where there is client state (forms use `client:load`). shadcn/ui aliases are in `components.json`.

**Request flow**: `@src/middleware.ts` runs on every request, builds a cookie-backed Supabase SSR client, resolves the user into `Astro.locals.user` (typed in `src/env.d.ts`), and redirects unauthenticated requests on `PROTECTED_ROUTES` (prefix match) to `/auth/signin`. Add new gated paths to that array. The PRD requires the post-login redirect to continue to the originally requested page; the middleware does not do this yet.

**Auth surfaces**: pages under `src/pages/auth/`, POST handlers under `src/pages/api/auth/`, React forms under `src/components/auth/`. Forms do client-side validation only and submit as plain HTML POSTs; the server is the source of truth.

**Layout**: `@src/layouts/Layout.astro` wraps every page and renders config-status banners. All user-facing copy is English; the two Polish strings in `src/lib/config-status.ts` are starter leftovers, translate them when you next touch that file.

## Conventions

- Import via the `@/*` alias (→ `src/*`). Merge Tailwind classes with `cn()` from `@/lib/utils`, never string concatenation.
- shadcn components go in `src/components/ui/` via `npx shadcn@latest add <name>`. Hooks alias resolves to `src/hooks/` (per `components.json`).
- Business logic and services in `src/lib/`. The PRD's scoring engine must be pure and deterministic (identical inputs → identical verdict and ranking), so keep it free of I/O.
- Database changes as Supabase migrations in `supabase/migrations/` named `YYYYMMDDHHmmss_short_description.sql`, RLS enabled with per-operation policies. Per-user isolation is a PRD non-functional requirement and must be testable outside the UI.
- Lint rules live in `@eslint.config.js`; run `npm run lint` before committing.
- Default branch `main`; feature branches `feat/<topic>`; PRs merged via GitHub.

## Also loaded

Claude Code also loads `/Users/rafalskwara/projects/CLAUDE.md` (parent directory, 10xDevs lesson notes about the `/10x-*` skills). It describes the tooling, not this project.
