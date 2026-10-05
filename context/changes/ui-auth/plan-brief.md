# Auth views in Nightfall — Plan Brief

> Full plan: `context/changes/ui-auth/plan.md`
> Research: `context/changes/ui-auth/research.md`

## What & Why

The `/10x-ui` pass on sign-in and sign-up, one of the four that close S-10 (#86). The auth pages are the last screens still drawn as the pre-Nightfall boxed card, so a visitor arriving from the landing page meets a template look instead of Sidereus's sky.

## Starting Point

The forms already read the shared field contract (`FormField`, `SubmitButton`, `ServerError`). The shell and pages around them use a `rounded-2xl` card, a stock `text-3xl` heading, ink-coloured switch links, a bare muted "continue" line, a 16 px eye button and colour emoji on confirm-email.

## Desired End State

Sign-in and sign-up open with the sky header (Topbar plus `PageHeader` with a subtitle), the form unboxed in a narrow column, a ruled switch line with a contract link, an info `Notice` when `?next=` is present, and a 44 px eye button with token focus. Confirm-email follows with a token-coloured icon.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Composition | GearShell's sky header + unboxed `max-w-md` column | Matches `/gear` and drops the card recipe the frame named as the template tell | Research (C1) |
| Switch links | `buttonVariants({ variant: "link" })` | The contract's link look: link colour, 44 px target, `--ring` focus | Research (C2) |
| Continue note | `Notice tone="info"` | The contract's status message, announced once | Research (C3) |
| Eye button | 44 px flush-right, inset focus outline | Phone target and visible focus without editing `FormField` | Research (C4) |
| Confirm-email emoji | lucide icons in token colours | Emoji keep their colour in red mode | Research (C5) |
| Signed-in visitors, sign-up `next` | Deferred | Behaviour changes, outside a visual pass | Research (D1, D2) |
| New tests | None | Screenshots show the change; user asked for modest tests | Plan (delegated) |

## Scope

**In scope:** `AuthShell`, the three auth pages, `PasswordToggle`, the sign-up hint, two subtitle keys per locale, one CLAUDE.md line.

**Out of scope:** auth behaviour, new tokens or shared components, Topbar/TabBar/FormField edits, screenshot baselines.

## Architecture / Approach

Environment and token phases are N/A (contract in place, no missing token). Phase 1 recomposes the shell and pages; Phase 2 fixes the controls and runs the state gate.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shell and pages | Sky header, unboxed column, links, notice, icon | Polish title wrapping at 390 px |
| 2. Controls, states, gate | Eye button, hint size, matrix, e2e, smoke, rule | e2e selectors on the auth forms |

**Prerequisites:** local Supabase (shared, running), preview on 4322, fixture on 4401.
**Estimated effort:** one session.

## Open Risks & Assumptions

- Parallel passes may touch `en.ts` / `pl.ts`; new keys go at the end of the auth blocks to keep merges clean.

## Success Criteria (Summary)

- A screenshot of sign-in or sign-up in any theme reads as Sidereus (Nightfall), not as a template card.
- Every control has visible token focus and a 44 px target; red mode shows no colour outside the red channel.
