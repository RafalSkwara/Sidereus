---
bootstrapped_at: 2026-09-17T19:07:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: sidereus
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

Source: `context/foundation/tech-stack.md` (read in full at run start). Frontmatter verbatim:

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: sidereus
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

## Why this stack

A solo, after-hours build with a hard six-week deadline needs a starter that
settles UI, data, auth and deploy in one move, and 10x Astro Starter is the
recommended default for a JavaScript web-app. It clears all four agent-friendly
gates and its scaffolding confidence is first-class. Supabase covers the PRD's
only technology-forcing feature, email-and-password accounts with password
reset, without extra email setup, which is the exact condition the PRD placed on
FR-003; Postgres row-level security maps directly onto the per-user data
isolation requirement. The pure scoring engine, forecast and geocoding calls,
and the coordinate-to-timezone lookup are all short-lived and fit the Cloudflare
edge runtime, with KV available for the hourly per-site forecast cache the
PRD's outage behaviour assumes. Payments, realtime, AI and background jobs are
out of scope per Non-Goals, so none of the starter's gaps are exercised.
Deployment is Cloudflare Pages, the starter default; CI runs on GitHub Actions
with auto-deploy on merge, matching the PRD's final-week CI/CD plan.

## Pre-scaffold verification

| Signal      | Value                                                        | Severity | Notes                                                                                  |
| ----------- | ------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------- |
| npm package | not run                                                      | n/a      | `cmd_template` starts with `git clone`; no `create-*` package to resolve               |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-09-12T21:16:08Z | fresh    | from card.docs_url; `gh` CLI not installed, queried `api.github.com` directly via curl |

Default branch `master`, repository not archived. Checked on 2026-09-17.

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 50 files plus `node_modules/` (653 packages, moved as a unit)
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: append-merged — existing lines kept; 5 lines appended under `# from 10x-astro-starter`: `.astro/`, `yarn-error.log*`, `.env.production`, `.dev.vars`, `.wrangler/`
**context/ paths in scaffold**: none (nothing to drop)
**Cloned .git/**: deleted before move-up; the pre-existing `sidereus/.git/` was left untouched
**.bootstrap-scaffold cleanup**: deleted (no leftovers)

Scaffold target was `/Users/rafalskwara/projects/sidereus` (the directory holding `context/`), not the shell session's parent directory.

Files moved:

- `wrangler.jsonc`
- `astro.config.mjs`
- `README.md`
- `.prettierrc.json`
- `package-lock.json`
- `package.json`
- `.nvmrc`
- `components.json`
- `tsconfig.json`
- `eslint.config.js`
- `.env.example`
- `AGENTS.md`
- `CLAUDE.md`
- `.husky/pre-commit`
- `supabase/.gitignore`
- `supabase/config.toml`
- `public/favicon.png`
- `public/.assetsignore`
- `public/template.png`
- `scripts/smoke.mjs`
- `.github/workflows/ci.yml`
- `.vscode/settings.json`
- `.vscode/extensions.json`
- `.vscode/launch.json`
- `src/middleware.ts`
- `src/env.d.ts`
- `src/styles/global.css`
- `src/components/Welcome.astro`
- `src/components/Banner.astro`
- `src/components/Topbar.astro`
- `src/components/ui/LibBadge.astro`
- `src/components/ui/button.tsx`
- `src/components/auth/SubmitButton.tsx`
- `src/components/auth/SignInForm.tsx`
- `src/components/auth/FormField.tsx`
- `src/components/auth/PasswordToggle.tsx`
- `src/components/auth/ServerError.tsx`
- `src/components/auth/SignUpForm.tsx`
- `src/layouts/Layout.astro`
- `src/lib/utils.ts`
- `src/lib/config-status.ts`
- `src/lib/supabase.ts`
- `src/pages/dashboard.astro`
- `src/pages/index.astro`
- `src/pages/auth/confirm-email.astro`
- `src/pages/auth/signup.astro`
- `src/pages/auth/signin.astro`
- `src/pages/api/auth/signout.ts`
- `src/pages/api/auth/signin.ts`
- `src/pages/api/auth/signup.ts`

Install warnings captured from `npm install` (informational, exit code was 0):

```
npm warn Could not resolve dependency:
npm warn peer overridden eslint@"^10.10.0" (was "^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9.7") from eslint-plugin-react@7.37.5
npm warn node_modules/eslint-plugin-react
npm warn   dev eslint-plugin-react@"^7.37.5" from the root project
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'astro-eslint-parser@3.1.0',
npm warn EBADENGINE   required: { node: '^22.22.3 || ^24.16.0 || >=26.3.0' },
npm warn EBADENGINE   current: { node: 'v24.13.0', npm: '11.6.2' }
npm warn EBADENGINE }
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'eslint-plugin-astro@3.1.0',
npm warn EBADENGINE   required: { node: '^22.22.3 || ^24.16.0 || >=26.3.0' },
npm warn EBADENGINE   current: { node: 'v24.13.0', npm: '11.6.2' }
npm warn EBADENGINE }
```

Two of the starter's dev dependencies (`astro-eslint-parser@3.1.0`, `eslint-plugin-astro@3.1.0`) declare `engines.node` of `^22.22.3 || ^24.16.0 || >=26.3.0`; the local runtime is Node v24.13.0. Install succeeded regardless. The starter's own `.nvmrc` pins `22.14.0`, which also falls outside that range, so the mismatch is upstream, not local. Install and audit succeeded; treat this as a heads-up for when ESLint's Astro rules misbehave, not as a blocker.

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/0/0 direct of total 0/0/0/0
**Dependency counts**: 802 total (360 prod, 269 dev, 165 optional, 25 peer)

First attempt failed: the configured npm registry is a private Nexus mirror that returned `400 Bad Request` on the `/-/npm/v1/security/advisories/bulk` endpoint. The audit was rerun read-only against `https://registry.npmjs.org` via `--registry` and completed with exit code 0. Later `npm audit` runs on this machine will need the same flag, or an audit-capable registry configuration.

#### CRITICAL findings

none

#### HIGH findings

none

#### MODERATE findings

none

#### LOW / INFO findings

none

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | false                |
| has_background_jobs     | false                |

Note: the starter itself shipped `.github/workflows/ci.yml`, `CLAUDE.md` and `AGENTS.md`. Bootstrapper did not generate or edit these; they arrived as part of the cloned starter and were moved up unchanged because no file of the same name existed.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history. This directory already had a `.git/`; the starter's history was not merged into it.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep. (None were created in this run.)
- Address audit findings per your project's risk tolerance — the full breakdown is in this log. (None in this run.)
- Copy `.env.example` to `.env` and fill in the Supabase URL and key before running `npm run dev`.
- The pre-existing `.gitignore` ignores `.vscode/*` except `extensions.json`, so the starter's `.vscode/launch.json` and `settings.json` will stay untracked unless you loosen that rule.
