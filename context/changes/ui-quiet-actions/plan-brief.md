# Quieter per-item actions (ui-quiet-actions): Plan Brief

> Full plan: `context/changes/ui-quiet-actions/plan.md`
> Research: `context/changes/ui-quiet-actions/research.md`
> Audit and owner decisions: `context/changes/ui-refine/audit.md`

## What & Why

The owner finds the buttons too loud. Every per-item or standalone link is a bordered, tinted, link-coloured `action` box, so a phone screen of Targets shows 11 boxes, and they outshout the objects, times and what-to-expect lines. The owner's decision 1 on the ui-refine audit (3C) replaces "every clickable is a box" with a hierarchy. This change is first in the ui-refine split, because it is global and the later view changes inherit it.

## Starting Point

- `buttonVariants`' `action` variant (`button.tsx:39-40`) has 12 call sites in 10 files. The CLAUDE.md Clickables rule prescribes it.
- The tile cue is a bordered, filled chip.
- Eyepiece names use the link colour without being links.
- No e2e spec asserts the look. `contrast.test.ts` pins the action tokens, which the sky-check answers and the milestone medallion also use.

## Desired End State

- **Per item:** each target, planet and the Moon ends with one neutral hairline "Mark observed" and a text-only "Finder chart".
- **Text actions:** back links, Pager, Manage, the /log header links, "See your progress" and "Back to sign in" are text with their icon.
- **Dashboard:** the tiles end in a bare arrow.
- **Eyepiece names:** bold heading ink, not the link colour.
- **Red mode:** text actions are underlined at rest, and the hairline has a ≥3:1 red border.
- **Offline:** "Mark observed" still dashes.
- **Contract:** `action` is gone from `buttonVariants`, replaced by `quiet` and `hairline`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Hierarchy | 3C: one hairline per item, text for the rest, bare tile arrow, one filled primary per screen | The owner's decision on the audit | Owner (audit) |
| Hairline colour (D1) | New neutral `--control-border` at ≥3:1 on background and surface | Experiment B's `--border` is 1.17-1.78:1, so in red "Mark observed" would read as text | Plan default, **owner to confirm** |
| Red-mode text actions (D2) | Underlined at rest in red only (new `red:` variant) | Red has one hue, so shape must mark a link; elsewhere the colour already does | Plan default, **owner to confirm** |
| Variant names | Remove `action`; add `quiet` (with a `bare` size) and `hairline` | Removing it makes TypeScript find every call site; the size avoids a padding clash in cva | Plan |
| Action tokens | Kept, for the sky-check answers and the medallion only | Retiring them would reopen the sky checks' red-mode "suggested answer" fix | Research |
| /gear Add (band not empty) | Hairline | A per-section add is a per-item button, not a text link | Plan |
| Back link | Quiet now; replaced by the Tonight sub-nav in change 4 | Keeps this change global and small | Owner split |
| Implementation start | After S-07 sky-events merges; rebase first | S-07 adds the events tile and page the evidence must show | Orchestrator |

## Scope

**In scope:** the `quiet` and `hairline` variants, the `bare` size, the `--control-border` token, the `red:` custom variant, contrast pins, `/design` specimens; every `action` call site moved; the tile cue bared; eyepiece names recoloured; the CLAUDE.md Clickables rule; the screenshot gate; the whole e2e suite and smoke.

**Out of scope:** the Tonight sub-nav and Progress as a destination (change 4); stat cards, fact icons and spacing (change 2); the `default`, `outline`, `ghost`, `link` and `destructive` variants; sky-check answers; the milestone medallion; row links.

## Architecture / Approach

Contract first. Phase 1 adds the token, the `red` variant and the two variants beside `action`, pinned by `contrast.test.ts` and shown in `/design`. Phase 2 moves the 12 call sites, bares the cue, recolours eyepiece names and deletes `action`. Phase 3 rewrites the rule, captures the EN/PL × dark/light/red × phone/desktop matrix, and runs the whole suite the way CI does.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Contract | Token, `red:` variant, `quiet` and `hairline`, pins, `/design` matrix | Red hairline value reaching 3:1 while staying pure red |
| 2. Call sites | Every `action` user moved, cue bared, eyepiece names recoloured, `action` removed | Gear card height or Polish wrapping shifting (`tonight-phone.spec`) |
| 3. Rules and gate | CLAUDE.md rule, screenshot matrix, whole e2e and smoke | The owner judging the weight differently from the defaults |

**Prerequisites:** S-07 sky-events merged to main; the owner's answer on D1 and D2 (or acceptance of the defaults); local Supabase and the forecast fixture for e2e.
**Estimated effort:** about one session, 3 phases, mostly class edits plus the evidence.

## Open Risks & Assumptions

- D1 and D2 are defaults pending the owner. Phase 1 adapts: reusing `--action-border` drops the token, and "underline everywhere" drops the variant.
- A text action in the link colour sits directly on the sky (back links, /log header). It passes 4.5 in every theme (light zenith 4.90), and the new pin holds it there.
- The gear cards' measured height assumes the Manage link stays 44 px tall.

## Success Criteria (Summary)

- On Targets and Planets, the objects and their facts lead; each item has one quiet button and one text link.
- Red mode and offline still tell actions apart by shape.
- The whole unit and e2e suites and smoke pass unchanged in their locators.
