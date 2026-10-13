<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Observing milestones (M-3 S-06)

- **Plan**: context/changes/observing-milestones/plan.md
- **Scope**: Full plan (commits 3365b97..899512b, plus the uncommitted dialog focus fix in the working tree)
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-10-13
- **Reviewer**: the "reviewer" agent (Opus), independent of the author
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 2 observations
- **Triage**: not run interactively. The owner is away and the orchestrator's rules forbid asking, so each finding carries a **Recommended resolution** and `Decision: PENDING`. `change.md` was deliberately **not** stamped `impl_reviewed`, against the skill's default: the orchestrator's rule is that the author updates it. The reviewer wrote only this file.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Evidence

### Gates the reviewer ran (read-only)

| Gate | Result |
|------|--------|
| `npm test` | 93 files, 1593 passed, 1 skipped, 6 todo |
| `npx astro check` | 0 errors, 0 warnings, 0 hints |
| `npm run lint` | clean |
| `npm run test:db` against the shared local stack | 8 files, 197 passed |
| `supabase gen types --local` piped through Prettier | identical to the committed `src/lib/database.types.ts` (no drift) |

- `test:db` covers isolation, structure and `tests/db/milestones.test.ts`.
- The migration `20261013120000_observing_milestones.sql` has one commit (`2d6985e`) and was not edited after it was applied to the shared stack.

### What the reviewer did not run

- **E2E:** not run by the reviewer. The orchestrator declined the run while the author rebuilds the preview. Rows 4.1 and 6.1 rest on the author's runs, which predate the uncommitted focus fix, and the orchestrator will relay the author's re-run.
- **Manual checks:** 6.3 and 6.4 are still `[ ]`.

### Logic, traced in code

- **Counting save** (a create or an edit rated 3 or above), `celebrate.ts:113-133`:
  - read `before`, write, read `after` even when `before` failed;
  - record `reached(before) ∪ reached(after)` in one insert, using the `after` night where both have the milestone;
  - celebrate `newlyReached ∩ inserted` only when both reads and the record succeeded, in `MILESTONES` order.
- **Edit to 1-2 and delete** (`counts: false`), `celebrate.ts:102-111`: read `before`, record it, then write; never celebrate.
- **Create rated 1-2**: does nothing, `index.ts:44-53`.
- This is plan re-review F11, Fix A, as recommended. `celebrate.test.ts` covers every branch, including the edit away from a galaxy (M31 → M13) and the delete.

### Database

- **The table:** unique `(user_id, key)`, a check on the 11 keys, and four `to authenticated` policies on `(select auth.uid()) = user_id`, with update guarded by `using` and `with check`. Nothing for `anon`, no function. The header records why self-only writes are accepted.
- **The store:** `milestoneStore.record` uses `upsert(…, { onConflict: "user_id,key", ignoreDuplicates: true }).select("key")`, and the db test proves that a second record returns `[]` and keeps the first night.
- **Isolation:** `afterEach` deletes A's rows by the ids `insertAsA` returned.
- **`TABLES`** has the entry.
- **`test-plan.md:166`** names the new table.

### Logging

- One disable, in `celebrate.ts:42`, with `ALLOWED_DISABLES` count 1 (`no-console-guard.test.ts`).
- `progress.astro` logs through `logMilestoneFailure("list" | "seen")`, so the S-05 silent `catch {}` is now traced.
- The logged line is the step word plus the error's and the cause's names, never a message.

### URLs

- `withMilestones` appends only `MILESTONES` keys.
- `readMilestoneParam` returns keys for signed-in users only, validated by `isMilestoneKey`, de-duplicated and ordered.
- `milestone` is in `NOTICE_PARAMS` (`copies.ts:35`, plus 2 `copies.test.ts` cases).
- No coordinate or typed value reaches a URL.

### No prototype left over

- `grep` for `devCelebrationVariant`, `celebration=`, variant props and `milestone-variants` finds nothing in `src` or `tests`.
- The i18n keys left are `celebration.{reached, seeProgress, continue}`.
- The `/design` specimens show only the dialog (as an inline `<div>`) and `MilestoneList`.

