# UI Foundation (F-03) Implementation Plan

## Overview

Roadmap foundation F-03 (PRD v2: FR-025, FR-026; NFR dark by default; NFR attribution).

Every screen gets its colours from semantic theme tokens in the chosen **Direction A · Observatory**:

- Dark (default): navy with an amber accent.
- Light: warm "daylight paper".
- Type: Newsreader for headings, Public Sans for body text, IBM Plex Mono for times and numbers.

Every screen also gets its copy from a typed English/Polish message catalogue, with dates, times and numbers formatted for the locale.

A theme switch (moon/sun) and a language switch (EN/PL) sit in the top bar on every page, including the landing and auth pages. Each choice is remembered on the device in a cookie. Language defaults to the browser's preference, falling back to English.

This lands before S-03 phases 2-4, so the onboarding island, the landing page and every later slice are built on tokens and message keys from the start. Red night mode (S-10) will later be a third token set.

Design reference: canvas https://claude.ai/artifact/Rs1rsxtMzcwkJseQimhyj6, board "A · Observatory", chosen 2026-09-26.

## Current State Analysis

- **No component uses a theme token.**
  - There are about 300 hard-coded palette classes across 28 files (the top ones: `text-amber-50` ×36, `border-white/10` ×22, `bg-white/5` ×20). The only 26 token uses are in `src/components/ui/button.tsx`.
  - `src/styles/global.css:6-111` has the stock shadcn light `:root` and `.dark` blocks, but nothing applies `.dark`. The app looks dark only because each shell paints `bg-cosmic` (`global.css:113-115`) over a white `body`.
- **Two colour families.** The product's amber/slate (Welcome, gear, Tonight), and the starter's leftover blue/purple glass (auth pages, `dashboard.astro`, `FormField.tsx:5-6`, `SubmitButton.tsx:18`). Verdict colours are duplicated in two places, and one of them uses different hues: `VerdictCard.astro:19-34` uses red-400 for no-go, `Welcome.astro:6-10` uses rose-400. `Banner.astro:27-41` uses scoped light hex colours.
- **No web fonts.** `font-serif` falls back to the system serif stack. `public/` has no fonts.
- **No theme or locale code at all.** `<html lang="en">` is hard-coded in `src/layouts/Layout.astro:14`, and every page goes through `Layout`. The middleware (`src/middleware.ts`) already has `context.cookies` and fills `context.locals`.
- **Copy.**
  - The engine emits codes only (`src/lib/engine/types.ts:92-124`, `verdict.ts`, `outlook.ts`).
  - All Tonight wording is assembled in `src/lib/tonight/format.ts` (hard-coded `"en-GB"` at `:34` and `:45`, English compass points `:13-30`, a hand-rolled plural `:140-145`). `src/lib/tonight/build.ts:154-226` pre-renders it into `TonightView` strings.
  - Zod messages in `src/lib/gear/schemas.ts` (and `src/lib/onboarding/schemas.ts`) are English and are shown both in the browser (islands call `safeParse`) and via `?error=`.
  - Store messages (`src/lib/gear/store.ts:50,93-98,191-196,252-257`, `src/lib/onboarding/store.ts:19-21`) are English. `NOT_CONFIGURED` and `CHECK_FIELDS` are duplicated in 9 route files. Auth routes forward Supabase's raw `error.message` (`src/pages/api/auth/signin.ts:16`, `signup.ts:16`).
  - There are about 210 hard-coded strings in `.astro`/`.tsx` files.
  - `src/lib/config-status.ts:15,17` and `Layout.astro:24,29` hold Polish starter strings.
  - 29 of the 110 Messier `commonName`s are English (for example "Crab Nebula").
  - The onboarding presets and scenes from S-03 phase 1 carry stable ids intended as message keys (`src/lib/onboarding/presets.ts`).
- **Tests that assert English text:**
  - `src/lib/tonight/format.test.ts` (about 40 assertions)
  - `src/lib/tonight/build.test.ts` (about 9)
  - `src/lib/onboarding/schemas.test.ts` (3), `presets.test.ts` (2 shape checks)
  - `src/lib/gear/eyepiece-presets.test.ts` (3)
  - `tests/db/onboarding.test.ts:193` (1)
- **Astro 7.3.2 has i18n helpers, but the plan does not need them.** `astro:i18n`, `Astro.preferredLocale` and `i18n.routing: "manual"` exist, but the locale here is a cookie preference with no URL prefix.

