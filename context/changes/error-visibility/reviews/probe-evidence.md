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

## Step 1 result (owner, 2026-10-16 ~21:00 GMT+2, dashboard)

- Workers Logs for `sidereus`, last hour: one invocation row (info, 20:52:24 GMT+2 = 18:52:24 UTC, `GET https://sidereus.sidereus.workers…`, host truncated). That is within seconds of the agent's two signed-out requests, but the host as shown starts `sidereus.`, not `5626dfff-`, so it may be production traffic. 1.9 waits for the owner to expand that row (host, `ScriptVersion`, `request.cf`).
- The owner's signed-in `GET /tonight` on the Version URL (18:58:48Z, edge 200 in HTTP analytics) and its server-island request are **not** in Workers Logs, and there is no `sidereus: forecast.fetch failed` line. Step 1 (Version URL) does not work as a Workers Logs / Issues probe. Not yet known why: a Version URL's invocations may not be persisted, ingestion may lag, or the forecast came from the production KV cache (the version shares `FORECAST_CACHE`, so a cache hit never calls the dead host). Worth one more look at the logs after a few minutes before concluding.

## Prepared, NOT run: step 2, Worker Preview

Why it may work: the schema's `previews` block takes its own `observability`, `vars`, `secrets` and bindings, and the docs say a Preview keeps its own logs under the same Worker. Whether Issues covers a Preview is not documented, which is what this step finds out.

Tooling: the repo's wrangler 4.145.0 already has `wrangler preview` (needs 4.135.0 or later), so `npx wrangler preview`, no `@4.135.0` download and no dependency change. Run it only from the built `dist/` (`npm run build` first), never `wrangler deploy` / `versions deploy`.

