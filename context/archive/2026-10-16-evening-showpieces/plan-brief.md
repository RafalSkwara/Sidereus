# Evening Showpieces, Window Edges and the PRD Re-check (M-4 S-05) — Plan Brief

> Full plan: `context/changes/evening-showpieces/plan.md`
> Research: `context/changes/evening-showpieces/research.md`

## What & Why

M-4 S-05 (#173, #21 items 1, 4, 5, PRD Primary criterion 2): the short evening showpieces (M13, M15, M57) are undervalued because `duration` divides by the whole dark window; window edges sit up to 9 minutes inside the truth on the 10-minute grid; a moonlight reason can appear on a moonless night; and criterion 2 (top 5 against a planetarium and a planner) was never run against a planner.

## Starting Point

- `duration = placed / track.length`: on Warsaw 2026-10-15 M13 is #53, M15 #32, M57 #60 of 115, but #2 in April and July when the dark window is short.
- Even with `duration = 1` M13 could rank only #10-17 and M57 #42-65: brightness bounds them, so this slice removes a structural penalty and does not promise the top 5.
- 34 of 242 window edges on 2026-10-15 are over the 5-minute tolerance, always inward; no test checks an object window against an independent reference.
- "100% clear of moonlight" is gone, but "Holds up better in moonlight than the rest" still appears when every entry has moon = 1; the sky phrase has the same fault.

## Desired End State

- Deep-sky windows (Targets, Session plan, reason line) are within 5 minutes of Skyfield + DE421 on three nights, with no inward bias.
- `duration` saturates at a 120-minute useful span: October M13, M15, M57 rank about #31, #19, #46; the oracle stays at 3 or more and the AF check stays green, both unedited.
- A moon or sky reason appears only when the listed entries differ on it; none on a new-Moon night.
- Criterion 2 is recorded with fixed rules, and S-03's calibration sign-off gets a fresh four-night top-10.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Duration fix | `min(1, windowMin/120) × mean placement over the window` (`DURATION_USEFUL_SPAN_MINUTES`, new named candidate) | Oracle 3-4 on all nights and AF check green in the probe; the alternatives failed April or the AF check | Research / Plan |
| Window edges | Linear interpolation of the crossing in a new `refinedWindow` (deep-sky only, `bestWindow` untouched); scoring stays on sample times | Error about 0.012°, conservative side; planets, the Moon and `moonTarget` rely on the unchanged window | Plan / review F1 |
| Reference for edges | Skyfield + DE421 fixture for the whole catalogue on three nights, generated once like the existing ones, red first | Independent of astronomy-engine; M-1 used the same tool | Research / review F8 |
| Reasons | `moon` and `sky` eligible only with a spread of at least 0.05; a component is named only when the entry is at least average on it; a reason line may carry one phrase | Removing only the moon phrase would promote another empty one, and "Bright for your N mm" must not label the list's weakest | Plan / review F5 |
| Short windows | Out of scope; edges now show their true short length | Owner's #21 comment gave this slice items 1, 4, 5 | Plan |
| Planner leg | in-the-sky.org as a manual cross-check (altitude, times, visibility; no ranking), plus the beginner list as the ranking sanity; only method and an agreement summary in the repo | The PRD names no tool; the site's terms forbid profit from reproduction, so no text or value is committed | Owner OD-2 / F6 |
| Nights | Warsaw 2026-04-15, 07-15, 10-15, Bortle 5, 150/750 | Calibration nights; April is the counter-case | Plan |

Decided by the owner on 2026-10-16: OD-1 duration saturation only (the October gap, M13 about #31, M15 #19, M57 #46, is recorded as a known divergence); OD-2 in-the-sky.org is the planner; F6 nothing from in-the-sky.org enters the repo (the earlier local commits were rewritten before the first push).

## Scope

**In scope:**
- Skyfield window fixture and generator, a reference test, true-crossing windows for deep-sky objects;
- the saturated duration term with relations and a source-cited October guard, plus the calibration snapshot for the owner;
- the reason eligibility and naming rule (one-phrase lines allowed) and a corrected demo string;
- the criterion-2 re-run record, CLAUDE.md, PRD Open Questions 1 and 9, the roadmap's M-1 note, whole e2e and smoke.

**Out of scope:**
- weights, the bar, `WELL_PLACED_ALTITUDE_DEG`, the Moon and sky terms, the grid step;
- planet and Moon windows, a minimum-useful-span filter, new wording or keys;
- editing the oracle, the AF check, the beginner reference or the archive.

## Architecture / Approach

A new `refinedWindow` returns true crossings plus the sample indices (`bestWindow` stays as is); `scoreObject` scores on the sample indices and carries refined edges on `ObjectScore.window`, which the Session plan and Targets already read. The new duration rule reads only the window's sample times, so edges never move a rank. `reasonComponents` filters moon and sky by their spread across the listed entries, names only components at or above the list mean, and picks the lead and the optional runner-up from those.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Window edges (Sonnet high) | Skyfield fixture and red reference test, then true crossings | Tests that assumed sample-aligned edges (several pins listed in the plan); the one-sample pin changes premise |
| 2. Duration saturation (Sonnet high) | New rule, relations, source-cited guard, calibration snapshot | Zero-slack oracle and the AF check must stay unedited and green; four `score.test.ts` pins are re-derived |
| 3. Reasons (Sonnet high) | Eligibility and naming rule, updated reason tests, demo string | Three reason cases change (requirement changed); `second` becomes optional |
| 4. Criterion 2 and docs (Sonnet medium; lead runs e2e and smoke) | Re-run record, docs, whole-suite checks | An object in the final top 5 missing from the fixture or planner evidence |

**Prerequisites:** `npm ci` (done); network for pip and `de421.bsp` in Phases 1 and 4 (tooling only, no web lookups). Ports preview 4331, fixture 4401.
**Estimated effort:** about 2 sessions across 4 phases.

## Open Risks & Assumptions

- **Ceiling:** the October showpieces rise 15-22 places but stay outside the top 5; OD-1 is the owner's call on whether that is enough.
- **Interpolation near the horizon:** refraction curvature is larger at low altitudes; the 0.05° invariant and the Skyfield test check it, and a site minimum altitude near 0° is the case to try.
- **Planner evidence thinness:** in-the-sky.org's twilight rule is undocumented and about half of its pages state no highest altitude; the rules are fixed before comparing and an unstated page is reported as "not stated", not patched.
- **Capture lives outside the repo:** the raw values are in the lead's scratchpad only; if they are gone, Phase 4 stops and asks rather than fetching.

## Success Criteria (Summary)

- A beginner's Targets and Session plan show windows that open and close on time, and no reason line talks about moonlight on a moonless night.
- M13, M15 and M57 are no longer ranked down for being up only part of a long night.
- Criterion 2 is recorded with its rules, deviation and results, and the full unit, e2e and smoke suites are green.