## Desired End State

- **Theme tokens and switch:**
  - `src/styles/global.css` defines one semantic token set: dark on `:root` (the default) and light under `[data-theme="light"]`.
  - They are exposed to Tailwind through `@theme inline` (for example `bg-background`, `bg-surface`, `text-heading`, `text-muted-foreground`, `text-primary`, `bg-go`, `text-no-go`) and to fonts through `--font-display/--font-sans/--font-mono`.
  - Nothing under `src/` uses a raw palette class, hex, rgb or rgba colour except `global.css`. A unit test enforces this.
  - Fonts are self-hosted through `@fontsource` packages, so there are no third-party font requests.
  - Theme is set by the `sidereus-theme` cookie (`dark` | `light`, default `dark`). The middleware resolves it into `locals.theme`, and `Layout` renders `<html data-theme lang>` from it, so there is no flash on load. The switch flips the theme instantly on the client and writes the cookie.
- **Language and catalogue:**
  - Language is set by the `sidereus-lang` cookie (`en` | `pl`). Without the cookie, the browser's `Accept-Language` decides (Polish if it prefers Polish, otherwise English).
  - The switch writes the cookie and reloads, because copy is rendered on the server.
  - `src/i18n/` holds a typed catalogue:
    - `en` is the source.
    - `pl` must have exactly the same keys (a type error otherwise, plus a runtime parity test).
    - Plurals go through `Intl.PluralRules`.
    - Every template, island, formatter, validation message, store message and `?error=` value uses message keys.
    - `?error=` carries a key, never a sentence, and never user input.
- **Tonight formatting:** times, dates, durations, numbers and compass points follow the locale (`en-GB` / `pl-PL`), always in the site's time zone.
- **Top bar everywhere:** it appears on every page, auth pages included, with the moon/sun switch and the EN/PL switch as 44 px segmented controls.
- **Restyled screens:** the auth pages and form controls now use the Observatory look, and the starter blue/purple is gone.
- **Reference page:** a dev-only `/design` page shows every token, type style and component state in both themes.

### Key Discoveries:

- The engine already returns codes, so localisation stays in `src/lib/tonight/format.ts` + `build.ts` (`format.ts:89-228`, `build.ts:154-226`). The engine and `night.ts:59` (internal `en-US` wall-clock arithmetic) must **not** change.
- `formatNightDate` uses `timeZone: "UTC"` on purpose (`format.ts:45`), because it formats a calendar date string. Keep that when localising.
- Gear and onboarding zod schemas are imported by islands **and** routes (`SiteForm.tsx:85-100`, `EyepieceForm.tsx:52-66`, `TelescopeForm.tsx:44-53`). Making their messages keys covers both paths at once.
- `store.ts` `loadFailed` texts are never shown; pages substitute their own constants (`tonight.astro:23-26`, `gear/index.astro:15-17`, `gear/*/[id].astro:9`). Unify them on keys.
- `gear/index.astro:56` strips "(~50°)" from the eyepiece preset label with a regex, which breaks once labels are translated. Use separate short and long keys instead.
- `smoke.mjs` checks only the `?error=` prefix, not its text, so moving to keys keeps smoke green (`scripts/smoke.mjs` around `:59`, `:75`).

## What We're NOT Doing

- Red night mode (S-10). The token layer is shaped so it becomes a third `data-theme` value later.
- Locale in the URL (`/pl/...`), Astro i18n routing, or a stored per-account preference. Preferences live on the device only (FR-025/026 "remembered on the device").
- Following `prefers-color-scheme`. Dark is the default by NFR, so light is opt-in.
- Translating user-entered data (site, telescope and eyepiece names) or IAU constellation abbreviations.
- Onboarding UI, the landing "how it works" strip and screenshot, and retiring `/dashboard`: these stay in S-03 phases 2-4, which are amended afterwards to use this foundation. `dashboard.astro` gets tokens only.
- New product features, layout redesigns of existing screens beyond restyling to tokens, or animations.
- A third-party i18n library. The typed catalogue plus `Intl` covers two locales.

## Implementation Approach

