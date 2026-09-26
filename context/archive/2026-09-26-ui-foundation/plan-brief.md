# UI Foundation (F-03) — Plan Brief

> Full plan: `context/changes/ui-foundation/plan.md`
> Design canvas: https://claude.ai/artifact/Rs1rsxtMzcwkJseQimhyj6 (board A · Observatory chosen)

## What & Why

Sidereus's screens were built with no design pass, no theming and English-only copy, and each new slice adds to the rework. PRD v2 adds FR-025 (dark/light theme switch) and FR-026 (English/Polish). This foundation puts every colour on semantic theme tokens and every string on a typed catalogue before S-03's onboarding UI and the remaining slices are built.

## Starting Point

- **Colour:** about 300 hard-coded palette classes across 28 files. No component uses a theme token, and the shadcn `.dark` block is never applied. The auth pages and form controls still use the starter's blue/purple look. There are no web fonts.
- **Copy:** about 210 English literals in templates. Tonight wording is assembled in `src/lib/tonight/format.ts` with a hard-coded `en-GB`. Validation and store messages are English and travel through `?error=`.
- **What's already right:** the engine emits codes only, so localisation stays out of the engine.

## Desired End State

- **Look:** one Observatory look.
  - Dark (default): navy with an amber accent.
  - Light: warm daylight paper.
  - Type: Newsreader for headings, Public Sans for body, IBM Plex Mono for times.
- **Switches:** a moon/sun switch and an EN/PL switch in the top bar on every page, remembered on the device.
- **Language:** first-time visitors get Polish if their browser prefers it, otherwise English.
- **Formatting:** Tonight's dates, times, durations, plurals and compass points read naturally in both languages.
- **Guard:** a test fails the build if a hard-coded colour comes back.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Visual direction | A · Observatory, refined from the current look | Chosen from three directions on the canvas; closest to what's built, so the retrofit is mechanical | User |
| Light theme | Warm daylight paper, amber deepened for contrast | Clearly the same product in both themes | User |
| Switch placement | Top bar on every page, auth pages included | One tap away, even before sign-up; S-10 later joins the same control | User |
| First-visit language | Follow the browser's `Accept-Language`, else English | Polish users land in Polish with no clicks | User |
| Preference storage | Cookies `sidereus-theme` / `sidereus-lang`, resolved in middleware into `locals`, rendered on `<html>` | Server-rendered theme means no flash; FR-025/026 say "remembered on the device" | Plan (delegated) |
| Locale in URL | No; cookie preference only, no Astro i18n routing | Every product route is gated, so there is no SEO need, and URLs stay unchanged | Plan (delegated) |
| Fonts | Self-hosted via `@fontsource` | No third-party requests; works offline | Plan (delegated) |
| Catalogue | Dependency-free typed TS: `en` is the source, `pl` `satisfies Messages`, `Intl.PluralRules` for plurals | Missing translations fail type-checking; two locales don't justify a library | Plan (delegated) |
| `?error=` | Carries message keys, never sentences; Supabase auth errors mapped by code | Keeps the fixed-string privacy rule and makes errors translatable | Plan (delegated) |
| Regression guard | Vitest scan fails on palette classes or colour literals outside `global.css` | Stops the retrofit from eroding | Plan (delegated) |
| Polish copy | Its own last phase (cut-order #5) | Can drop without breaking the English product or the switch | PRD v2 |

## Scope

**In scope:**
- Token set (dark and light)
- Fonts
- Preference resolution
- Top-bar switches
- Dev-only `/design` page
- Retrofitting every screen, including restyling the auth pages and forms
- Guard test
- Typed catalogue
- Locale-aware Tonight formatter
- Keys in schemas, stores and routes
- Polish catalogue and Polish Messier common names
- Updating the CLAUDE.md conventions

**Out of scope:**
- Red night mode (S-10)
- URL locales, per-account preferences, following `prefers-color-scheme`
- Translating user data or constellation abbreviations
- Onboarding UI, the landing strip and retiring `/dashboard` (these stay in S-03 phases 2-4)
- Layout redesigns
- An i18n library

## Architecture / Approach

1. `src/lib/preferences.ts` (pure) resolves theme and locale from cookies and `Accept-Language`.
2. The middleware stores the result in `locals`.
3. `Layout` writes `<html lang data-theme>`.
4. CSS variables in `global.css` switch on `[data-theme]` and are exposed to Tailwind via `@theme inline`.
5. `src/i18n` provides `getMessages(locale)`, `plural` and `translateKey`.
6. Pages pass `locale` to islands, and `createFormatter(locale)` produces Tonight's strings from engine codes.
7. `PreferenceSwitches.tsx` flips the theme instantly, and writes the language cookie then reloads.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Tokens, fonts, switch | Observatory tokens in both themes, fonts, cookie preferences, switches, `/design` page | Light-theme contrast on amber and muted text |
| 2. Retrofit to tokens | All screens on tokens; auth and forms restyled; top bar everywhere; guard test | Missing a dynamic class string or inline style; the guard test catches literals |
| 3. English catalogue | All copy, validation, stores and `?error=` on keys; locale-aware formatter; English output unchanged | Wide refactor across about 60 files; the existing English tests pin behaviour |
| 4. Polish translation | Complete `pl`, Polish Messier names, Polish formatter tests | Wording quality; needs your review as a native speaker |

**Prerequisites:** S-03 phase 1 on `feat/s-03-p1` (this branch is stacked on it); local Supabase for `test:db` and smoke.
**Estimated effort:** about 3-4 sessions across 4 phases.

## Open Risks & Assumptions

- About 60 files change in phase 3, and the diff will be large. It is split by concern (formatter, validation, templates) inside the phase, and the English tests and smoke tests guard behaviour.
- Supabase auth error codes can change between library versions. Unknown codes fall back to a generic key.
- The existing English expectations in `format.test.ts` are assumed to stay byte-identical after the refactor. Any difference is a regression unless justified in the phase report.

## Success Criteria (Summary)

- The app looks like board A in both themes, and the switch is instant with no flash on reload.
- A Polish-browser visitor gets natural Polish everywhere, including Tonight's explanations. English is unchanged.
- No hard-coded colour or user-visible English literal remains in templates.