### Dialog C

- **Open:** a native `<dialog>` opened with `showModal()`, which makes the page inert and acts as the focus trap.
- **Focus on open:** goes to Continue.
- **Labels:** `aria-labelledby` (the label) and `aria-describedby` (the names).
- **Closing:** Esc closes it natively.
- **Motion:** the twinkle runs only under `prefers-reduced-motion: no-preference`.
- **Colour:** tokens only (`night-sky`, `from-zenith`, `fill-star`, `text-primary-strong`, `border-action-border`).
- **One primary action:** Continue.

## Findings

### F1 — The save's toast sits behind the modal and times out while the dialog is open

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/toasts.ts:71-117 (`watch`); src/components/progress/MilestoneCelebration.astro (script)
- **Detail**:
  - **The owner's choice.** On 2026-10-13 the owner picked dialog C with "the save's toast stays".
  - **The toast is hidden.** It is `position: fixed; z-index: 50` (`global.css:493-497`, `toast-region`). A `showModal()` dialog renders in the top layer above every z-index, with a `backdrop:bg-background/80` covering the page. So the toast shows only dimmed to about 20 % behind the backdrop, and it is inert, so it can't be hovered or focused.
  - **The timer keeps running.** `watch` starts the 10 s timer at adoption, and it pauses only on hover or focus. A user who reads the dialog for more than 10 s closes it to find no save confirmation.
  - **Tonight pages are worse.** The island inserts the toast after the dialog is already open.
  - **The e2e doesn't see it.** It asserts `[data-toast]` text only, which passes whether or not the toast is visible.
