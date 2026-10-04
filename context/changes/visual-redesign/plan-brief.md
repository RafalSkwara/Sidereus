# Visual redesign (Nightfall contract + `/gear`): Plan Brief

> Full plan: `context/changes/visual-redesign/plan.md`
> Frame brief: `context/changes/visual-redesign/frame.md`
> Research: `context/changes/visual-redesign/research.md`

## What & Why

> **The actual problem to plan around is**: Sidereus has no designed visual system, only a colour-token layer over screens that were never composed. Every view repeats one hand-copied card recipe with stock type roles, so any palette reads as a template.

This change builds the Nightfall design-system contract (fonts, values, sky, type roles, shared components) and proves it on one view, `/gear`.

## Starting Point

- **Tokens:** colour only. Three fonts (Newsreader, Public Sans, Plex Mono), no type or sky tokens, and cards on `rounded-2xl` outside the radius token.
- **Components:** `src/components/ui/` holds only `button.tsx`. Cards, headers, link-buttons and selects are copied class strings.
- **`/gear`:** three identical boxes, each with its own primary button. Saves are silent and delete uses `window.confirm`.

## Desired End State

**`/gear`:**

- It opens with a short sky header: a night-to-horizon gradient holding the nav and the title.
- Gear sits in full-width ruled bands, in Archivo, with explanatory empty states and at most one primary action.
- Saves and deletes confirm with a notice. Delete asks in a token-styled dialog, so red mode never flashes white.

**Everywhere else:** Nightfall colour and type, with the old layout until each view's own pass.

**Guards:** `npm test` fails on a contrast regression in any theme, `/design` is the kitchen sink, and the agent rules name the contract.

## Key Decisions Made

| Decision        | Choice                                                                       | Why (1 sentence)                                                                             | Source            |
| --------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------- |
| Problem framing | A missing visual system, not just a palette                                  | The user named colours, type and sameness of blocks, and the code has one copied card recipe | Frame             |
| Direction       | C · Nightfall                                                                | The user's pick from three canvases                                                          | User (frame step) |
| Fonts           | Archivo only (width axis); Newsreader, Public Sans and Plex Mono dropped     | One family carries display and body; mono labels read as a template tell                     | Plan (user)       |
| First view      | `/gear` hub + new/edit pages                                                 | Most representative stable view; Tonight belongs to S-11                                     | Research          |
| Rollout         | Merge per view; other pages keep cards in Nightfall colours until their pass | Small PRs; S-11 starts on the new contract                                                   | Plan (user)       |
| Sky reach       | Short sky header on every restyled page                                      | One recognisable identity on every screen                                                    | Plan (user)       |
| Token names     | `--zenith` / `--horizon`, not `sky-*`                                        | The colour guard's regex treats `sky` as a palette class                                     | Plan              |
| Confirm dialog  | Native `<dialog>` from tokens, shared by gear and log                        | The OS dialog can't be themed and breaks red mode                                            | Research (C4)     |
| Contrast        | New pure test for all three themes                                           | AA was manual-only; the planned red floors never shipped                                     | Research          |
| Save feedback   | `?saved=` / `?deleted=` with a fixed kind, notice from i18n keys             | Keeps the "no free text in URLs" rule                                                        | Plan              |

## Scope

**In scope:**

- Fonts, token values, the sky tokens, type roles and the radius scale.
- The contrast test.
- Components: Button variants, `PageHeader`, `Band`, `BackLink`, `Notice`, `Input`, `Label`, `NativeSelect`, the `FormField` restyle and the delete dialog.
- The sky header in `GearShell`, plus Topbar and TabBar.
- The `/gear` hub and its new/edit pages, with save/delete notices.
- `/design` as the kitchen sink, the screenshot gate and the agent rule.

**Out of scope:**

- Tonight's layout and the interactive sky (S-11).
- The landing rework and its signed-in redirect (own change).
- Composition passes for log, sky checks, auth and onboarding.
- A mechanical sweep of other pages' cards.
- A sky that follows the hour.
- Screenshot baselines.

## Architecture / Approach

The phase order is `/10x-ui`'s: environment → token values → shared components → one view → states.

- **Values on existing names.** Nightfall values go on the existing role names in `global.css`, so shadcn components and every view keep working.
- **Fonts without call-site edits.** `font-display` and `font-mono` are re-pointed through Tailwind v4 font sub-properties (`wdth 125`, `tnum`), so no call site changes.
- **Sky header is opt-in.** `GearShell` renders it only when a page fills its `header` slot, so the other 12 pages using the shell keep their layout.

## Phases at a Glance

| Phase                                   | What it delivers                                                                    | Key risk                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Fonts and component library          | Archivo everywhere; `label` and `native-select` primitives                          | Variation settings not applied, so headings render at normal width |
| 2. Nightfall token values               | Three themes on Nightfall values; zenith/horizon; type roles; radius; contrast test | Contrast floors force value tweaks away from the canvas            |
| 3. Shared components and the sky header | The components the charges name; restyled shell and nav; delete dialog              | 4 e2e deletes and the nav's view transitions regress               |
| 4. The `/gear` view                     | Banded hub, empty states, notices, new/edit pages                                   | e2e selectors and URL expectations; Polish overflow at 390 px      |
| 5. States, gate and rule                | Kitchen sink, screenshot matrix, agent rule                                         | Red pixel audit failing on the dialog backdrop                     |

**Prerequisites:** local Supabase plus the forecast fixture for e2e (handoff recipe); the canvas for reference values.
**Estimated effort:** about 3–4 sessions across 5 phases.

## Open Risks & Assumptions

- **Mixed look in production:** other views show Nightfall colours on old cards until their passes. The user accepted this.
- **Contrast floors may move the canvas values.** The test wins, and changes are recorded in `tokens-nightfall.md`.
- **`native-select` may be missing from the shadcn registry.** The fallback is a local `cva` wrapper in `ui/`.

## Success Criteria (Summary)

- A screenshot of `/gear` in any theme reads as Sidereus (Nightfall), not as a template, and the user approves the matrix.
- New gear views can be built from `ui/` components and token roles alone. The rule and the contrast test keep it that way.
- Red mode keeps zero green and blue, including the new dialog.
