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
