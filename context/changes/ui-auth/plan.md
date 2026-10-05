# Auth views in Nightfall Implementation Plan

## Overview

The `/10x-ui` pass on `/auth/signin` and `/auth/signup` (and `confirm-email`, which shares `AuthShell`): bring the shell and pages onto the Nightfall contract that `/gear` and `/tonight` already follow, fixing charges C1–C5 from `research.md`. A visual pass only: routes, error-key mapping, `safeNextPath` and `next` handling do not change.

## Current State Analysis

- The forms already use the shared field contract (`FormField`, `SubmitButton`, `ServerError`), so field, error and pending looks match `/gear` (research, Architecture Insights).
- `AuthShell.astro:22-24` draws the pre-Nightfall boxed card and a stock `text-3xl` heading, no sky header, and passes the bare title to `Layout` (C1).
- Switch links use `text-primary` (the ink, not the link role) with no 44 px target or token focus (C2); the `next` note is a bare muted line (C3); the eye button is a 16 px target with no token focus (C4); confirm-email shows colour emoji in red mode (C5).
- The hardcoded-value scan finds 0 literals in the 7 files; the contract already has every token and component this pass needs.

## Desired End State

Sign-in and sign-up open with the sky header (Topbar on the zenith-to-horizon band, a `PageHeader` with the title and a one-line subtitle, ending on the horizon rule), then the form unboxed on the ground in a narrow column, the switch line below it with a `buttonVariants` link, and, when `?next=` is present, an info `Notice` above the form. The eye button is a 44 px target with the `--ring` focus. The tab title reads "Sign in · Sidereus". Confirm-email uses the same shell with a token-coloured lucide icon. Verified by the screenshot matrix (EN/PL × dark/light/red × 390/1280, plus the state set) and the existing checks.

### Key Discoveries:

- `GearShell.astro:31-40` is the sky-header recipe to mirror (`border-b border-border bg-linear-to-b from-zenith to-horizon`, Topbar row, then the header slot column).
- `button.tsx:27`: the `link` variant is `text-primary-strong`, `min-h-11`, `--ring` outline — the contract's link look.
- `Notice.astro` (`info` tone) re-announces its text after load; `sign-in-continue.spec.ts:21` reads the note by text with `toBeVisible`, which auto-waits through the 150 ms swap.
- `FormField.tsx:94` gives the input `pr-10` when `endContent` is set; a 44 px button flush right overlaps the padding by 4 px, which is under the icon's own margin, so `FormField` needs no edit.

## What We're NOT Doing

- No auth behaviour change: no redirect of signed-in visitors (D1), no `next` on sign-up (D2), no route or error-key change.
- No new tokens and no new shared component (nothing the view needs is missing), so `/design` and `global.css` stay untouched.
- No edit to `Topbar`, `TopbarControls`, `TabBar`, `FormField`, `SubmitButton` or `ServerError`.
- No screenshot baselines; the matrix is a manual gate.

## Implementation Approach

`/10x-ui` order: environment → token values → one view → states. The environment and token phases are empty for this pass (the Nightfall contract and library are in place, and the audit found no missing token), so they are recorded here as N/A rather than as phases. Phase 1 recomposes the shell and pages; Phase 2 fixes the controls and runs the state gate and the rule.

## Phase 1: Shell and pages in Nightfall

### Overview

C1, C2, C3 and C5: the sky header, the unboxed narrow column, the page title, the switch links, the continue notice and the confirm-email icon.

### Changes Required:

#### 1. AuthShell

**File**: `src/components/AuthShell.astro`

**Intent**: Replace the boxed card with the Nightfall composition: the sky header band holding the Topbar and a `PageHeader` (title, optional subtitle), then `<main>` with the slot in a narrow column on the ground. Title through `m.common.pageTitle`.

**Contract**: Props `{ title: string; subtitle?: string }` (the `centered` prop goes; its one caller, confirm-email, moves to the new layout). The `icon` named slot stays, rendered above the `PageHeader` in the header column. Header column and main column share one width (`max-w-md px-4`) so the title and the form line up.

#### 2. Sign-in and sign-up pages

**File**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`

**Intent**: Pass the new subtitles; render the `next` note as `<Notice tone="info">` above the form (sign-in only); render the switch line below the form, separated by a rule, in `text-body text-muted-foreground` with the link through `buttonVariants({ variant: "link" })`.

**Contract**: `next` is still read through `safeNextPath` and passed to `SignInForm` unchanged; `?error=` still goes to the form as `serverError`.

#### 3. Confirm-email page

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: Replace the emoji with lucide icons (`CircleCheck` in `text-go` when registered, `MailCheck` in `text-primary-strong` for check-email) in the `icon` slot; description in `text-body`; link through `buttonVariants({ variant: "link" })`.

**Contract**: Same copy keys; no route change.

#### 4. Copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Add `auth.signIn.subtitle` and `auth.signUp.subtitle` (appended at the end of each block, matching keys in both).

**Contract**: Plain strings; parity test in `i18n.test.ts` covers them.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npx astro check` passes
- `npm test` passes (includes no-hardcoded-colors, red-theme, contrast and i18n parity)
- Hardcoded-value scan on the auth files returns 0 hits