1. **Tokens and switch mechanics (Phase 1).** Install the tokens and the switch mechanics first, on a reference page, so the look can be approved in isolation.
2. **Retrofit colours (Phase 2).** Move every screen to tokens in one sweep, guarded by a test so hard-coded colours cannot creep back.
3. **Catalogue infrastructure (Phase 3).** Build the English catalogue and move all copy and formatting onto keys with English output unchanged. This is a refactor that existing tests pin.
4. **Polish (Phase 4).** Add the Polish catalogue. It is last because it is cut-order #5 and the only phase that can drop without breaking anything.

## Critical Implementation Details

**No-flash theming:** the theme must be decided on the server. The middleware reads the cookie and `Layout` writes `data-theme` on `<html>` before anything paints. The client switch only mirrors that (updates the attribute and the cookie). Never render the theme from client-side state or `localStorage`.

**Privacy:** `?error=` values become catalogue keys drawn from a fixed set, and the page translates them. An unknown key falls back to a generic message. Supabase auth errors are mapped by `error.code` to keys and never forwarded as text. Coordinates never enter a key or a message parameter that reaches a URL.

**Locale-fixed internals:** only user-facing formatting takes a locale. `src/lib/engine/night.ts:59` and `src/lib/gear/zones.ts:13` keep their fixed `en-US` formatters, because they do arithmetic and validation, not display.

## Phase 1: Theme tokens, fonts and switch

### Overview

The Observatory token set in both themes, self-hosted fonts, server-resolved theme and locale preferences, the top-bar switches, and a dev-only `/design` reference page. Existing screens keep their current look until Phase 2.

### Changes Required:

#### 1. Token set

**File**: `src/styles/global.css`

**Intent**: Replace the unused stock shadcn palette with the Observatory palette as semantic tokens, dark by default and light under `[data-theme="light"]`, keeping the shadcn token names so `ui/button.tsx` works unchanged.

**Contract**:

