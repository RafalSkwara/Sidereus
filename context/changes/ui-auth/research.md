---
date: 2026-10-05T14:20:00+02:00
researcher: Claude (ui-auth agent)
git_commit: d8347039ed7538bfa6723fa4e481efd2255dd97e
branch: feat/ui-auth
repository: sidereus
topic: "/10x-ui audit of /auth/signin and /auth/signup (AuthShell) against the Nightfall contract"
tags: [research, ui, auth, nightfall, AuthShell]
status: complete
last_updated: 2026-10-05
last_updated_by: Claude (ui-auth agent)
---

# Research: /10x-ui audit of the auth views

**Date**: 2026-10-05T14:20:00+02:00
**Researcher**: Claude (ui-auth agent)
**Git Commit**: d8347039ed7538bfa6723fa4e481efd2255dd97e
**Branch**: feat/ui-auth
**Repository**: sidereus

## Research Question

Where do `/auth/signin` and `/auth/signup` (rendered in `AuthShell`) depart from the Nightfall contract, and which 3–5 charges should the plan fix? The audit runs both ways: contract → views (what the views read) and view → contract (which literal should have been a token or component).

## Summary

The two forms already read the shared field contract (`FormField`, `SubmitButton`, `ServerError`, through `src/components/forms/`), so the field, error and pending looks match `/gear`. The pages and the shell around them do not: `AuthShell` is the last shell still drawing the pre-Nightfall boxed card with a stock `text-3xl` heading and no sky header, the switch links use the ink colour (`text-primary`) rather than the link role and have no 44 px target or token focus, the "sign in to continue" note is a plain muted line, and the password eye is a 16 px target with no token focus. `confirm-email.astro` (same shell) shows an emoji, which keeps its full colour in red night mode. Five charges below; one architecture finding is deferred as out of scope for a visual pass.

