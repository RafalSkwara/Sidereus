# Test stack

## E2E

<!-- Written by /10x-e2e-setup. Re-run it to change this section; other skills only read it. -->

- runner: Playwright Test, @playwright/test 1.55.0
- config: playwright.config.ts
- single-spec command: SUPABASE_URL=<local API_URL> SUPABASE_KEY=<local ANON_KEY> BASE_URL=http://localhost:4321 npx playwright test tests/e2e/<name>.spec.ts (the finder and plan specs also need SUPABASE_SECRET_KEY=<local SECRET_KEY> inline; values from `npx supabase status -o env`, inline on the command only, never exported)
- full-suite command: the same variables inline on `npm run test:e2e`
- base URL: http://localhost:4321
- port: 4321 (detected from Astro's `astro preview` default; no port in astro.config.mjs or the scripts; override with BASE_URL=http://localhost:<port> and the same --port on the preview, since the config reads BASE_URL, not E2E_PORT)
- web server command: none in the config, by owner decision (2026-10-26): the caller starts, as CI's `smoke` job does, `node tests/e2e/forecast-fixture.mjs` (port 4400) before the build, then `npm run build && ASTRO_PREVIEW_BACKGROUND=1 npm run preview -- --port 4321` from a checkout whose `.env` and `.dev.vars` point at local Supabase and FORECAST_BASE_URL=http://127.0.0.1:4400 (the repo's own files point at hosted, and the build copies `.dev.vars` into the preview: use a throwaway worktree, never edit them); ASTRO_PREVIEW_BACKGROUND=1 keeps Astro 7's preview in the foreground (an agent's preview otherwise daemonises and keeps the port: `npx astro preview stop`); no server reuse
- auth setup project: none: each spec signs up its own throwaway user on the local stack through `tests/e2e/helpers.ts` (`signUp`, `fillSignUpForm`, `PASSWORD`), by owner decision (2026-10-26), so specs never share state
- storageState: none
- seed: tests/e2e/auth-continue.spec.ts — protects signup-continues-to-next (M-4 S-06, auth-loose-ends D2): a visitor sent to sign in from a gated page signs up, onboards and lands on that page
- browser CLI: playwright-cli 0.1.22 (global), command skill at ~/projects/.claude/skills/playwright-cli/SKILL.md; pass -s=sidereus on every call
- updated: 2026-10-26
