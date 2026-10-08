# Review fixes: ui-user-adjustments

## Phase 1 (impl-review-phase-1.md, 2026-10-08): applied after commit 6a63158

These were added to Phase 1's scope after the review (a plan addendum; the Phase blocks stay frozen):

- F1: in red mode the suggested sky-check answer is told apart by shape. It gets `border-2` and the action fill.
- F2: hover on `action` changes the border colour and underlines; the fill stays.
- F3: clickables that were outside the inventory now follow the user's rule.
  - The /log "Sky checks" link and the /gear "Add …" links are `action` with an icon.
  - "Back to sign in" has an `ArrowLeft` icon.
  - The SiteForm Undo button and the onboarding "manual" toggles are underlined at rest.
  - The resting border for ghost buttons is one shared constant.
- F4: the `sm` size drops `text-sm`, so every `sm` control uses the `text-label` role (an intended +1 px everywhere).
- F5: the gap between the back link and the page title lives in `BackLink` (bottom margin). The wrappers are back to their earlier classes, and `src/pages/log/new.astro` has no diff against main.
- F6: the `default` size no longer fixes `h-11` (the base `min-h-11` stays). The `/design` `action` specimens render at `sm`.

## Phases 2-4 impl review (`reviews/impl-review-phases-2-4.md`), fixed in `1b0e882`

- F1: `VerdictCard` keeps the dark window as an `sr-only` line when the slider is shown (screen readers lost it in Phase 3).
- F2: `src/lib/toasts.ts` `releaseFocus` moves focus to `<main>` (`tabindex="-1"`) before a focused toast or dismissible notice goes; `toasts.spec.ts` asserts focus is not on `body`.
- F3 (Fix A): the Site select has no `data-needs-network` and navigates offline to the stored copy (copies are per site); the Telescope select keeps it and restores its default value when `<html data-offline>`.
- F4: `GEAR_CARD_MIN_HEIGHT_CLASS` is `min-h-34 sm:min-h-37`, border included (cards measure 136 / 148 px); the Polish Manage label still wraps at 320 and 640 px.
- F5: two-`requestAnimationFrame` waits replace `waitForTimeout(500)` before the "stays hidden" checks in `toasts.spec.ts` and `offline.spec.ts`.
- F6: the sky view carries `zoneLabels` per frame; `build.test.ts` pins CEST before 03:00 and CET after on Madrid's 2026-10-24/25 night.
- F7: `tonight.sky.darkRange` (EN/PL) for the merged slider label.
- F8: `GearCard` `selectId`; `/design` specimens re-synced with unique ids.
- F9: the hidden "Show" submit button and its no-JS comment are gone; `siteSelector.show` / `selector.show` keys removed.
- F10: `tonight-phone.spec.ts` header updated; the tautological `TOAST_MS` test dropped; `deleteGear` asserts the exact deleted notice; the chevron's rest opacity is 80 (60 failed 3:1 in red) with a new contrast row.
