---
date: 2026-10-05T12:00:00+02:00
researcher: Claude (ui-log agent)
git_commit: d834703
branch: feat/ui-log
repository: sidereus
topic: "/10x-ui audit of the log views (/log, /log/new, /log/[id], /log/sky)"
tags: [research, ui, nightfall, log, sky-checks, observations]
status: complete
last_updated: 2026-10-05
last_updated_by: Claude (ui-log agent)
---

# Research: /10x-ui audit of the log views

**Date**: 2026-10-05
**Git Commit**: d834703 (origin/main at branch time)
**Branch**: feat/ui-log
**Repository**: sidereus

## Research Question

Audit the four log views against the Nightfall contract (`src/styles/global.css`, `src/components/ui/`, `src/components/forms/`, CLAUDE.md "UI (Nightfall)"), in both directions, and write 3–5 charges with file:line and user impact. Reference views: `/gear` (`src/pages/gear/index.astro`, `src/pages/gear/sites/[id].astro`) and `/tonight`.

Inspected scope (read in full): `src/pages/log/{index,new,[id],sky}.astro`, `src/components/observations/{ObservationForm,TargetPicker}.tsx`, `src/components/sky-checks/{SkyTally,SkyAnswerForm}.astro`, `src/components/gear/{GearShell.astro,DeleteButton.tsx,DatabaseMissing.astro}`, every file in `src/components/ui/` and `src/components/forms/`, `src/styles/global.css`, the `log` and `skyChecks` namespaces in `src/i18n/messages/en.ts:852-949`, and the e2e specs `observation-log*.spec.ts`, `sky-checks.spec.ts`. Single-area scope, so no sub-agents were dispatched.

## Summary

The log views read the Nightfall **colour** tokens (0 literal colours in the 8 inspected files) but none of the Nightfall **composition**: none of the 4 pages fills GearShell's `header` slot or uses `PageHeader` or `Band`; 11 boxed `rounded-2xl` cards stand where `/gear` uses ruled bands; 3 files re-declare a `primaryLink` string instead of `buttonVariants`; the observation form builds its own select, label, field error and 3 px focus ring instead of `NativeSelect` / `Label` / `FieldError` / `fieldClass`. Two entry paths (a stale `/log/new?object=` link, a deleted entry) end in dead or boxed states. Five charges follow.

## Charges

### C1 · Accidental architecture: the log pages skip the Nightfall shell (no sky header, hand-built titles and back links)

- **Evidence**
  - None of `src/pages/log/{index,new,[id],sky}.astro` passes a `header` slot to `GearShell`, so the zenith-to-horizon sky header (`GearShell.astro:27-35`) never renders; `/gear` does (`gear/index.astro:107`, `gear/sites/[id].astro:33-38`).
  - Hand-built `<h1>`s at three different sizes instead of `PageHeader` (`text-display`): `log/index.astro:67` and `log/sky.astro:82` (`text-4xl sm:text-5xl`), `log/new.astro:77` and `log/[id].astro:64` (`text-3xl sm:text-4xl`), `log/[id].astro:103` (`text-3xl`).
  - Uppercase kicker with an arbitrary tracking, which `PageHeader.astro:3-4` rules out ("No uppercase kicker"): `log/new.astro:76`, `log/[id].astro:63`.
  - Hand-built back links instead of `BackLink`: `log/[id].astro:54-56` (`text-sm`, `inline-block`, no focus style) and `log/sky.astro:77-81`; both print the arrow inside the copy (`log.backToLog: "← Log"`, `en.ts:871`). `/log/new` already uses `BackLink` (`log/new.astro:75`).
- **User impact**: going from Gear or Tonight to the Log feels like a different app (no sky, a different title size and an extra all-caps label), and the edit and sky-check back links are a 20 px text line without a visible keyboard focus, hard to hit on a phone.

### C2 · Missing shared component: link-buttons, list rows and the pager are local class strings

- **Evidence**
  - `primaryLink` re-declared in `log/index.astro:53-54`, `log/new.astro:70-71`, `log/sky.astro:60-61` (it is `buttonVariants({variant:"default"})` minus the 44 px `min-h-11`, the focus outline and the `/85` hover); an inline outline link-button twice in `log/index.astro:72-75` and `:106-109`.
  - Two primary actions on the empty log: "Add entry" in the title row (`log/index.astro:76`) and "Go to Tonight" in the empty card (`:104`), against "at most one primary action per screen" (CLAUDE.md, Nightfall composition). The empty card repeats "Add entry" (`:106-110`).
  - The entry row link (`log/index.astro:128-131`) has no `focus-visible` outline and no `min-h-11`; `/gear` defines both in `rowLink` (`gear/index.astro:95-96`).
  - The pager (`pageLink` plus the newer/older `<nav>`) is copied between `log/index.astro:55-56,164-180` and `log/sky.astro:62-63,162-178`, with no focus style.
- **User impact**: the log's buttons are 36 px tall (`py-2` + `text-sm`) where every other screen's are 44 px, keyboard focus on rows, buttons and page links is the faint default outline, and the empty log offers two equally loud buttons, so the beginner is not told which way to go.

### C3 · Missing shared component: the observation form re-implements the field primitives