- **Fix**: In `watch`, don't start the timer while a `dialog[data-milestone-celebration][open]` exists; start it on that dialog's `close` event. That is a few lines in `toasts.ts` plus a `toasts.test.ts` case. In e2e, assert the toast is still there after Continue. In manual check 6.3, look at the toast after closing the dialog.
- **Recommended resolution**: apply the fix (delegated; it implements the owner's "toast stays").
- **Decision**: FIXED (author, 2026-10-13, on the orchestrator's instruction).
  - `toasts.ts` `watch()` holds the timer while `celebrationHolding(document)` finds a celebration dialog that hasn't closed. It is server-rendered and opens on load, so "not yet closed" counts. The timer starts on that dialog's `close` event, and the dialog marks itself `data-milestone-closed`.
  - `toasts.test.ts` covers `celebrationHolding`.
  - The e2e uses a fake clock to run past 10 s while the dialog is open: the toast is still there, it is visible after Continue, and it closes 10 s later.
  - Break-check: with the hold disabled, the toast was gone behind the dialog and the e2e went red.
  - The test waits for the dialog's `close` event before running the clock, since the event is dispatched as a task after the click.

### F2 — The focus fix sends focus to `<body>`, not `<main>` as the repo's own close pattern does, and it is uncommitted

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/progress/MilestoneCelebration.astro:136-141 (working tree); tests/e2e/observing-milestones.spec.ts:188-191 (working tree)
- **Detail**:
  - **The new code.** The uncommitted fix adds a `close` listener that `blur()`s a focused element inside the dialog. It runs for both Continue and Esc, because `close` fires for both, so the hidden-button bug is fixed.
  - **Where focus lands.** After `blur()` the focus is on `<body>`, so the next Tab starts again at the top of the page.
  - **The repo's pattern.** It already solved this for toasts: `releaseFocus` (`src/lib/toasts.ts:43-51`) moves focus to `<main>` (`tabindex="-1"`, no ring) "so it never falls back to `<body>` and sends the next Tab to the top of the page" (WCAG 2.4.3, `toasts.ts` header).
  - **The test.** The new e2e assertion checks only "not inside the dialog", so it would pass for either behaviour.
  - **Evidence.** The change is not committed, so rows 6.1 and 6.2 (`4b2a799`) predate it.
  - **Lint.** The new e2e lines fail lint: `eslint` reports a `prettier/prettier` error at `tests/e2e/observing-milestones.spec.ts:189` (the agent hook's end-of-turn lint caught it). `npx eslint --fix` on that file resolves it.
- **Fix**: Export `releaseFocus` from `toasts.ts` (or a shared `focusMain()`) and call it in the dialog's `close` listener. Assert `document.activeElement` is `main` in the e2e. Commit with the re-run gates, and update Progress 6.1 and 6.2 to the new SHA.
- **Recommended resolution**: apply the fix.
- **Decision**: FIXED (author).
  - `toasts.ts` exports `focusMain()`, now also used by `releaseFocus`.
  - The dialog's `release()` runs on Continue (synchronously) and on its `close` event (Esc). It moves focus to `<main>` when focus is on `<body>` or inside the dialog.
  - The e2e asserts `document.activeElement` is `MAIN`. The earlier `blur()` version (5940599) would fail that.
  - The prettier error is fixed (eslint --fix), and lint is clean.

### F3 — Two small gaps in the db tests

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/db/milestones.test.ts:92-95 and the suite as a whole
- **Detail**:
  - **"Makes no request for an empty input"** only checks that no row exists. A request that inserted nothing would pass too. The real "no request" proof is the unit test (`celebrate.test.ts`: "makes no record call when the log reached nothing"), so this test's title overstates what it proves.
  - **Concurrency is untested.** The plan's headline guarantee ("two saves at the same moment cannot both celebrate", migration header, CLAUDE.md) holds by `ON CONFLICT DO NOTHING … RETURNING` semantics, but no test pins it.
- **Fix**: Rename the empty-input test (or count requests with a wrapped `fetch`). Add `Promise.all([record(a, [first-moon]), record(a, [first-moon])])` and assert exactly one call returns `["first-moon"]`.
- **Recommended resolution**: apply the fix.
- **Decision**: FIXED (author).
  - "makes no request for an empty input" now counts PostgREST requests through a wrapped `fetch` on its own user's client. It expects 0, and 1 for a one-key positive control.
  - A new test runs two concurrent `record` calls of `first-moon` for one user: exactly one returns the key, and one row exists.

### F4 — Minor notes (no code change required)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: MilestoneCelebration.astro (`backdrop:` class); src/pages/log/progress.astro; plan Progress 6.3 and 6.4
- **Detail**:
  - **(a) Older Safari.** `backdrop:bg-background/80` depends on `::backdrop` inheriting custom properties from its dialog. That works in Chrome 122+, Firefox 120+ and Safari 17.4+. On older iOS Safari the backdrop is transparent, which is still usable but looks unfinished. Worth one look during manual check 6.3 if an older iPhone is at hand.
  - **(b) A log-line prefix.** A failed S-05 seen read on `/log/progress` now logs as `milestones: seen failed`. It is traced (good), but the prefix names the wrong feature. Harmless; rename only if the step words are revisited.
  - **(c) Pending steps.** Manual checks 6.3 and 6.4 are still pending, and `change.md` is `implementing`. Both are the author's.
  - **(d) Plan re-review F12 is moot.** It was about banner variant A, and the owner picked the dialog, which `GearShell` can host anywhere because it is position-independent.
- **Fix**: none required. Cover (a) in 6.3.
- **Recommended resolution**: no change; (a) is a check during manual step 6.3.
- **Decision**: (a) RECORDED, not testable here. `::backdrop` inherits custom properties only from Safari 17.4. No older iOS device or WebKit build is available, and Playwright's WebKit is newer. On older iOS the backdrop is transparent, but the dialog stays modal and usable. This is noted in the PR.
  - (b) FIXED: the page's S-05 seen read now logs `progress: seen read failed`, and `milestones: <step> failed` remains for the milestone steps. `celebrate.test.ts` was updated because the requirement changed.
  - (c) Done: manual checks 6.3 and 6.4 are ticked (5940599), and `change.md` is `impl_reviewed`.
  - (d) Noted: plan re-review F12 is moot for the dialog.