- **Dark values, from board A:**
  - `--background #0b1020`, `--surface #141b30`, `--border #27304a`
  - `--foreground #d9deea`, `--muted-foreground #9ba4ba`, `--heading #fbf2dc`
  - `--primary #f2c36b`, `--primary-foreground #1c1403`, `--primary-strong #f6d596` (the brand amber; shadcn's `--primary` is the call-to-action role)
  - `--go #6fd3a8`, `--marginal #f2c36b`, `--no-go #f28b8b`
- **Light values:**
  - `#f7f3ea`, `#fffdf7`, `#e2d9c6`, `#2a3040`, `#5b6273`, `#161b2b`
  - primary `#8f540a` / `#fffaf0`, `--primary-strong #7a4708`
  - `--go #1d7a54`, `--marginal #b87a12`, `--no-go #b3363a`
- **Derived tokens:** shadcn aliases (`--card`, `--muted`, `--input`, `--ring`, `--destructive`, `--popover`, `--secondary`) plus `--faint`, `--warning`, `--success`. `--accent` / `--accent-foreground` keep shadcn's meaning as a _subtle hover surface_ (a lightened `--surface`), never the brand amber, because `button.tsx:16,18` uses `hover:bg-accent` on the outline and ghost buttons.
- **Verdict tints:** built with `color-mix()` from the verdict colours, one per verdict: `--go-surface` and `--go-border`, then the same two for marginal and no-go.
- **Tailwind:** `@theme inline` exposes all of these as `--color-*`, plus `--font-display` (Newsreader), `--font-sans` (Public Sans) and `--font-mono` (IBM Plex Mono).
- **Clean-up:** remove `bg-cosmic` and the `.dark` block; `body` uses `bg-background text-foreground font-sans`.
- **`dark:` variant:** tie it to the theme attribute instead of the OS setting (Tailwind v4's built-in `dark:` follows `prefers-color-scheme`): `@custom-variant dark (&:where(:root:not([data-theme="light"]), :root:not([data-theme="light"]) *));`
- **Star field:** `--star` and `--star-accent` tokens replace the inline rgba values in `Welcome.astro`, and are lower-alpha in light.

#### 2. Fonts

**File**: `package.json`, `src/styles/global.css`

**Intent**: Self-host the three families so there are no third-party font requests and they also render offline.

**Contract**:

- Add `@fontsource-variable/newsreader`, `@fontsource-variable/public-sans` and `@fontsource/ibm-plex-mono` (weight 500).
- Import them from `global.css`.

#### 3. Preferences resolution

**File**: `src/lib/preferences.ts` (new) and `src/lib/preferences.test.ts` (new), `src/middleware.ts`, `src/env.d.ts`

**Intent**: One pure, island-safe module decides theme and locale from cookies and headers, and the middleware stores the result for every request, including when Supabase is not configured.

**Contract**:

- **Constants:** `THEMES = ["dark", "light"] as const`, `LOCALES = ["en", "pl"] as const`, `THEME_COOKIE = "sidereus-theme"`, `LOCALE_COOKIE = "sidereus-lang"`, and a cookie max-age of 1 year.
- **`resolveTheme(cookie?: string): Theme`:** invalid or missing → `"dark"`.
- **`resolveLocale(cookie?: string, acceptLanguage?: string | null): Locale`:** a valid cookie wins; otherwise the first `Accept-Language` range whose primary subtag is `pl` or `en`, by q-value; otherwise `"en"`.
- **Middleware:** sets `locals.theme` and `locals.locale` before the Supabase branch, and appends `Vary: Cookie, Accept-Language` to HTML responses so no cache can serve one visitor's theme or language to another.
- **Types:** `App.Locals` gains `theme` and `locale`.
- **Tests:** invalid cookie, q-value ordering (`en;q=0.5, pl`), `pl-PL`, a wildcard, and an empty header.

#### 4. Layout

**File**: `src/layouts/Layout.astro`

**Intent**: Render the resolved preferences on `<html>` so the first paint is already themed.

**Contract**: `<html lang={locals.locale} data-theme={locals.theme}>`. Everything else in the layout is unchanged in this phase.

#### 5. Top-bar switches

**File**: `src/components/PreferenceSwitches.tsx` (new), `src/components/Topbar.astro`

**Intent**: The moon/sun and EN/PL segmented controls from board A, in the top bar for signed-in and signed-out users alike.

**Contract**:

- **Props:** `{ theme: Theme; locale: Locale; labels: {...} }`. In Phase 1 the labels are English literals passed from `Topbar`; Phase 3 moves them to the catalogue.
- **Controls:** two `role="group"` segments of real `<button type="button" aria-pressed>` elements, each at least 44×40 px. The icons are inline stroke SVGs.
- **Theme click:** sets `document.documentElement.dataset.theme` and writes the cookie (`path=/; max-age=31536000; SameSite=Lax`), with no reload.
- **Language click:** writes the cookie and calls `location.reload()`.
- **Topbar:** mounts it with `client:load` in both branches. The signed-out branch keeps its existing pill until Phase 2.

#### 6. Design reference page

**File**: `src/pages/design.astro` (new)

**Intent**: A dev-only page showing every token swatch, the type scale (display, body, mono), verdict chips and cards, a card, primary/secondary/destructive buttons, form inputs (default, focus, invalid) and a server-error box, used to approve the look in both themes.

**Contract**: returns `404` unless `import.meta.env.DEV`. It is not linked from anywhere and not in `PROTECTED_ROUTES`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including `preferences.test.ts`
- `npm run lint` and `npx astro check` pass
- `npm run build` succeeds and the build output contains no `fonts.googleapis.com` reference

#### Manual Verification:

- On `/design` in `npm run dev`, both themes match board A of the design canvas, and switching theme is instant with no flash on reload
- The EN/PL switch persists across reloads, and a fresh browser profile with Polish as its first language gets `lang="pl"` on `<html>`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Retrofit every screen to tokens

### Overview

Replace every hard-coded colour in `src/` with tokens, restyle the starter-styled auth pages and form controls to Observatory, put the top bar on every page, and add a guard test.

### Changes Required:

#### 1. Shells and shared components

**File**:

- `src/components/gear/GearShell.astro`, `src/components/Welcome.astro`, `src/components/Topbar.astro`
- `src/components/Banner.astro`, `src/components/gear/DatabaseMissing.astro`
- `src/components/forms/{FormField,SubmitButton,ServerError}.tsx`
- `src/components/auth/PasswordToggle.tsx`, `src/components/gear/DeleteButton.tsx`
- `src/components/ui/button.tsx`

**Intent**: Move the shared surfaces onto the colour roles of board A:

- page: `bg-background`
- card: `bg-surface border-border rounded-2xl`
- heading: `font-display text-heading`
- body: `text-foreground`
- muted: `text-muted-foreground`
- kicker: `text-primary tracking-[0.18em] uppercase`
- primary CTA: `bg-primary text-primary-foreground`
- secondary CTA: `border-border text-heading`
- times and numbers: `font-mono`
- errors: `text-destructive` with a tinted surface

**Contract**:

- `SubmitButton` uses the shadcn `Button` default (primary) variant, with no colour overrides. `button.tsx`'s destructive `text-white` becomes `text-destructive-foreground`.
- `Banner.astro`'s scoped hex CSS is replaced with token classes (info/warning/error map to `--accent`, `--warning` and `--destructive` tints).
- Welcome's star field uses `--star` and `--star-accent`.
- The signed-out Topbar branch shows a "Sign in" link instead of the "Not logged in" pill.

#### 2. Auth pages

**File**: `src/pages/auth/{signin,signup,confirm-email}.astro`, `src/components/auth/{SignInForm,SignUpForm}.tsx`, `src/pages/dashboard.astro`

**Intent**: Replace the starter glass cards, blue/purple gradients and purple buttons with an Observatory shell: `Topbar` plus a centred card. That puts the switches on every page.

**Contract**: a new `src/components/AuthShell.astro` wraps `Layout` + `Topbar` + a centred `bg-surface` card with a `font-display text-heading` title. The four pages use it, and none of them keeps a gradient or a purple/blue class.

#### 3. Gear and Tonight

**File**:

- `src/pages/gear/index.astro`, `src/pages/gear/{sites,telescopes,eyepieces}/{new,[id]}.astro`
- `src/components/gear/{SiteForm,TelescopeForm,EyepieceForm}.tsx`
- `src/pages/tonight.astro`
- `src/components/tonight/{VerdictCard,ObjectCard,Attribution}.astro`

**Intent**: Token swap without changing any layout.

**Contract**:

- Verdict colour maps (`VerdictCard.astro:19-34`, `Welcome.astro:6-10`) are unified on the `go` / `marginal` / `no-go` tokens and their surface and border tints, defined once in `src/components/tonight/verdict-tones.ts` (new) and imported by both.
- Selects drop `[&>option]:bg-slate-900` in favour of `bg-surface`.

#### 4. Dead code

**File**: `src/components/ui/LibBadge.astro`

**Intent**: Delete the unused starter component, which is imported nowhere.

**Contract**: the file is removed.

#### 5. Guard test

**File**: `src/styles/no-hardcoded-colors.test.ts` (new)

**Intent**: Keep the retrofit from regressing: fail when any `.astro`/`.tsx`/`.ts` file under `src/` uses a Tailwind palette colour class or a colour literal outside `global.css`.

**Contract**:

- A Vitest test walks `src/` and matches:
  - `/\b(?:text|bg|border|ring|fill|stroke|from|via|to|decoration|placeholder|divide|outline|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d+)?\b/`
  - hex `#[0-9a-fA-F]{3,8}\b`
  - `rgba?\(`
- It excludes `global.css`, `*.test.ts` and `database.types.ts`, and lists each offending `file:line` on failure.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including `no-hardcoded-colors.test.ts` with zero offenders
- `npm run lint` and `npx astro check` pass
- `npm run build` succeeds
- `npm run smoke` passes against a local preview with local Supabase

#### Manual Verification:

- Landing, sign-in, sign-up, confirm-email, `/gear` (list, new and edit forms incl. validation errors) and Tonight (go, no-go, no-darkness and outage states) reviewed in both themes at desktop and phone width, and they match board A
- Text contrast looks readable in the light theme, especially muted text, kickers and verdict chips

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: English catalogue and locale-aware formatting

### Overview

Move all user-facing copy and formatting onto a typed catalogue and a locale-aware formatter while keeping English output unchanged. `pl` is present and complete in type but mirrors English until Phase 4.

### Changes Required:

#### 1. Catalogue core

**File**: `src/i18n/index.ts`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`, `src/i18n/i18n.test.ts` (all new)

**Intent**: A dependency-free, island-safe catalogue in which English is the source of truth and missing Polish keys fail type-checking.

**Contract**:

- `en.ts` exports a nested `as const` object of messages. Parameterised messages are functions of a typed params object, for example `tonight.verdict.clearRun: (p: { duration: string }) => string`.
- `Messages` is derived from `typeof en` with literal strings widened to `string`. `pl.ts` is `satisfies Messages`, and in this phase it spreads `en`.
- `getMessages(locale): Messages`.
- `plural(locale, n, forms: { one: string; few?: string; many?: string; other: string })` uses `Intl.PluralRules`.
- `translateKey(messages, key: string, fallbackKey)` resolves dotted keys that arrive through `?error=`. An unknown key yields the fallback.
- Tests:
  - every leaf key in `en` exists in `pl` with the same kind (string or function)
  - `translateKey` fallback
  - `plural` for `en` (1 / 2) and `pl` (1 / 2 / 5 / 22)

#### 2. Locale-aware Tonight formatting

**File**: `src/lib/tonight/format.ts`, `src/lib/tonight/build.ts`, and their tests

**Intent**: Every exported formatter takes the locale and messages, so English and Polish differ only in data. `TonightView` keeps its string shape, so the templates change minimally.

**Contract**:

- `createFormatter(locale: Locale)` returns the existing functions:
  - `formatTime`, `formatNightDate`, `formatDuration`, `formatDirection`
  - `reasonLine`, `verdictReasonText`, `clearedLine`, `formatAge`
  - `forecastStatusText`, `nextNightText`, `noDarknessCauseText`, `darkReturnText`
- Their bodies read from `getMessages(locale)`:
  - Dates use `Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", …)`, keeping `hourCycle: "h23"`, the site `timeZone`, and UTC for calendar dates.
  - Numbers use `Intl.NumberFormat`.
  - Compass points come from `messages.compass` (16 entries).
  - `clearedLine` uses `plural`.
  - `capitalize` is replaced by explicit sentence-case messages.
  - `nextNightText` translates the verdict level instead of interpolating the raw code, using its own lowercase keys `tonight.nextNight.level.{go,marginal}` (not the verdict card's capitalised labels), so the English output stays "— go, …" as `format.test.ts:186` expects.
- `buildTonight(input, locale)`.
- Existing tests call these with `"en"` and keep their English expectations. Changes to expected strings must be justified (none are expected).

#### 3. Messages as keys in validation, stores and routes

**File**:

- `src/lib/gear/schemas.ts`, `src/lib/gear/store.ts`, `src/lib/gear/eyepiece-presets.ts`
- `src/lib/onboarding/{schemas,store,presets,geocode}.ts`
- `src/lib/config-status.ts`
- all routes under `src/pages/api/**`
- `src/lib/api-errors.ts` (new)

**Intent**: Every fixed message becomes a catalogue key, so `?error=` carries keys and islands translate zod issues on both the client and the server path.

**Contract**:

- Zod `message` values and store `message` values are key strings such as `"errors.site.latitudeRange"` and `"errors.save.site"`, with a matching leaf in `en.ts`.
- `api-errors.ts` exports shared `NOT_CONFIGURED` / `CHECK_FIELDS` keys, replacing the 9 duplicates, and `authErrorKey(error)`. The latter maps Supabase auth `error.code` values (`invalid_credentials`, `user_already_exists`, `weak_password`, `email_address_invalid`, `over_request_rate_limit`, `over_email_send_rate_limit`) to keys; anything else → `"errors.auth.generic"`.
- Eyepiece preset labels become two keys each (short name, AFOV hint), which removes the regex at `gear/index.astro:56`.
- Onboarding:
  - Presets and scenes keep their ids and numbers. `name`, `title` and `description` move to `messages.onboarding.*` keyed by id.
  - `ONBOARDING_SITE_NAME` is removed and `onboardingInputSchema` no longer outputs `site.name`. The route passes `messages.onboarding.homeSiteName` for `locals.locale` into `completeOnboarding(client, input, { siteName })`.
  - `searchPlaces` takes a `language: Locale` parameter instead of hard-coding `en`.
- `config-status.ts` returns keys. The Polish literals in it and in `Layout.astro` are removed.

#### 4. Templates and islands

**File**:

- every `.astro` page, layout and component, and every `.tsx` island that renders text (including `AuthShell.astro` and `PreferenceSwitches.tsx`)
- `src/lib/catalogue/common-names.ts` (new)

**Intent**: No user-visible literal remains in templates. Pages read `locals.locale`; islands receive `locale` as a prop and call `getMessages` themselves.

**Contract**:

- Pages translate `?error=` via `translateKey`, and islands translate `serverError` and zod `issue.message` the same way.
- Page `<title>`s, `aria-label`s and placeholders use messages.
- `src/lib/catalogue/common-names.ts` maps a Messier number to a localised common name for `pl`, falling back to the catalogue's English. The generated `messier.json` is never edited.
- `ObjectCard` uses it.

#### 5. Project conventions

**File**: `CLAUDE.md`

**Intent**: Replace "All user-facing copy is English" and the Polish-starter-strings note with the new rules.

**Contract**:

- Copy goes through `src/i18n` keys, with `en` as the source and `pl` required.
- `?error=` carries keys.
- Colours come from tokens only (the guard test enforces it).
- Theme and locale come from `locals`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, with `format.test.ts` and `build.test.ts` English expectations unchanged and the new `i18n.test.ts` green
- `npm run lint` and `npx astro check` pass, including `pl.ts satisfies Messages`
- `npm run test:db` passes
- `npm run build` succeeds
- `npm run smoke` passes

#### Manual Verification:

- Every screen reads exactly as before in English (spot-check Tonight in go, no-go, no-darkness and outage states, plus form validation messages on both the client and the server path)
- A failed sign-in and a duplicate sign-up show translated generic messages, and the URL carries only a key

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Polish translation

### Overview

Fill the Polish catalogue, the Polish Messier common names and the Polish-specific formatting data. This phase is cut-order #5: dropping it leaves a working English-only product with the switch in place.

### Changes Required:

#### 1. Polish catalogue

**File**: `src/i18n/messages/pl.ts`

**Intent**: Translate every message into natural, concise Polish for a beginner astronomer. Use informal second person ("ty"), which is standard for consumer apps.

**Contract**:

- Every leaf is overridden. None may be inherited from `en`; a test asserts that no `pl` string leaf equals its `en` counterpart, except an explicit allowlist of true invariants (brand names, units).
- Polish plural forms (`one` / `few` / `many` / `other`) for counts and durations.
- Compass points: Pn, PnPnW, PnW, WPnW, W, WPdW, PdW, PdPdW, Pd, PdPdZ, PdZ, ZPdZ, Z, ZPnZ, PnZ, PnPnZ.
- `homeSiteName` is "Dom".

#### 2. Polish Messier names

**File**: `src/lib/catalogue/common-names.ts`

**Intent**: Give the 29 objects with English common names their established Polish names (for example M1 "Mgławica Krab", M31 "Galaktyka Andromedy", M45 "Plejady").

**Contract**:

- Every Messier number whose English `commonName` is set has a `pl` entry.
- A test checks coverage against `MESSIER`.

#### 3. Polish formatting tests

**File**: `src/lib/tonight/format.test.ts`, `src/i18n/i18n.test.ts`

**Intent**: Pin the Polish output of the formatter for the cases where Polish differs structurally.

**Contract**: tests cover:

- `pl-PL` dates ("sobota, 10 października 2026")
- 24 h times
- a comma decimal separator
- plural durations and counts (1 / 2 / 5 / 22 objects)
- compass points (`SW` → `PdZ`)
- the no-darkness explanation with degree values

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the Polish formatter tests, the no-inherited-English test and Messier-name coverage
- `npm run lint` and `npx astro check` pass
- `npm run build` succeeds and `npm run smoke` passes

#### Manual Verification:

- The user (native Polish speaker) reviews Polish copy on landing, auth, `/gear` forms and errors, and Tonight in go, no-go, no-darkness and outage states, and accepts the wording
- A browser set to Polish with no cookie lands in Polish; switching to EN and back persists

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `preferences.test.ts`: cookie validation and `Accept-Language` negotiation (q-values, region subtags, wildcard, empty header).
- `i18n.test.ts`:
  - `en`/`pl` key parity and kind
  - `translateKey` fallback
  - Polish plural categories
  - no inherited English in `pl` (Phase 4)
- `format.test.ts` / `build.test.ts`: English expectations unchanged, plus Polish cases (Phase 4).
- `no-hardcoded-colors.test.ts`: zero palette classes or colour literals outside `global.css`.
- Updated schema, preset and store tests assert keys instead of English sentences.

### Integration Tests:

- `npm run smoke`: redirects and `?error=` prefixes are unchanged, since values are keys now.
- `npm run test:db`: the onboarding suite asserts the out-of-range key instead of the sentence.

### Manual Testing Steps:

1. On `/design` in dev, compare both themes to board A of the canvas.
2. Walk landing → sign-up → gear → Tonight in dark, then in light, at phone width.
3. Force every Tonight state (go, no-go via a cloudy fixture, no-darkness via a high-latitude summer site, outage via `FORECAST_BASE_URL`) in both themes.
4. Switch to PL and walk the same path; read every message.
5. In a fresh profile with Polish as the browser language, confirm Polish on first load.

## Performance Considerations

- Fonts are self-hosted variable fonts plus one mono weight, subset by fontsource. Use `font-display: swap`.
- Both catalogues ship to islands. They are text only, a few KB each, which is acceptable.
- Formatter instances are created once per request (`createFormatter(locale)`), not per call.

## Migration Notes

No database changes. The onboarding site name "Dom"/"Home" affects only new rows. Existing sites keep their stored names.

## References

- Design canvas: https://claude.ai/artifact/Rs1rsxtMzcwkJseQimhyj6 (board A · Observatory)
- Roadmap: `context/foundation/roadmap.md` (F-03 `ui-foundation`; S-10 depends on it)
- PRD v2: `context/foundation/prd.md` (FR-025, FR-026, cut order #5)
- Follow-on: `context/changes/first-run-onboarding/plan.md` (phases 2-4 amended after this change)
- Copy flow: `src/lib/tonight/format.ts:13-228`, `src/lib/tonight/build.ts:154-226`
- Route error pattern: `src/pages/api/gear/sites/index.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Theme tokens, fonts and switch

#### Automated

- [x] 1.1 `npm test` passes, including `preferences.test.ts` — 25597da
- [x] 1.2 `npm run lint` and `npx astro check` pass — 25597da
- [x] 1.3 `npm run build` succeeds and the build output contains no `fonts.googleapis.com` reference — 25597da

#### Manual

- [x] 1.4 On `/design` in `npm run dev`, both themes match board A of the design canvas, and switching theme is instant with no flash on reload — 25597da
- [x] 1.5 The EN/PL switch persists across reloads, and a fresh browser profile with Polish as its first language gets `lang="pl"` on `<html>` — 25597da

### Phase 2: Retrofit every screen to tokens

#### Automated

- [x] 2.1 `npm test` passes, including `no-hardcoded-colors.test.ts` with zero offenders — cd32d1e
- [x] 2.2 `npm run lint` and `npx astro check` pass — cd32d1e
- [x] 2.3 `npm run build` succeeds — cd32d1e
- [x] 2.4 `npm run smoke` passes against a local preview with local Supabase — cd32d1e

#### Manual

- [x] 2.5 Landing, sign-in, sign-up, confirm-email, `/gear` (list, new and edit forms incl. validation errors) and Tonight (go, no-go, no-darkness and outage states) reviewed in both themes at desktop and phone width, and they match board A — cd32d1e
- [x] 2.6 Text contrast looks readable in the light theme, especially muted text, kickers and verdict chips — cd32d1e

### Phase 3: English catalogue and locale-aware formatting

#### Automated

- [x] 3.1 `npm test` passes, with `format.test.ts` and `build.test.ts` English expectations unchanged and the new `i18n.test.ts` green
- [x] 3.2 `npm run lint` and `npx astro check` pass, including `pl.ts satisfies Messages`
- [x] 3.3 `npm run test:db` passes
- [x] 3.4 `npm run build` succeeds
- [x] 3.5 `npm run smoke` passes

#### Manual

- [x] 3.6 Every screen reads exactly as before in English (spot-check Tonight in go, no-go, no-darkness and outage states, plus form validation messages on both the client and the server path)
- [x] 3.7 A failed sign-in and a duplicate sign-up show translated generic messages, and the URL carries only a key

### Phase 4: Polish translation

#### Automated

- [ ] 4.1 `npm test` passes, including the Polish formatter tests, the no-inherited-English test and Messier-name coverage
- [ ] 4.2 `npm run lint` and `npx astro check` pass
- [ ] 4.3 `npm run build` succeeds and `npm run smoke` passes

#### Manual

- [ ] 4.4 The user (native Polish speaker) reviews Polish copy on landing, auth, `/gear` forms and errors, and Tonight in go, no-go, no-darkness and outage states, and accepts the wording
- [ ] 4.5 A browser set to Polish with no cookie lands in Polish; switching to EN and back persists
