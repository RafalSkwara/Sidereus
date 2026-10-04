<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Tonight in the Nightfall design

- **Plan**: context/changes/tonight-nightfall/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Success criteria, re-run on HEAD (322f1f4):

- `npm test`: 612 passed.
- `npm run lint`: 0 errors.
- `npx astro check`: 0/0/0.
- `npm run build`: OK.
- `diff CLAUDE.md AGENTS.md`: identical.
- `package.json` and the lockfile: unchanged.
- e2e: 18 passed, 2 skipped, and smoke passed, both run on the phase 4 code. `/tonight` did not change after that.
- Progress: all 38 rows are `[x]` with SHAs.
- Manual rows have evidence: Playwright probes, the red audit, and the user-approved gate at https://claude.ai/artifact/AsQVAXmPNLV85j29kmeYdS.

Nothing in the plan is missing.

## Findings

### F1 — The 7-night bars show the verdict by colour only

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/TonightSummary.astro:60,70,161-172; src/i18n/messages/en.ts:781
- **Detail**:
  - **Where the verdict lives.** The caption says "Colour is the verdict", but nights 1–3 carry no other visible verdict cue. The text exists only in the sr-only summary.
  - **Red mode.** The three verdict fills are #ff0000, #d60000 and #bb0000, which are practically the same.
  - **Dark mode.** Go (green) and no-go (coral) can be confused by colour-blind users (WCAG 1.4.1).
  - **Missing nights.** A 0%-clear night and a night with no forecast both draw the same hairline (`:69`).
- **Fix A ⭐ Recommended**: Under each of the 3 verdict bars, add a small shape-coded mark (go = filled dot, marginal = half dot, no-go = ring), drawn from tokens. Draw a `null` night as a dashed outline instead of a hairline.
  - Strength: Works in red mode and for colour-blind users, keeps the design's bars, and needs no new copy.
  - Tradeoff: A new small legend element, and the caption wording changes ("Colour and mark are the verdict").
  - Confidence: HIGH — pure markup and tokens.
  - Blind spot: How the marks read at 1280 px.
- **Fix B**: Remove "Colour is the verdict" from the caption and rely on the full strip below for verdicts.
  - Strength: The smallest change.
  - Tradeoff: The bars lose meaning at a glance, which is the band's purpose.
  - Confidence: MED.
  - Blind spot: Users who never scroll to the strip.
- **Decision**: FIXED (Fix A where offered) on fix/tonight-review-fixes, 2026-10-04

### F2 — The giant verdict word clips at 320 px and at 400% zoom

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/styles/global.css:305-321; src/components/tonight/VerdictCard.astro:36-41
- **Detail**:
  - **Why it clips.** The tiers are sized for a 360 px screen. At 320 px the content is 288 px wide: "Tak" at 144 px needs about 310 px and "Marginal" at 60 px needs about 303 px.
  - **Effect.** TonightSky is `overflow-hidden` and a single word cannot wrap, so the word is cut off (WCAG 1.4.10).
- **Fix**: Make each verdict role fluid in the token itself, e.g. `--text-verdict-lg: min(9rem, calc((100vw - 2rem) / 2.2))`, with the divisor set from each tier's widest word. It stays a token (no arbitrary class) and fits any width.
- **Decision**: FIXED (Fix A where offered) on fix/tonight-review-fixes, 2026-10-04

### F3 — Summary band links have overlong, repeated accessible names

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/TonightSummary.astro:78-174
- **Detail**:
  - **Whole band as the name.** Each band is one `<a>` around an h2, lists and captions, so a screen reader reads the whole band as the link name.
  - **The Moon band repeats itself.** It reads the phase and % twice: the disc's `aria-label`, then the visible text.
- **Fix**: Give each link `aria-labelledby="<heading id> <sr-only 'Show details' id>"`, and mark the summary MoonDisc decorative (`aria-hidden`, no label).
- **Decision**: FIXED (Fix A where offered) on fix/tonight-review-fixes, 2026-10-04

### F4 — `/log/sky` pre-outlines the forecast's answer, and pressed and suggested answers look the same

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/components/sky-checks/SkyAnswerForm.astro:28,39-40; src/pages/log/sky.astro:154
- **Detail**:
  - **Scope.** The shared form change (outline for the matching answer, the old `aria-pressed:` fill removed) reached `/log/sky`, which the plan did not cover.
  - **Bias.** On unanswered nights there, the answer that agrees with Sidereus's own forecast is outlined in advance, which can sway the honest check the verdict tally depends on.
  - **Confusion.** A saved answer (`aria-pressed`) now looks the same as the merely suggested one.
