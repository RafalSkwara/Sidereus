---
date: 2026-10-04T10:19:24+02:00
researcher: Claude (Opus 5.5)
git_commit: 32be1023a47bbf4442ed5c3292ec0d7dab9b676b
branch: feat/visual-redesign
repository: sidereus
topic: "What design-system contract does Sidereus have today, how do the views use it, and what constrains a redesign (S-10, #86)?"
tags: [research, ui, design-tokens, themes, typography, components, visual-redesign]
status: complete
last_updated: 2026-10-04
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Added ## Charges: the /10x-ui audit of /gear against the chosen Nightfall direction"
---

# Research: the current design-system contract and what constrains the redesign

**Date**: 2026-10-04T10:19:24+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 32be102 (branch `feat/visual-redesign`, stacked on `docs/roadmap-redesign-dashboard`, PR #88 open)
**Branch**: feat/visual-redesign
**Repository**: sidereus

## Research Question

For S-10 `visual-redesign` (GitHub #86, roadmap MS-10): the light and dark themes look "very generic and … very much like coming from an LLM". Before design directions are presented and `/10x-ui` runs, establish:

1. What the design-system contract is today (tokens, type, radii, elevation, spacing, fonts) and what guards it.
2. What the shared component layer is and how consistently views use it.
3. Which views exist, their states, and which is the best first `/10x-ui` pass.
4. Which past decisions are hard requirements and which were incidental.
5. What screenshot tooling exists for the gate.

## Summary

- **The contract is colour-only.** `src/styles/global.css` defines colour tokens for three themes (`:19-49` dark, `:51-79` light, `:86-114` red), derived tokens (`:120-156`) and one `--radius` (`:21`) with a four-step radius scale (`:262-265`). There is no type scale, no spacing scale and no elevation token. Fonts are three self-hosted fontsource families (`:5-7`, `:267-269`).
- **The scale is not used the way it is defined.** The radius scale maps `sm/md/lg/xl` to `--radius` (`global.css:262-265`), but cards use `rounded-2xl` (42 occurrences in `src/`), which falls back to Tailwind's default `1rem` (`node_modules/tailwindcss/theme.css:402`) and ignores `--radius`. Type sizes are default Tailwind steps plus arbitrary values (`text-[15px]` ×20, `text-[22px]` ×8, `tracking-[0.18em]` ×18).
- **The shared component layer is thin.** `src/components/ui/` has one component (shadcn `button.tsx`), imported by 4 files. The real shared pieces are `forms/FormField.tsx` (7 forms), `forms/SubmitButton.tsx` (6), `forms/ServerError.tsx` (18 files). Cards, page headings, kicker labels, link-buttons, selects, labels and chips have no component: the card string `rounded-2xl border border-border bg-surface p-…` appears 39 times in 24 files, the kicker string 19 times, and a `primaryLink` constant is redefined in 5 files.
- **That duplication is what makes it look generic.** The look is the same thin-bordered rounded card with an amber kicker and a serif h1 on every screen, with no elevation (shadows only on the settings popover and a dropdown). Changing the look today means editing ~40 call sites, which is why the contract has to come first.
- **The `/design` reference page has drifted from the live app.** Its inputs and buttons are `h-11 rounded-[10px] text-[15px]` (`src/pages/design.astro:97`), while the live `FormField` uses `rounded-lg px-3 py-2` (`src/components/forms/FormField.tsx:5-6`).
- **Hard constraints** (requirements, kept by any direction): dark is the default (PRD NFR, `prd.md:387-388`), red mode has zero green and blue (FR-024, `red-theme.test.ts:63`) and needs a red value for every `:root` token (`:72`), dark/light switch and EN/PL (FR-025/026), colours only from tokens (`no-hardcoded-colors.test.ts`), theme rendered server-side from a cookie, `dark:` keyed to `data-theme` (`global.css:10`), fonts self-hosted (offline and privacy, `ui-foundation/plan-brief.md:36`).
- **The current direction was chosen for convenience, not on merit.** "A · Observatory" was picked because it was "closest to what's built, so the retrofit is mechanical" (`context/archive/2026-09-26-ui-foundation/plan-brief.md:31`). Navy and amber, Newsreader and Public Sans are all incidental and can be replaced.
- **First `/10x-ui` pass: `/gear`** (hub plus the three new/edit forms). It exercises GearShell, Topbar, TabBar, section cards, list rows, the primary link-button, FormField, SubmitButton, ServerError, native selects and DeleteButton, has nearly the full state matrix, is not part of the Tonight split, and is reachable with the existing e2e helpers.
- **The screenshot gate needs a small harness.** Playwright has one Desktop Chrome project (`playwright.config.ts:15`), no visual assertions, and no theme/locale/viewport helper. The only screenshot spec is a capture tool for the landing image (`tests/e2e/landing-screenshot.spec.ts:38-81`).

## Detailed Findings

### 1. Tokens and what guards them

- **Colour tokens**, three blocks in `src/styles/global.css`:
  - dark (default `:root`, `:19-49`): background `#0b1020`, surface `#141b30`, border `#27304a`, heading `#fbf2dc`, primary amber `#f2c36b`, go/marginal/no-go `#6fd3a8`/`#f2c36b`/`#f28b8b`
  - light (`:51-79`): paper `#f7f3ea`, surface `#fffdf7`, primary `#8f540a`
  - red (`:86-114`): zero green and blue in every literal
- **Moon disc tokens** (`:44-48`): the same in light and dark, by user choice (`:74`).
- **Derived tokens** (`:120-156`) recompute per theme scope:
  - shadcn names (`--card`, `--accent`, `--ring`, …)
  - verdict surface and border tints via `color-mix` with `--verdict-*-alpha` (`:144-149`)
  - `--selected` is amber on navy and ink on paper (`:141-142`, `:152-154`)
- **Non-colour tokens:**
  - `--radius: 0.625rem` (`:21`), with a scale (`:262-265`) that covers only `sm`, `md`, `lg` and `xl`
  - fonts (`:267-269`)
  - there is no type, spacing, elevation or motion token. Motion lives as literal values in the view-transition rules (`:229-259`).
- **Red mode beyond tokens** (`:166-206`): the image filter `url(#red-only)`, hidden native picker and spin icons, selection, scrollbar and autofill. A redesign keeps these.
- **Guards:**
  - `src/styles/no-hardcoded-colors.test.ts`: fails on Tailwind palette classes, hex and `rgb()` in any `.astro/.tsx/.ts/.css` under `src/` except `global.css` and `database.types.ts`.
  - `src/styles/red-theme.test.ts` has two tests:
    - zero green and blue in red blocks (`:63`)
    - every `:root` token has a red value (`:72`)
  - The red test skips non-colour `:root` tokens through `NON_COLOUR_TOKENS = {"--radius"}`. Any new non-colour token placed on `:root` (spacing, type, shadow sizes) must either be added to that set or live in `@theme`. Otherwise the test demands a red value for it.
- **No automated contrast check exists in any theme.** The red-night-mode plan specified contrast floors in the red test (`context/archive/2026-09-28-red-night-mode/plan.md:90`, `:202`), but the shipped test contains only the two cases above. A search for "contrast" in `src/**/*.ts` and `tests/**/*.ts` found nothing. AA for light and dark has so far rested on manual checks (`ui-foundation/plan.md:303`).
- **Global focus:** `* { @apply border-border outline-ring/50 }` (`:316-318`) with `--ring: var(--primary)` (`:135`). Per the components worker, 42 `focus-visible` usages exist in `src/`.

### 2. Typography

- Three families, self-hosted:
  - `@fontsource-variable/newsreader` (opsz axis)
  - `@fontsource-variable/public-sans`
  - `@fontsource/ibm-plex-mono` 500
- They are imported in `global.css:5-7` (`package.json:28-30`). Subsets come from fontsource `unicode-range`; latin-ext covers Polish. All use `font-display: swap`. No font preload in `src/layouts/Layout.astro`.
- Usage counts across `src/` (grep):

  | Class          | Count |
  | -------------- | ----- |
  | `font-display` | 62    |
  | `font-mono`    | 27    |
  | `text-sm`      | 152   |
  | `text-xs`      | 55    |
  | `text-2xl`     | 18    |
  | `text-3xl`     | 18    |
  | `text-4xl`     | 17    |
  | `text-5xl`     | 9     |

- Arbitrary sizes: `text-[15px]` 20, `text-[22px]` 8, `text-[13px]` 3, `text-[42px]` 2, `text-[32px]` 2. Most of the arbitrary sizes sit in `design.astro` and `TopbarControls.tsx`.
- Headings are copy-pasted strings, not components:
  - page h1: `font-display text-4xl font-semibold text-heading sm:text-5xl`, about 8 copies, e.g. `src/pages/gear/index.astro:86`, `src/pages/log/index.astro:71`
  - section h2: `font-display text-2xl font-semibold text-heading`, about 15 copies
  - kicker: `text-xs font-semibold tracking-[0.18em] text-primary uppercase`, 19 copies, e.g. `src/pages/gear/index.astro:85`

### 3. Shared components and duplication

- **`src/components/ui/`:** only `button.tsx`, stock shadcn new-york.
  - Default look: `rounded-md`, `h-9`, `shadow-xs`.
  - Imported by `SubmitButton.tsx`, `LocationPicker.tsx:158`, `OnboardingWizard.tsx:574/663/694` and `design.astro`.
  - SubmitButton overrides it to `rounded-lg font-semibold w-full`, so the Button's own look rarely shows.
  - It is React-only, so Astro pages cannot use it. That is why they hand-roll link-buttons.
- **Form helpers** (`src/components/forms/`):
  - `FormField.tsx`: input `w-full rounded-lg border bg-surface px-3 py-2` (`:5-6`), invalid state (`:68-79`); used by 7 forms.
  - `SubmitButton.tsx`: pending spinner and disabled state (`:12-20`); used by 6 forms.
  - `ServerError.tsx`: used by 18 files.
- **Shells:**
  - `src/components/gear/GearShell.astro:15-25` is the app-wide shell for 13 pages. Its main is `max-w-3xl`.
  - `src/components/AuthShell.astro:16-30` puts a centred `max-w-sm` card around the auth forms.
  - `src/components/Welcome.astro` is the landing page's own shell.
  - `Topbar.astro` is one 64 px row, with a segmented pill from `md`.
  - `TabBar.astro` is the bottom tabs below `md`, shown signed-in only and hidden on onboarding (`:13`).
  - `TopbarControls.tsx` holds the theme cycle button and the native-popover settings panel.
- **Patterns with no component (worker grep; counts are literal-order matches, so variants may be under-counted):**
  - **Card surface:** 39 copies in 24 files, e.g. `src/pages/gear/index.astro:94/132/167`, `src/components/tonight/MoonCard.astro:24`, `src/components/AuthShell.astro:22`. A second tier uses `rounded-xl` (8 uses), e.g. `ObjectRow.astro:20`, `OnboardingWizard.tsx:78`.
  - **`primaryLink` constant:** redefined identically in 5 files: `TonightContent.astro:95`, `gear/index.astro:80`, `log/sky.astro:60`, `log/index.astro:53`, `log/new.astro:57`. `Welcome.astro:27-30` has its own `primaryCta` and `secondaryCta`.
  - **`pageLink`:** duplicated at `log/sky.astro:62` and `log/index.astro:55`.
  - **List-row links:** `-mx-2 block rounded-lg px-2 py-3 hover:bg-accent` at `gear/index.astro:114/152/187` and `log/index.astro:134`.
  - **Raw buttons:** 13 `<button>` elements in 9 files bypass `Button`, e.g. `gear/DeleteButton.tsx:21-24`, `sky-checks/SkyAnswerForm.astro:23`, `tonight/GearSelector.astro:74`.
  - **Pills and chips:** `GearSelector.astro:25`, `Welcome.astro:55`.
  - **Selects:** `selectBase` is copied 4 times: `EyepieceForm.tsx:32`, `SiteForm.tsx:41`, `ObservationForm.tsx:59`, `OnboardingWizard.tsx:71`.
  - **Inputs:** `inputBase` is copied 3 times, with heights that differ (`py-2` vs `h-11`).
  - **Labels:** the label string is copied 10 times outside FormField.
- **Radius vocabulary in use:** `rounded-lg` 43, `rounded-2xl` 42, `rounded-full` 37, `rounded` 32, `rounded-xl` 8, `rounded-md` 4, plus arbitrary `rounded-[10px]` and `rounded-[14px]` in `design.astro`.
- **Elevation:**
  - `shadow-2xl` on the settings panel (`TopbarControls.tsx:35`)
  - `shadow-lg` on the target picker dropdown (`TargetPicker.tsx:141`)
  - `shadow-xs` inside `button.tsx`
  - Everything else relies on 1 px borders.

### 4. Views, states, first pass

Routes (`src/pages/`, excluding `api/`); gated paths are listed in `src/lib/protected-routes.ts:5-14`:

| View                                        | Gate                                         | Shell                     | First-pass fit                                                                             |
| ------------------------------------------- | -------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| `/` landing                                 | public                                       | Welcome                   | one-off layout; embeds `public/landing/tonight.png`, which goes stale once Tonight changes |
| `/auth/{signin,signup,confirm-email}`       | public                                       | AuthShell                 | narrow: forms only                                                                         |
| `/onboarding`                               | gated                                        | GearShell, no TabBar      | 716-line wizard, unique layout                                                             |
| `/gear`, `/gear/*/new`, `/gear/*/[id]`      | gated                                        | GearShell                 | **recommended**, see below                                                                 |
| `/log`, `/log/new`, `/log/[id]`, `/log/sky` | gated                                        | GearShell                 | good second pass; needs seeded observations                                                |
| `/tonight`, `/tonight/all`                  | gated                                        | GearShell + server island | excluded: S-11 splits it                                                                   |
| `/dashboard`                                | gated                                        | none                      | redirects to `/tonight` (`src/pages/dashboard.astro:4`)                                    |
| `/design`                                   | dev only (404 otherwise, `design.astro:8-9`) | Layout                    | the token reference page                                                                   |

`/gear` states, all present in code:

- empty per section: `gear/index.astro:106-107`, `:144-145`, `:179-180`
- load error per section: `:104-105`, `:142-143`, `:177-178`
- `?error=` banner: `:88-90` and in the forms, e.g. `SiteForm.tsx:332`
- not-found 404 card: `gear/*/[id].astro:25-27`, `:64-71`
- field invalid: `FormField.tsx:68-79`
- pending and disabled: `SubmitButton.tsx:12-20`
- long names, wrapped with `break-words` and `break-all`: `gear/index.astro:116`, `:121`
- missing database: `DatabaseMissing`, `gear/index.astro:204`

What `/gear` lacks: a success notice (saves redirect to `/gear` silently) and a loading state (server-rendered).

### 5. Screenshot tooling for the gate

- `playwright.config.ts`:
  - one project, `devices["Desktop Chrome"]` (`:15`)
  - `baseURL` from `BASE_URL` (`:12`)
  - no `webServer`
  - no mobile project
  - no `toHaveScreenshot` settings
- No visual regression baselines anywhere under `tests/`.
- `tests/e2e/landing-screenshot.spec.ts` is the only screenshot spec:
  - opt-in with `CAPTURE_LANDING=1` (`:38`)
  - sets the `sidereus-lang` and `sidereus-theme` cookies (`:43-46`)
  - waits for `document.fonts.ready` (`:79`)
  - writes `public/landing/tonight.png` (`:81`)
- Cookie names: `src/lib/preferences.ts:11-12`.
- Helpers in `tests/e2e/helpers.ts`:
  - `signUp` (`:62-74`, ends on /onboarding)
  - `onboardInMadrid` (`:77-86`, seeds a site, a telescope and the default eyepiece kit)
  - `waitForHydration` (`:36-46`)
  - `seedSkyCheck` (`:94-117`)
- There is no sign-in helper for an existing user, and no theme, locale or viewport helper.
- The handoff's scratch-script pattern for manual screenshots (`createRequire(process.cwd() + "/package.json")` from the repo root) is the practical route. It covers EN/PL × dark/light/red × 390/1280 without adding a spec.

## Charges

> `/10x-ui` audit of **`/gear`** (the hub, its sites/telescopes/eyepieces new and edit pages, `GearShell`, `Topbar`, `TabBar`, `TopbarControls`, the form helpers, `DeleteButton`, and `LocationPicker` inside `SiteForm`), against the chosen direction **C · Nightfall** (canvas https://claude.ai/artifact/8VZbxuqAVU1RntyMQ8u6vu, decision recorded in `change.md`). Added 2026-10-04.

**Pre-audit**, 20 view files:

- **Literal colours:** 0. The colour guard holds.
- **Arbitrary values:** 20 hits from the hardcoded-value scan:
  - `tracking-[0.18em]` (`src/pages/gear/index.astro:85`, `LocationPicker.tsx:172`)
  - `ring-[3px]` (`FormField.tsx:6`, `EyepieceForm.tsx:33`, `SiteForm.tsx:42,244`, `Topbar.astro:41`, `TabBar.astro:37`, `TopbarControls.tsx:19,26`, `LocationPicker.tsx:45,248`)
  - `h-[34px]` (`Topbar.astro:39`)
  - `text-[15px]` (`Topbar.astro:65`, `LocationPicker.tsx:160,234`)
  - `text-[13px]` (`TopbarControls.tsx:23`)
  - `text-[11px] tracking-[0.12em]` (`TopbarControls.tsx:29`)
  - `size-[22px]` (`Topbar.astro:25`)
  - the popover offsets (`TopbarControls.tsx:38`)
- **Component use:** 2 of the 20 files import from `src/components/ui/` (`SubmitButton.tsx`, `LocationPicker.tsx`).
- **Agent rules:** `AGENTS.md` matches `CLAUDE.md`. Its UI rules (`CLAUDE.md:77-81`) cover colours and the shadcn path. No rule invites one-off values, but none covers type, radius, spacing or the shared components either.

### C1 · Missing tokens: type, surfaces and radius are not in the contract (missing tokens)

- **Evidence: the type comes from the old fonts and per-file literals.**
  - The old fonts are imported and named in the theme: `src/styles/global.css:5-7`, `:267-269`.
  - The kicker is a literal: `src/pages/gear/index.astro:85`.
  - The h1 is a literal at a different size on each page: `gear/index.astro:86` (`text-4xl sm:text-5xl`), `gear/sites/new.astro:18` and `gear/sites/[id].astro:41` (`text-3xl sm:text-4xl`), plus the same in the telescope and eyepiece pages.
  - Section h2 strings: `gear/index.astro:96`, `:134`, `:169`.
  - Nav sizes: `Topbar.astro:39`, `:65`; `TopbarControls.tsx:23`, `:29`.
- **Evidence: surfaces and radius have no tier tokens.**
  - Cards use `rounded-2xl` (`gear/index.astro:94`, `:132`, `:167`), which resolves to Tailwind's `1rem` default and not to `--radius` (`global.css:262-265`; `node_modules/tailwindcss/theme.css:402`).
  - No sky, horizon or band surface exists for Nightfall to use.
- **What should cover it:**
  - Archivo as the one family (self-hosted, latin-ext), with type-role utilities: display (expanded), title, band value, label and body.
  - Base colour tokens for the sky: sky top and horizon, in every theme including red.
  - Surface tiers: page ground, band, and inset field.
  - One radius scale that controls actually use.
- **User impact:** every gear screen speaks in the same stock serif headline, amber kicker and rounded box, so nothing on the page tells the user what matters first, and a new look can't be applied in one place.

### C2 · Missing shared components: card, page header, link-button, select, label, list row, back link (missing shared component)

- **Evidence:**
  - Card recipe copied on every page: `gear/index.astro:94`, `:132`, `:167`; `gear/sites/new.astro:20`; `gear/sites/[id].astro:42`, `:69`; the same in the telescope and eyepiece pages; `DatabaseMissing.astro:8`.
  - Page header (kicker + h1): `gear/index.astro:85-86`.
  - `primaryLink`: `gear/index.astro:80-81`, redefined in `log/index.astro:53`, `log/new.astro:57`, `log/sky.astro:60` and `TonightContent.astro:95`. `ui/button.tsx` is React-only, so Astro pages can't use it.
  - List row: `gear/index.astro:114`, `:152`, `:187`.
  - Back link: `gear/sites/new.astro:15`, `gear/sites/[id].astro:32`.
  - Selects and labels:
    - `selectBase`: `SiteForm.tsx:41`, `EyepieceForm.tsx:32`
    - labels: `SiteForm.tsx:255`, `:303`
    - field error line: `SiteForm.tsx:59`
  - Input heights differ: `FormField.tsx:6` (`py-2`) vs `LocationPicker.tsx:45` (`h-11`).
  - `DeleteButton.tsx:21-24` is a raw `<button>` that bypasses `Button`.
- **What should cover it:**
  - Astro components for `Band` (Nightfall's ruled, unboxed section), `PageHeader` and `BackLink`.
  - `buttonVariants` exported from `ui/button.tsx` and used by Astro `<a>`s, which replaces `primaryLink`.
  - `ui/select` and `ui/label` (shadcn path, or thin local wrappers if the native `<select>` must stay for no-JS forms), used by `FormField` and the gear forms.
  - `DeleteButton` built on `Button variant="destructive"`.
- **User impact:** the same control looks and behaves slightly differently from form to form (field heights, corner radii, label weight), and every future screen copies whichever version it finds first.

### C3 · Composition: the hub is three identical boxes with three competing primary buttons (accidental architecture, layout)

- **Evidence:**
  - Three byte-identical sections, each with its own primary "Add" button: `gear/index.astro:94-101`, `:132-139`, `:167-174`.
  - Their empty states are a single muted line each: `:107`, `:145`, `:180`.
  - The order mirrors the build order (sites, telescopes, eyepieces), not what Tonight needs. Tonight needs a site and a telescope; eyepieces have a default kit.
- **What should cover it:** Nightfall bands. Each kind is a full-width ruled band with an unboxed list and a quiet "Add" action. An empty band shows a real empty state that says why it matters ("Tonight needs a site to work out your sky"), and one primary action at most per screen.
- **User impact:** someone arriving with nothing set up sees three same-weight boxes and three same-weight "Add" buttons, with no hint which one Tonight needs first.

### C4 · Feedback and dialogs: silent saves, and a system confirm that breaks red mode (accidental architecture)

- **Evidence:**
  - **Silent saves.** A gear save or delete redirects to `/gear` with no notice. `/gear` has no `role="status"` notice, while `/log` has one (`log/index.astro:60-68`).
  - **System confirm.** Delete asks with `window.confirm` (`DeleteButton.tsx:14`), an OS-drawn dialog the theme can't reach. In red mode it flashes a bright, unstyled box at the eyepiece. `red-night-mode` accepted OS popups as a limit, but this one is ours to replace.
- **Logged-out and direct-link paths are fine:**
  - Logged out: the middleware redirects to sign-in with `?next=`.
  - Another user's id: a 404 card (`gear/sites/[id].astro:25-27`, `:68-75`).
  - Database missing: `DatabaseMissing` renders.
- **What should cover it:**
  - A shared `Notice` component (success/status), reused by `/log`, and a `?saved=` / `?deleted=` notice on `/gear`. Fixed keys only: no names, no coordinates.
  - A token-styled confirm using a native `<dialog>`.
- **User impact:** after saving a site the user lands back on the list with no sign the save worked. In red mode, deleting anything blinds the observer for a moment.

### C5 · Guards: the contract has no rule or check beyond colour (accidental architecture, rules)

- **Evidence:**
  - Agent rules cover colours and the shadcn path only (`CLAUDE.md:77-81`).
  - The `/design` reference has drifted from the live app: `design.astro:97` vs `FormField.tsx:5-6`.
  - No contrast test exists in any theme (research §1). The red-mode floors planned in `red-night-mode/plan.md:90` never shipped.
- **What should cover it:**
  - A UI block in `CLAUDE.md`/`AGENTS.md`: where the tokens and components live, check `src/components/ui/` before writing a control, no arbitrary values in views, and the kitchen sink is `/design`.
  - A pure contrast test over `global.css` for dark, light and red.
  - `/design` rebuilt as the kitchen sink for the 7-state matrix.
- **User impact:** without a check, text that is readable in one theme can become unreadable in another, and the next view drifts back to literals.

**Deferred to other changes:**

- Tonight's composition, which S-11 rebuilds on this contract (the interactive sky lives there).
- The landing page, which gets its own bigger rework (`change.md` decisions).
- `/log`, `/log/sky`, auth and onboarding, which each get a `/10x-ui` pass once the contract exists. Shared components such as `PageHeader` and `buttonVariants` will reach their call sites then, unless the plan migrates them in the same phase.

## Code References

- `src/styles/global.css:19-114`: the three theme blocks (base colour tokens)
- `src/styles/global.css:120-156`: derived tokens, recomputed per theme scope
- `src/styles/global.css:166-206`: red mode beyond tokens (filter, native controls)
- `src/styles/global.css:261-313`: `@theme inline` (radius scale, font families, colour utilities)
- `src/styles/red-theme.test.ts:18`: `NON_COLOUR_TOKENS`, the one place a new non-colour `:root` token must be registered
- `src/styles/red-theme.test.ts:63,72`: the two red-mode guards
- `src/styles/no-hardcoded-colors.test.ts:22-36`: excluded files and colour patterns
- `src/pages/design.astro:8-9,97`: dev-only gate; the reference input that has drifted from the app
- `src/components/ui/button.tsx`: the only `ui/` component
- `src/components/forms/FormField.tsx:5-6,68-79`: the live input look and invalid state
- `src/components/gear/GearShell.astro:15-25`: app-wide shell
- `src/pages/gear/index.astro:80,85-86,94,114`: `primaryLink`, kicker, h1, card and list-row strings typical of every view
- `tests/e2e/helpers.ts:62-86`: sign-up and seed helpers for screenshots
- `tests/e2e/landing-screenshot.spec.ts:38-81`: the capture pattern (cookies, fonts ready, screenshot)

## Architecture Insights

- **Keep from the token architecture:**
  - shadcn token names, with `--primary` as the brand and call-to-action colour and `--accent` as a subtle hover surface (`global.css:16-17`, ui-foundation plan-review F1)
  - derived tokens recomputed per `[data-theme]` scope
  - `dark:` keyed to `data-theme`
  - verdict tints as `color-mix` derivatives
- **What a redesign has to add to the contract:**
  - a type scale (display, title, kicker and body roles as utilities or components)
  - a radius scale that the cards actually use
  - an elevation or surface-layering scale
  - shared components for the patterns above: Card/Panel, PageHeader (kicker + h1), LinkButton for Astro, Select, Label, Chip/Pill, ListRow
- **Astro and React both need the button look.** Most of the app is `.astro`, and `ui/button.tsx` is React-only. Exporting the `cva` variants (`buttonVariants`) for Astro anchors would let one source of truth serve both.
- **Mind the red test when adding tokens.** A non-colour token placed on `:root` trips `red-theme.test.ts` unless it is added to `NON_COLOUR_TOKENS` or declared in `@theme`.
- **The nav slide indicator** uses `--primary` and view-transition names `nav-current` and `tab-current` (`global.css:229-247`). It follows whatever the new brand colour is.

## Historical Context (from prior changes)

- `context/archive/2026-09-26-ui-foundation/plan-brief.md:31`: direction "A · Observatory" was chosen from three on a canvas because it was "closest to what's built, so the retrofit is mechanical". **Supported**: the current look is incidental.
- `ui-foundation/plan-brief.md:32`: light as "warm daylight paper" so it is "clearly the same product in both themes". This was a user choice. The aim (one product across themes) is still worth keeping; the paper look itself is incidental.
- `ui-foundation/plan-brief.md:36`: self-hosting fonts through fontsource was delegated, for privacy and offline use. **Keep**; it also fits the S-06 offline slice.
- `context/archive/2026-09-28-red-night-mode/plan-brief.md:23-25`: strict red over amber tints (user choice). Verdicts differ by brightness only; full AA for muted text is impossible in strict red, so 3:1 was accepted. **Supported** as a requirement.
- `red-night-mode/plan.md:90,202`: contrast floors were to be tested. **Contradicted** by the shipped test, which has no contrast case (see §1).
- `context/archive/2026-09-29-top-nav-redesign/`:
  - one 64 px header row, bottom tabs below `md`, the pill from `md` because Polish needs about 620 px, settings in a native popover
  - gates used then: no horizontal overflow at 360/390/768/1280, header ≤ 64 px (`plan.md:41,200`)
  - **Keep** the structure. Its look (thin-border pill) is in scope.
- `nav-motion-theme-cycle`: the theme button cycles dark → light → red, and an amber indicator slides between nav items (off under reduced motion). **Keep** the behaviour.
- `context/archive/2026-10-02-moonlight-and-the-verdict/follow-ups/review-fixes.md:12-13`: open checks: bright-Moon screenshots after 2026-10-22, and a Firefox red-mode screenshot of the Moon slider. Not blocking here.
- `context/archive/2026-09-26-first-run-onboarding/plan-brief.md:82`: the landing screenshot was expected to go stale. Regenerate it after the redesign (and again after S-11).

## Related Research

- `context/archive/2026-09-26-ui-foundation/`: the previous direction pass (three directions on an artifact canvas, `https://claude.ai/artifact/Rs1rsxtMzcwkJseQimhyj6`, not read here)
- `context/archive/2026-09-29-top-nav-redesign/`: the nav structure (board `https://claude.ai/artifact/VBMVqSE9846VQhhUjtjKTv`, not read here)

## Open Questions

User decisions (UI), from the roadmap (`roadmap.md:167-169`) and #86:

1. Which direction out of the 2–3 presented.
2. Whether Newsreader and Public Sans stay or are replaced.
3. Whether the landing page gets a bigger rework than the in-app views.

Team decisions, for `/10x-ui` and `/10x-plan` to settle:

4. Whether to add an automated contrast check for all three themes, given that the planned red floors never shipped. It would be cheap, pure and fit the "modest tests" preference.
5. How far the first pass goes beyond `/gear`. Shared components (Card, PageHeader, LinkButton) will reach other views as soon as they exist. The plan should say whether those call sites migrate in the same pass or per view.