- **Evidence**
  - Own `selectBase` (`ObservationForm.tsx:69-70`, `py-2`, `focus-visible:ring-[3px]`) and `fieldBorder` (`:86-90`) instead of `NativeSelect` / `fieldClass` (`ui/native-select.tsx`, `ui/input.tsx:9-15`); own `<label>`s (`:182`, `:205`) and legend (`:232`) instead of `Label` (`text-label`).
  - Own `FieldError` (`ObservationForm.tsx:78-85`, `text-xs`, no icon) shadowing the shared one (`forms/FormField.tsx:27-35`); the site and telescope errors render without an id and the selects have no `aria-describedby` (`:193`, `:202`, `:216`, `:227`).
  - `TargetPicker.tsx:23-24` has its own `inputBase` with `ring-[3px]`, its own label (`:90`) and error line (`:183-186`, `text-xs`, 12 px icon).
  - Rating radios focus through `has-[:focus-visible]:ring-[3px]` (`ObservationForm.tsx:75`); hints and the rating scale labels are `text-xs` (`:177`, `:252`, `:259`).
- **User impact**: the log form's fields are 40 px tall with a different, translucent focus ring and a smaller red error line than the gear forms next to it; a screen-reader user who submits without a site or telescope hears no error tied to that select.

### C4 · Missing tokens (composition): boxed cards, raw type sizes and a hand-built notice

- **Evidence**
  - 11 `rounded-2xl border bg-surface` cards across the views (`log/index.astro:94,101,119`, `log/new.astro:91,100`, `log/[id].astro:69,102`, `log/sky.astro:95,102,112`, `SkyTally.astro:21`); Nightfall puts content in ruled `Band`s (`ui/Band.astro`).
  - 56 raw type sizes (`text-xs` … `text-5xl`) in the 8 inspected files where the roles `text-display` / `text-title` / `text-label` / `text-body` apply, e.g. night headings `text-xl` (`log/index.astro:120`), tally `text-3xl` and an uppercase `tracking-[0.18em]` sub-heading (`SkyTally.astro:44`).
  - The sky-check "saved" message is a hand-built status box (`log/sky.astro:66-75`) duplicating `Notice tone="success"`, which `/log` already uses (`log/index.astro:60-64`) and which handles the screen-reader announcement (`ui/Notice.astro:42-63`).
- **User impact**: every night, the tally and the form sit in their own box, so the page reads as a stack of equal cards instead of one log with a hierarchy, and the sky-check confirmation looks and announces differently from every other saved message.

### C5 · Accidental architecture: dead ends on the direct-link and not-found paths

- **Evidence**
  - `/log/new` with no or an unknown `?object=` and no `from=log` (a stale or edited link) renders the title "Observation log" (`log/new.astro:68`) and one sentence, "Sidereus doesn't know that object." (`:84-85`); the only way on is the back link to Tonight. The manual entry (`/log/new?from=log`) exists but is not offered.
  - `/log/[id]` for a missing entry (404, `log/[id].astro:39-41`) draws a second, boxed `<h1>` inside the content (`:101-108`) under a shell with no header; `/gear/sites/[id]` shows the not-found state as a band under its page header (`gear/sites/[id].astro:72-76`).
- **User impact**: someone arriving from an old link to log an object Sidereus can't find is stuck instead of being offered to pick the object by hand, and a deleted entry's page looks unlike the rest of the app's not-found pages.

## Detailed Findings (source → views)

- Token reads: every colour class in the 8 files is a token (`text-heading`, `bg-surface`, `text-primary-strong`, `bg-go`, …); `no-hardcoded-colors.test.ts` already holds this. The gap is the non-colour roles and components.
- Imports from `src/components/ui/` and `src/components/forms/`: `log/index.astro` (ServerError, Notice), `log/new.astro` (ServerError, BackLink), `log/[id].astro` (ServerError), `log/sky.astro` (ServerError), `ObservationForm.tsx` (FormField, ServerError, SubmitButton), `TargetPicker.tsx` (none), `SkyAnswerForm.astro` (buttonVariants), `SkyTally.astro` (none).
- Already on contract and kept: `SubmitButton` (pending/disabled), `DeleteButton` (token dialog), `FormField` for the date, `SkyAnswerForm` (buttonVariants + `aria-pressed` selected fill), the `TargetPicker` combobox behaviour.
- `SkyAnswerForm.astro` is shared with Tonight's `SkyCheckCard`; it is already on contract, so this change leaves it untouched (avoids a cross-area edit).

## 7-state applicability (input to the plan)

- default, hover, focus-visible: every link-button, row, pager link, field and rating radio.
- disabled: `SubmitButton` / delete dialog while pending (already shared).
- error: field errors (client), `ServerError` (server `?error=` and load errors).
- empty: `/log` with no entries, `/log?page=99`, `/log/sky` with no nights, `/log/sky?page=99`, the tally with no answers.
- loading: SSR pages, so no data loading; the form's pending submit is the loading cell. The picker's list has no async load (N/A).
- long content: Polish copy at 390 px, long object/site names (`break-words`).

## Historical Context (from prior changes)

- `context/changes/visual-redesign/research.md:118-120` already listed the `primaryLink` / `pageLink` / row-link duplicates in the log files (supported: still present at the lines above).
- `context/changes/visual-redesign/research.md:281` and `plan.md:55-57` deferred the `/log` and `/log/sky` composition to their own `/10x-ui` pass, moving only `/log`'s notice to `Notice` (supported: `log/index.astro:60-64`).

## Open Questions

None blocking. Visual choices (band headings, where the intro sentence goes, the tally's size) are decided in the plan and listed for review in the PR.
