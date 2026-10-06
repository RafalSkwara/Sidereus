<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Offline night plan

- **Plan**: context/changes/offline-night-plan/plan.md
- **Scope**: Full plan (Phases 1–4; Phase 1 also has its own report, impl-review-phase-1.md)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-06
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

**Plan adherence.** Every Critical Implementation Detail is implemented, nothing is missing, and no "What We're NOT Doing" item crept in. Phase 1 is intact.

**Checked and found fine:**
- XSS: `markFromDevice` inserts a constant, and `/offline` builds its list with `textContent`.
- No coordinates appear in the index, the cache keys or any URL.
- The index queue, idempotent commit and asset reference counting are sound.
- There are no unhandled rejections, and responses are cloned correctly.

**Success criteria.** All automated criteria passed on this tree during the Phase 4 gates:
- unit tests: 723 passed;
- `astro check` and lint: 0 errors;
- the offline e2e spec;
- the full e2e suite: 28 passed, 2 skipped.

Manual check 4.9, the real phone, is still pending with the user.

## Findings

### F1 — Stored pages can outlive a sign-out the worker never saw

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/sw.ts:480-490, src/sw.ts:114-121
- **Detail**: A purge runs only when an auth POST or a Tonight `opaqueredirect` passes through the worker. Pages the worker does not control (a hard reload, `controller === null`) post sign-out and sign-in straight to the network. Two consequences:
  - A's stored shells (email, gear, site names) stay on the device and are served offline with no auth check.
  - After user B signs in, B's copies merge into A's index. `/offline` then lists A's sites to B, and B can be served A's page after a 4 s timeout.

  An expired session is purged only on the next online Tonight navigation.
- **Fix**: Give the index an owner, and let signed-out pages ask for a purge.
  - The island's `[data-offline-copy]` carries `data-owner`, a non-reversible hash of the user id. A commit whose owner differs from the index purges and re-scopes first.
  - The layout marks signed-out pages, and the page script posts `{ type: "purge" }` to the worker from them.
  - Strength: closes both the hard-reload and the expired-session paths at the next page view, without relying on which requests the worker sees.
  - Tradeoff: one more attribute, a hashing helper on the server, and a message route.
  - Confidence: HIGH — every signed-out render and every commit is a checkpoint the worker can trust.
  - Blind spot: a device that never views a page again keeps the copies until expiry (see F4).
- **Decision**: FIXED

### F2 — The stored `/offline` page can be written after a purge, with the old user's email

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/sw.ts:143-154
- **Detail**: `/offline` is rendered with cookies, and its Topbar includes the user's email. `storeOfflinePage` is not checked against the index's scope. If its fetch started before a sign-out purge, it still writes afterwards.
- **Fix**: Take `currentScope()` before the fetch, and put only if the index still has that scope. Assert in the e2e that the stored `/offline` holds no email after sign-out.
- **Decision**: FIXED

### F3 — The shell's scope is taken after the network answers

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/sw.ts:245-246, src/sw.ts:450-454
- **Detail**: A Tonight response sent with A's cookies that lands after a purge picks up the new scope. With two tabs open, A's pair can then commit into the purged store.
- **Fix**: Call `currentScope()` at the start of the Tonight route handler and pass it into `recordShell`.
- **Decision**: FIXED

### F4 — The 36 h expiry filters what is served, not what is kept

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/sw.ts:123-140, src/sw.ts:515-517
- **Detail**: `sweep()` runs only on activate and after a commit. Expired HTML stays in Cache Storage indefinitely if no Tonight page is opened online again.
- **Fix**: Also run a throttled `sweep()` (at most hourly) on worker start, on `message`, and when serving a stored copy.
- **Decision**: FIXED

### F5 — The next-night fetch re-sets the remembered site and renders every page

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/sw.ts:339-356, src/lib/tonight/requested-gear.ts:11-20
- **Detail**: The background `?site=<id>&night=next` fetch runs through `requestedGear`, which re-sets the httpOnly site cookie. A site switch made in another tab while the fetch is in flight is undone. The fetch also runs for each of the six pages per site per hour.
- **Fix**: `requestedGear` never remembers gear on a `night=next` request; the next-night copy stays for every page the user opened.
  - Strength: removes the side effect at its source with a one-line guard. Six background renders an hour per site is modest on Workers Paid.
  - Tradeoff: the server load stays as is.
  - Confidence: HIGH — the cookie write is the only state change in that path.
  - Blind spot: render cost per island was not measured.
- **Decision**: FIXED

### F6 — A late network answer after the timeout is ignored

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/sw.ts:391-416
- **Detail**: When the stored copy wins the 4 s race, the network response is neither used nor inspected. A late `opaqueredirect` from an expired session therefore never purges, and a late fresh 200 is not stored.
- **Fix**: Keep inspecting the network promise in `waitUntil`: purge on `opaqueredirect`, and store a 200 as a pending shell.
- **Decision**: FIXED

### F7 — "Offline ·" is wrong when the copy was served after a timeout online

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/i18n/messages/{en,pl}.ts `offline.notice.prepared`
- **Detail**: The prepared notice also shows on `data-from-device` copies served while the device is online but the network is too slow.
- **Fix**: Change the wording to "Saved copy · prepared …" / "Zapisana kopia · przygotowano …".
- **Decision**: FIXED — "Saved copy · prepared …" / "Zapisana kopia · przygotowano …" (user choice)

### F8 — The e2e spec has weak spots

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/e2e/offline.spec.ts:62, :136-137, :155-160
- **Detail**:
  - The proxy restart has no `error` listener.
  - The "click does not navigate" check passes before any navigation could happen.
  - Nothing asserts that the stored `/offline` holds no email, or that the assets cache is empty, after sign-out.
- **Fix**:
  - Add `server.once("error", reject)`.
  - Assert that the `/log` heading stays absent after a short wait.
  - Add the two sign-out assertions.
- **Decision**: FIXED

### F9 — The plan text lags behind three sanctioned deviations

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: plan.md Phase 3.2 and 4.4
- **Detail**:
  - A stored island URL is answered from the cache at once, not network-first with the timeout. This is harmless, since island URLs are unique per render.
  - The e2e asserts the disabled Log tab, not Mark observed, which the dashboard and plan pages don't render.
  - The 4.4 Contract still names the `PW_EXPERIMENTAL` env var rather than the closable proxy.
- **Fix**: Add a short "Implementation notes" line under Phases 3 and 4 recording the three deviations.
- **Decision**: FIXED — implementation notes added to plan Phases 3 and 4

### F10 — Small hardening items

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/sw.ts:302-307, src/sw.ts:187-193, src/lib/offline/copies.ts:332-343, src/layouts/Layout.astro (theme script), src/lib/offline/page-state.ts:107-109
- **Detail**:
  - Pending shells are not deleted on every exit path.
  - The asset route runs IPC for non-Tonight clients on every request.
  - `isCopyMeta` accepts unparsable dates, which then never expire.
  - `decodeURIComponent` can throw on a malformed theme cookie.
  - `page-state` re-applies on every DOM mutation, for example while the sky is panned.
- **Fix**:
  - Delete the pending entry on every exit path.
  - Remember client ids already known to be non-Tonight.
  - Require finite dates in `isCopyMeta`.
  - Wrap the decode in try/catch.
  - Batch `apply()` in `requestAnimationFrame`.
- **Decision**: FIXED