#### Manual Verification:

- Sign-in and sign-up idle at 390 px and 1280 in dark/light/red, EN and PL, read as Nightfall (sky header, unboxed form), with no horizontal overflow
- `?next=` shows the info notice; confirm-email shows a token-coloured icon in red mode

**Implementation Note**: autonomous run; manual checks are ticked with screenshot paths.

---

## Phase 2: Controls, states, gate and rule

### Overview

C4, the sign-up hint size, the 7-state matrix across the applicable states, the e2e and smoke runs, and the CLAUDE.md line.

### Changes Required:

#### 1. Password toggle

**File**: `src/components/auth/PasswordToggle.tsx`

**Intent**: A 44 px (`w-11`, full field height) button flush with the field's right edge, `rounded-lg`, `text-muted-foreground` → `hover:text-heading`, with the `--ring` focus outline inset (`-outline-offset-2`) so it stays inside the field.

**Contract**: Same props and accessible name (`aria-label` show/hide).

#### 2. Sign-up hint

**File**: `src/components/auth/SignUpForm.tsx`

**Intent**: The "N more characters" hint takes `FieldError`'s size and spacing (`mt-1.5 text-sm`), so the hint and the error that replaces it share one line height.

**Contract**: No logic change.

#### 3. Rule

**File**: `CLAUDE.md` ("UI (Nightfall)")

**Intent**: One line: auth pages render in `AuthShell` (sky header with `PageHeader` + subtitle, unboxed narrow column); switch links use `buttonVariants({ variant: "link" })`, status lines `Notice`.

### Success Criteria:

#### Automated Verification:

- `npm run lint`, `npx astro check`, `npm test` pass
- Auth e2e specs pass against the local preview (`sign-in-continue`, `onboarding`, `landing-screenshot`, plus the full suite's sign-up helper)
- `npm run smoke` passes against the local preview

#### Manual Verification:

- State matrix screenshotted (idle, hover/focus on link and eye, client validation error, server error via `?error=`, submitting/disabled, `next` present, long PL copy) in dark/light/red at 390, plus dark at 1280; empty N/A (no data), loading = submitting
- Focus visible on every control in all three themes; no Polish overflow at 390 px
- The eye button's hit area is 44 px

---

## Testing Strategy

### Unit Tests:

- None new: the visual changes are covered by screenshots, and i18n parity is already tested (user: keep tests modest).

### Integration Tests:

- Existing e2e specs and smoke cover the auth selectors (`form[action=…]`, `#email`, `#password`, `#confirmPassword`, `button[type=submit]`, the continue note's text).

### Manual Testing Steps:

1. Scratch script (scratchpad `auth-shots.mjs`) screenshots the matrix against the preview on port 4322.
2. Read each contact sheet for contrast, focus, overflow and red-mode colour.

## References

- Research: `context/changes/ui-auth/research.md`
- Reference shell: `src/components/gear/GearShell.astro:31-40`
- Contract: `context/changes/visual-redesign/plan-brief.md`, `src/styles/global.css`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shell and pages in Nightfall

#### Automated

- [x] 1.1 `npm run lint` passes
- [x] 1.2 `npx astro check` passes
- [x] 1.3 `npm test` passes (includes no-hardcoded-colors, red-theme, contrast and i18n parity)
- [x] 1.4 Hardcoded-value scan on the auth files returns 0 hits

#### Manual

- [x] 1.5 Sign-in and sign-up idle at 390 px and 1280 in dark/light/red, EN and PL, read as Nightfall, with no horizontal overflow
- [x] 1.6 `?next=` shows the info notice; confirm-email shows a token-coloured icon in red mode

Evidence (scratchpad `…/scratchpad/ui-auth-after/`, not committed): 1.5 `sheet-signin-390-0.png`, `sheet-signup-390-1.png`, `sheet-signin-1280-0.png`, `sheet-signup-1280-0.png` (the script reports no horizontal overflow on any shot); 1.6 `sheet-signin-390-1.png` (the `next` rows) and `sheet-confirm-390-0.png`. Baseline before the change: `…/scratchpad/before/sheet-signin-390-0.png`.

### Phase 2: Controls, states, gate and rule

#### Automated

- [ ] 2.1 `npm run lint`, `npx astro check`, `npm test` pass
- [ ] 2.2 Auth e2e specs pass against the local preview
- [ ] 2.3 `npm run smoke` passes against the local preview

#### Manual

- [ ] 2.4 State matrix screenshotted in dark/light/red at 390, plus dark at 1280
- [ ] 2.5 Focus visible on every control in all three themes; no Polish overflow at 390 px
- [ ] 2.6 The eye button's hit area is 44 px
