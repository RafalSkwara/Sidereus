---
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
---

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