- **Fix A ⭐ Recommended**:
  - Restore a distinct pressed style (`aria-pressed:` fill from the selected tokens).
  - Stop passing `matching` on `/log/sky`; there, all unanswered answers are equal outline buttons.
  - On Tonight, keep the matching answer outlined, as the design shows.
  - Strength: Restores the neutral check on `/log/sky` and keeps Tonight's design.
  - Tradeoff: The two pages show the form slightly differently.
  - Confidence: HIGH.
  - Blind spot: Whether a neutral look is wanted on Tonight too.
- **Fix B**: Neutral everywhere: no `matching` outline on Tonight either (all three answers outline, pressed filled).
  - Strength: The same honest check in both places.
  - Tradeoff: Departs from the approved Tonight look (one answer outlined).
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A where offered) on fix/tonight-review-fixes, 2026-10-04

### F5 — Notices inside the island may not be announced, and errors never are

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/TonightContent.astro:145-153; src/components/ui/Notice.astro
- **Detail**:
  - **Success notices.** The notice now arrives with the server island, after Notice's re-announce script has already run at page load, and a live region inserted with its text already present is not announced.
  - **Error notices.** The error path renders `ServerError`, which has no role, so a failed save is never announced.
- **Fix**:
  - Notice's script watches for notices added later (a `MutationObserver` on `document.body` for `[data-notice-text]`) and re-announces them once.
  - The island's error path renders `ServerError` inside a `role="alert"` wrapper.
- **Decision**: FIXED (Fix A where offered) on fix/tonight-review-fixes, 2026-10-04

### F6 — The sky's minimum height and the verdict size tiers are not in the plan; setup states show a tall empty sky

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/TonightSky.astro:32; src/styles/global.css:305-321; TonightContent.astro:139-141
- **Detail**:
  - **Unplanned values.** `min-h-109 sm:min-h-111` (tuned to the EN go content so the skeleton matches) and the four `text-verdict-*` roles were added during phase 2 and never written into the plan.
  - **Empty sky.** Setup and add-site states reuse the tall sky with only a title.
- **Fix**:
  - Add a plan addendum recording both decisions.
  - Make the minimum height apply only when a verdict is shown, via a `verdict` prop on TonightSky that both the skeleton and the content pass.
- **Decision**: FIXED (Fix A where offered) on fix/tonight-review-fixes, 2026-10-04

### F7 — The skeleton's reload link is under 44 px and has no ring focus

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/TonightSkeleton.astro:73-75
- **Detail**: The rest of the view moved to 44 px controls with the ring focus; this link did not.
- **Fix**: Use `buttonVariants({ variant: "link", size: "sm" })`.
- **Decision**: FIXED (Fix A where offered) on fix/tonight-review-fixes, 2026-10-04

### F8 — Dead code after the restyle

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/verdict-tones.ts:5-7; en.ts/pl.ts `tonight.card.kicker`, `skyChecks.card.kicker`
- **Detail**: `VERDICT_TONES[*].card` and the two kicker keys no longer have any users.
- **Fix**: Remove them; parity stays.
- **Decision**: FIXED (Fix A where offered) on fix/tonight-review-fixes, 2026-10-04

### F9 — Hardcoded counts and repeated text in the summary

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: en.ts:780-781 (+ pl); VerdictCard.astro:78-79 vs TonightSummary.astro:41-46,102
- **Detail**:
  - **Counts.** "Next 7 nights" and "the next three nights" hardcode counts that NightStrip parametrises (`OUTLOOK_NIGHTS`).
  - **Repetition.** On a no-go night, "Next clearer night: …" appears in the sky and again in the first band.
- **Fix**:
  - Parametrise the counts.
  - In the no-ranking band, show only `noTargets` and let the sky carry the next clearer night.
- **Decision**: FIXED (Fix A where offered) on fix/tonight-review-fixes, 2026-10-04

### F10 — Two `[data-moon-disc]` elements on Tonight

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/TonightSummary.astro (MoonDisc); MoonTimeSlider.tsx
- **Detail**: The summary disc also carries `data-moon-disc`. The specs scope to the Moon section, but an unscoped selector would match two elements.
- **Fix**: Drop `data-moon-disc` from the summary disc; it is decorative after F3.
- **Decision**: FIXED (Fix A where offered) on fix/tonight-review-fixes, 2026-10-04
