# Post-deploy probe evidence (1.9, 1.10)

Run by herdr agent `errors`, 2026-10-16. Status: partial. Needs the owner for sign-in and for reading Workers Logs / Issues.

## Done

- `npm run build` (branch `feat/error-visibility-2`, 869d73e, so the build includes Phase 2): exit 0, no "Unexpected fields" warning. `dist/server/wrangler.json` carries `"issues":{"enabled":true}` and `"preview_urls":true`.
- `npx wrangler versions upload --tag probe --message "issues probe" --var FORECAST_BASE_URL:http://127.0.0.1:9` (wrangler 4.145.0): uploaded, no deploy.
  - Worker Version ID: `5626dfff-da66-4e54-b44e-383ee2feca31`
  - Version Preview URL: `https://5626dfff-sidereus.sidereus.workers.dev` (printed, as 1.10 requires)
  - Bindings listed: SESSION (inherited), FORECAST_CACHE, IMAGES, ASSETS, `FORECAST_BASE_URL` as an environment variable (hidden). The override reached the version as a variable; production's variable, secrets and deployment were not touched.
- Signed-out node `fetch` at 2026-10-16T18:52Z (no body, no cookie, no personal data): `GET /` -> 200, `GET /tonight` -> 302 `/auth/signin?next=%2Ftonight`. These two invocations carry `ScriptVersion` 5626dfff and are the ones to inspect for 1.9.

## Blocked (why)

- Wrangler's OAuth token has no Workers Observability scope (`wrangler whoami` lists `workers_tail (read)` only), and the Cloudflare MCP needs the owner's browser authorisation. So Workers Logs and Issues cannot be read from here.
- `/tonight` needs a signed-in session on the production Supabase project. The agent has no production account and must not create one.
