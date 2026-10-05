# ui-onboarding — verification evidence

Screenshots were taken with scratch Playwright scripts (not committed) against a local production preview on port 4323 (local Supabase, forecast fixture on 4402), with a throwaway user `ui-onboarding-<random>@example.com` that has no gear. Files live in the session scratchpad: `…/scratchpad/before/`, `…/scratchpad/after/` and, after the review fixes, `…/scratchpad/after2/` (same file names) (`/private/tmp/claude-501/-Users-rafalskwara-projects/03f9276d-350c-4903-b6f8-0c2d7d395bdd/scratchpad/`). Geolocation and place search were stubbed (Playwright context geolocation, an init-script `navigator.geolocation`, and a route mock for `geocoding-api.open-meteo.com`), so no real coordinates left the browser.

## Manual checks

| Progress row | Evidence | Observed |
| --- | --- | --- |
| 1.4 `/design` ChoiceCard and React Band | `after/design-c-choice-card-{dark,light,red}-{390,1280}.png`, `after/design-c-band-react-{dark,light,red}-{390,1280}.png` (dev server on 4323) | Default, hover, checked, focus + checked, disabled distinct in all three themes; focus is the offset `--ring` outline outside the ink border; the React bands match `Band.astro`'s rule and heading. |
| 2.4 `/onboarding` matrix | `after/onboarding-{en,pl}-{dark,light,red}-{390,1280}.png` (before: `before/…` same names) | Sky header with title and intro; three ruled bands without kickers or boxes; ruled submit area; eyepieces as ruled rows. Polish at 390 px wraps the title ("Skonfiguruj / Sidereus") and long headings without overflow. |
| 3.3 State matrix (390 px; EN dark/light/red, PL dark) | `after/state-{locating,found-device,ready,denied,results,picked,noresults,searchfail,manual,invalid-kit,invalid-full,servererror,focus-card,focus-locate,submitting,nokit,limit}-{en-dark,en-light,en-red,pl-dark}.png` | Locating disables "Use my location" with the hint; device and place picks show the ink confirmation line; denied shows guidance; no results / failure messages show, the failure with the `CircleAlert` icon; invalid fields and the summary carry the icon in red mode; `?error=` shows the ServerError surface; focus on cards and buttons is the `--ring` outline; submitting shows the spinner and "Saving…"; "No eyepieces yet" shows the empty line; at 10 rows "Add eyepiece" is disabled with the limit note. |
| 3.4 `/gear/sites/new` | `after/sites-new-{en,pl}-{dark,light,red}-{390,1280}.png`, `after/sites-new-picked-{en,pl}-{dark,light,red}-390.png` | Unchanged layout; the picker and its confirmation line render as before. |

## Automated checks (final tree)

- `npm run lint`: 0 errors (2 pre-existing warnings in `src/lib/engine/determinism.test.ts`).
- `npx astro check`: 0 errors, 0 warnings, 0 hints.
- `npm test`: 648 passed, 6 todo.
- `npx playwright test` against `http://localhost:4323`: 23 passed, 2 skipped (pre-existing skips), including `onboarding.spec.ts`, `site-location.spec.ts` and `telescope-selector.spec.ts`.
- Hardcoded-value scan on the five touched view/component files: 0 hits (before: 11 arbitrary values and 4 `rounded-xl`/`rounded-2xl`).