Two things a Preview does not get for free (a Preview's non-inheritable settings are its own):
1. **Secrets.** `SUPABASE_URL` and `SUPABASE_KEY` are production secrets the agent cannot read. The owner passes them once through a `--secrets-file` (JSON or .env) kept outside the repo, e.g. `~/probe-secrets.env` with `SUPABASE_URL=…`, `SUPABASE_KEY=…` (the publishable key, never the `sb_secret_` one) and `FORECAST_BASE_URL=http://127.0.0.1:9`; delete the file afterwards. The agent never sees the values.
2. **KV.** If the Preview binds the production `FORECAST_CACHE`, a cached forecast answers before the dead host is ever called and no line appears. The Preview must bind a new, empty namespace (`npx wrangler kv namespace create probe-forecast-cache`) as `FORECAST_CACHE`, and one for `SESSION`. Both go in a `previews` block of a temporary config outside the repo (`~/probe-wrangler.jsonc`, passed with `-c`): `{ "previews": { "observability": { "enabled": true, "logs": { "enabled": true, "persist": true, "invocation_logs": true }, "traces": { "enabled": true } }, "kv_namespaces": [ { "binding": "FORECAST_CACHE", "id": "<new id>" }, { "binding": "SESSION", "id": "<new id>" } ] } }` on top of the build's generated config. Whether the generated `dist/server/wrangler.json` keeps a `previews` block is checked first (`grep previews dist/server/wrangler.json`); if the build drops it, the temp config carries the whole Worker config instead.

Command (after the owner's OK): `npx wrangler preview --name probe --tag probe --message "issues probe" -c <temp config> --secrets-file ~/probe-secrets.env`. It prints the Preview URL.

What the owner does: open the printed Preview URL, sign in with the production account (the Preview reads the production Supabase), open `/tonight` (the fallback forecast shows). Then in the dashboard, Workers & Pages -> `sidereus` -> Observability -> Logs: select the Preview (the preview/version selector or a filter on its name or `ScriptVersion`), look for `sidereus: forecast.fetch failed`, open the invocation event for 1.9 (`request.cf` geo fields), filter `step = forecast.fetch`, then open Issues for one Issue grouped by that message.

What it creates: a Preview named `probe` under the `sidereus` Worker (with its deployments), two empty KV namespaces, a public Preview URL running the production build with the owner's real Supabase credentials until removed. Production's deployment, variables, secrets and traffic are untouched.

Removal: `npx wrangler preview delete --name probe`; `npx wrangler kv namespace delete --namespace-id <id>` for each of the two namespaces; delete `~/probe-secrets.env` and `~/probe-wrangler.jsonc`. The uploaded Version `5626dfff` stays in the version list (it carries no traffic and goes away with Phase 6's `preview_urls: false`; `wrangler versions` has no delete).

## Prepared, NOT run: step 3, separate `sidereus-probe` Worker (only if step 2 gives no line or no Issue)

Uses `wrangler deploy`, but for a different Worker name, so it needs the owner's explicit OK for that one exception to the "never deploy" rule.

Command: copy `dist/server/wrangler.json` to `~/probe-worker.json`, set `"name": "sidereus-probe"`, replace the two KV ids with the new empty namespaces from step 2 (kept if step 2 was skipped), remove `placement` and the `preview_urls` setting if wrangler rejects them, then `npx wrangler deploy -c ~/probe-worker.json`, then `npx wrangler secret bulk ~/probe-secrets.env --name sidereus-probe` (same file: the two Supabase values plus the dead `FORECAST_BASE_URL`). The Worker keeps `observability.issues.enabled: true` from the config.

The owner then opens `https://sidereus-probe.<subdomain>.workers.dev`, signs in, opens `/tonight`, and reads Logs and Issues under the **`sidereus-probe`** Worker (not `sidereus`). Note: Issues for a second Worker may need Issues enabled for that Worker in the dashboard.

What it creates: a new Worker `sidereus-probe` with its own `workers.dev` URL (public, production Supabase credentials as secrets), its own logs and Issues, and the two KV namespaces.

Removal: `npx wrangler delete sidereus-probe` (check with `--dry-run` first; no other Worker depends on it), `npx wrangler kv namespace delete --namespace-id <id>` for both, and delete the temp files. Its Issues disappear with the Worker; any Issue it raised in the dashboard can be archived by the owner.

## Decision pending

The orchestrator relays this to the owner. Nothing in steps 2 or 3 has been run.

## Step 3 chosen (owner, 2026-10-16): prepared state, deploy NOT yet run

Owner's one-time exception to "never deploy", for the Worker `sidereus-probe` only.

Created so far (account, all new and empty; production untouched):
- KV namespace `sidereus-probe-forecast-cache`, id `c49fa235e764434eb82fade69d948dc3`
- KV namespace `sidereus-probe-session`, id `cf95030eecc0421ab886acf2b56c11be`

Temporary files (uncommitted):
- `dist/server/probe-wrangler.json` (gitignored build output): name `sidereus-probe`, the two KV ids above, `vars.FORECAST_BASE_URL = http://127.0.0.1:9`, observability and `issues` as in production, `preview_urls: false`, no placement. `wrangler deploy --dry-run -c` accepts it.
- `~/probe-secrets.env` (owner creates; never read by the agent): `SUPABASE_URL=` and `SUPABASE_KEY=` (publishable key only), one per line.

Order: `wrangler deploy -c dist/server/probe-wrangler.json`, then `wrangler secret bulk ~/probe-secrets.env --name sidereus-probe`. Between the two the Worker runs without Supabase (the app boots with `createClient()` null) and touches no data.

Removal (after the checks are recorded): `npx wrangler delete sidereus-probe`; `npx wrangler kv namespace delete --namespace-id <id>` for both ids; delete `dist/server/probe-wrangler.json` and `~/probe-secrets.env`.

## Decision and cleanup (owner, 2026-10-16)

The probe Worker was skipped; `sidereus-probe` was never deployed. 1.9 and 1.10 are now owner manual checks on production: 1.9 on any `sidereus` invocation event in Workers Logs (`request.cf` geo fields and client IP absent), 1.10 on the first real `sidereus: <step> failed` line and its Issue (grouped by message, `step` filterable). D2 is revisited only if 1.10 shows a different grouping or an unfilterable `step`.

Removed: KV namespaces `sidereus-probe-forecast-cache` (c49fa235…) and `sidereus-probe-session` (cf95030e…) deleted with `wrangler kv namespace delete`; `dist/server/probe-wrangler.json` deleted; `~/probe-secrets.env` never existed. `wrangler kv namespace list` afterwards shows only the production `FORECAST_CACHE` and `sidereus-session`. Left on the account: Version `5626dfff` (tag `probe`, no traffic; its Version URL is gone with Phase 6's `preview_urls: false`).

## 1.10 result (owner, 2026-10-16, production)

The owner found a real `sidereus: forecast.fetch failed` error in Workers Logs and its Issue.
- **Grouping: confirmed.** The Issue groups repeated occurrences of the same message, so one fixed message per step (D2) groups per step.
- **Field filter: failed.** Filtering on `step` as a field does not work: a two-argument `console.error(message, fields)` is not indexed as fields (impl review F4's worry). The message embeds the step (`sidereus: <step> failed` or `noted`), so a text search on the message finds each step.
- **Decision (owner): keep D2 and the line shape unchanged.** Record the limitation: the runbook (Phase 6) and any saved query or alert describe searching **by message text**, never by the `step` field; the fields in the second argument stay for reading a line, not for filtering. Phase 6's runbook and the Phase 7 count query (D13) must use the message text.
- 1.9 (invocation event `request.cf` geo fields) is still pending the owner.

## 1.9 result (owner, 2026-10-16, production): FAILED, fallback applied

A `sidereus` invocation event in Workers Logs carries the full `request.cf`: latitude, longitude, city, postalCode, region, regionCode, metroCode, timezone (the sample was Cloudflare's own request, but visitors' requests carry their IP-derived location). The Logs field search finds none of these names (not indexed), but the values are stored. This predates S-07.

Fallback applied now, separately: PR #187 (`fix/invocation-logs-off`, from main d88045e) sets `observability.logs: { enabled: true, invocation_logs: false }` (key confirmed in wrangler 4.145's schema and upload code; the build carries it into `dist/server/wrangler.json`, dry-run accepts it), pins it in `src/lib/wrangler-config.test.ts` and adds a CLAUDE.md tripwire. Existing logs expire with the retention window (7 days on Paid) and cannot be deleted by us.

Traces: Cloudflare's spans-and-attributes docs list `geo.locality.name` (city), `geo.locality.region`, `geo.country.code`, `geo.continent.code`, `geo.timezone`, `cloudflare.asn`, `user_agent.original`, `url.full`/`url.path` and KV key names on every span; no latitude, longitude, postal code or client IP. Turning traces off is proposed in the PR, not applied (owner decision).

After #187 deploys, verify: (1) a fresh request leaves no `cf-worker-event` row; (2) an Issue is still created for a logged error (whether the "failed invocation" Issue kind needs the invocation event is undocumented); (3) whether the console lines of one request still share an invocation or request identifier (D4's correlation); the Phase 6 runbook's "What the invocation event holds" section records the result.

## Traces decision (owner, 2026-10-16)

Traces stay enabled; no follow-up PR. They carry city, region, country, continent, time zone, user agent, `url.*` and KV key names by platform design (no supported redaction or per-attribute control: traces docs, custom-spans, known-limitations, spans-and-attributes; read 2026-10-16), and are under GDPR review, issue #191. Fallback if the review says no: `traces.enabled: false` plus a rounded duration field on our own `logNotice` line for slow upstream calls.