Baseline screenshots (before any change): `…/scratchpad/before/` (390 px, EN/PL, dark/light/red; the scratchpad path is in the plan's evidence table).

## Pre-audit

- **Value source:** `src/styles/global.css` (theme blocks at `:3`–`:150`, `@theme inline` publishing). **Components:** `src/components/ui/` (8 files), `src/components/forms/` (3 files). **Agent rules:** `CLAUDE.md` "UI (Nightfall)".
- **Hardcoded-value scan** (the skill's regex) over `src/pages/auth/{signin,signup,confirm-email}.astro`, `src/components/auth/{SignInForm,SignUpForm,PasswordToggle}.tsx` and `src/components/AuthShell.astro`: **0 hits** (no hex, `rgb()`, palette class or arbitrary value).
- **Off-role classes** in the same 7 files: 9 — `text-3xl` (`AuthShell.astro:24`), `rounded-2xl … p-8` card (`AuthShell.astro:22`), `text-5xl` (`confirm-email.astro:14`), `text-sm` ×4 (`signin.astro:15,17`, `signup.astro:14`, `confirm-email.astro:18`), `text-xs` (`SignUpForm.tsx:67`), plus `text-primary` used as a link colour ×3 (`signin.astro:19`, `signup.astro:16`, `confirm-email.astro:18`).
- **Contract → views:** the 3 page files import nothing from `src/components/ui/`; the 2 forms import 3 of 3 files from `src/components/forms/`.

## Charges

### C1 — Accidental architecture / composition: the shell is a boxed card, not Nightfall

- **Evidence:** `src/components/AuthShell.astro:22` (`w-full max-w-sm rounded-2xl border border-border bg-surface p-8`) and `:24` (`text-center font-display text-3xl`). No sky header, no `PageHeader`; the card recipe is the one `visual-redesign/frame.md` names as the template tell ("one recipe … ×39", `AuthShell.astro:22` cited there). `AuthShell.astro:17` passes the bare title to `Layout`, while `GearShell.astro:22` uses `m.common.pageTitle({ title })`.
- **User impact:** a visitor arriving from the landing page or bounced from a gated page meets the one screen that still looks like a generic template card rather than Sidereus's sky, and the browser tab reads "Sign in" with no app name.
- **Fix:** the sky header (zenith → horizon band holding Topbar and a `PageHeader` with a short subtitle) as GearShell draws it, the form unboxed on the ground in a narrow column, the page title through `common.pageTitle`.

### C2 — Missing shared component: hand-built switch links in the ink colour

- **Evidence:** `src/pages/auth/signin.astro:19` and `src/pages/auth/signup.astro:16` (`font-semibold text-primary hover:underline`), `confirm-email.astro:18` (`text-sm font-semibold text-primary hover:underline`). `--primary` is the filled-action ink; the link role is `--primary-strong` (`global.css:10-12` comment). The contract's link look is `buttonVariants({ variant: "link" })` (`src/components/ui/button.tsx:27`: `text-primary-strong`, `min-h-11`, `--ring` focus outline).
- **User impact:** "Sign up" / "Sign in" reads as plain bold text rather than a link in dark and light (ink is the heading colour), the target is one line of 14 px text on a phone, and keyboard focus falls back to the browser's default outline.
- **Fix:** `buttonVariants({ variant: "link" })` on the three links; the prompt line in the `text-body` role.

### C3 — Missing shared component: the "continue" note is a bare muted line

- **Evidence:** `src/pages/auth/signin.astro:15` (`<p class="mb-4 text-sm text-muted-foreground">{t.continueNote}</p>`), shown when `?next=` is a safe path (`signin.astro:8`). The contract's status message is `Notice` (`src/components/ui/Notice.astro`, `info` tone).
- **User impact:** someone who opened `/log` signed out lands on sign-in with a small grey sentence above the form that is easy to miss, so the reason for the detour is unclear; it is also not announced.
- **Fix:** `<Notice tone="info">` with the same copy (the e2e test `sign-in-continue.spec.ts:21` reads it by text, which still holds).

### C4 — Focus and target: the password eye button

- **Evidence:** `src/components/auth/PasswordToggle.tsx:15` (`absolute top-1/2 right-3 -translate-y-1/2`, icon `size-4`, no padding, no `focus-visible` classes). The base layer only sets `outline-ring/50` (`global.css`, `@layer base`), so focus is the browser's default outline at half the ring colour.
- **User impact:** on a phone the show/hide control is a 16 px target inside the field, and a keyboard user tabbing past the password sees a faint or missing focus mark on it.
- **Fix:** a 44 px (`size-11`) button flush with the field's right edge, `rounded-lg`, the `--ring` outline inset so it stays inside the field; hover to `text-heading`. The sign-up "N more characters" hint (`SignUpForm.tsx:67`, `text-xs`) moves to the `FieldError` size (`text-sm`, `mt-1.5`), so hint and error share one line height.

### C5 — Missing token (red mode): the confirm-email emoji

- **Evidence:** `src/pages/auth/confirm-email.astro:9-15` renders "✅" / "📧" at `text-5xl`. Emoji glyphs are colour bitmaps that no token reaches, and `Layout.astro`'s `#red-only` filter applies to `img` only (`global.css` red block comment).
- **User impact:** after sign-up (when email confirmation is on), the page shows a green tick or a blue envelope in red night mode, the one thing red mode exists to prevent.
- **Fix:** a lucide icon (`CircleCheck` / `MailCheck`) in a token colour inside the same shell; the page follows C1 and C2.

### Deferred

- **D1 — signed-in visitors still see the forms.** `src/middleware.ts:37-44` redirects only gated paths; `/auth/signin` and `/auth/signup` render for a signed-in user. Redirecting them to `/tonight` is an auth-behaviour change, excluded from this visual pass (change.md scope rule). Left for a follow-up change.
- **D2 — sign-up does not carry `next`.** `signup.astro` has no `next` and `POST /api/auth/signup` redirects to `/onboarding` (`src/pages/api/auth/signup.ts:22`). Behaviour, not visual; deferred.

## Code References

- `src/components/AuthShell.astro:16-31` — the shell (card, heading, Topbar, TabBar)
- `src/components/gear/GearShell.astro:22-48` — the reference sky header (`header` slot, `bg-linear-to-b from-zenith to-horizon`, `max-w-3xl` inner column)
- `src/components/ui/PageHeader.astro`, `Notice.astro`, `button.tsx:27` — the contract pieces the charges reuse
- `src/components/forms/FormField.tsx:27-34,75-96` — `FieldError` size and the `endContent` slot the eye button sits in (`pr-10` on the input)
- `tests/e2e/sign-in-continue.spec.ts:21`, `tests/e2e/helpers.ts:64-70`, `scripts/smoke.mjs:80-176` — auth selectors and text the pass must keep working (`form[action=…]`, `#email`, `#password`, `#confirmPassword`, `button[type=submit]`, `continueNote` text)

## Architecture Insights

- The forms submit plain POSTs; `SubmitButton` already covers pending/disabled, so the loading state needs no work here.
- `AuthShell` is used by exactly 3 pages (`signin`, `signup`, `confirm-email`); `Topbar` / `TabBar` are shared with GearShell and Welcome and need no edit for this pass (Topbar already hides its "Sign in" link on `/auth/signin`, `Topbar.astro:16`).
- Empty state is N/A for the auth forms (no data); the 7-state matrix maps to idle, hover, focus-visible, disabled/submitting, client validation error, server error (`?error=`), `next` present, and long PL copy.

## Historical Context (from prior changes)

- `context/changes/visual-redesign/research.md:111,117,140` — AuthShell's card counted among the 39 card copies; auth listed for its own `/10x-ui` pass.
- `context/changes/visual-redesign/plan.md:55,286` — auth forms inherit the FormField restyle with no edits; their composition waits for this pass.
- `context/changes/visual-redesign/reviews/impl-review.md:46-49` — SubmitButton pending fix covers the auth forms; their rendering of it was not audited then (checked here: both forms use it unchanged, `SignInForm.tsx:93`, `SignUpForm.tsx:137`).

## Related Research

- `context/changes/visual-redesign/research.md`

## Open Questions

- None blocking. Subtitle copy for the two headers is a visual/copy judgement (listed in the PR's "Visual choices for review").
