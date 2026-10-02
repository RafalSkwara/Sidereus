# Moonlight and the Verdict — Plan Brief

> Full plan: `context/changes/moonlight-and-the-verdict/plan.md` (revision 2)
> Frame brief: `frame.md` · Plan reviews: `reviews/plan-review-rev1.md` (rev 1), `reviews/plan-review.md` (rev 2) · Calibration: `calibration-harness.md`

## What & Why

> **The actual problem to plan around is**: Tonight presents a cloud-only forecast as if it judged the whole night, and nothing on the page states the Moon's effect honestly. The Moon has no visible presence of its own, and the per-object judgement under moonlight ignores faintness and distance from the Moon, so effectively invisible targets are offered as good bets.

On an 80%-Moon night Tonight says "Go" and still lists faint galaxies, which "feels like the user is being lied to".

## Starting Point

- **The verdict** (`verdict.ts`) uses clouds and humidity only. That was a deliberate choice, but the copy says "Go" and "worth setting up for".
- **The deep-sky moonlight term** (`score.ts:131`) lowers every object by the same amount (#21 item 2).
- **The Moon card** is text only.
- **No Moon geometry** exists yet.
- **Revision 1 of this plan was rejected.** Its graded moon score reversed the full-Moon ranking when tested on the real engine.

## Desired End State

The top of Tonight has two cards.

**Sky tonight**
- It reads **Clear / Partly clear / Cloudy**. Specific reasons get their own headline: "Clear, but damp", "No forecast", "No dark window".
- The same words are used everywhere a verdict is shown: the strip, `/tonight/all`, the landing legend and the next-night line.

**The Moon**
- A detailed SVG at 1% resolution, lunar north up, with about 12 maria.
- It shows the Moon at page load, with a slider across tonight's window and a "Now" button.
- It states when the Moon is up and what it does to faint objects.

**Ranking**
- Faint galaxies and nebulae that the Moon washes out are hidden, with a count line linking to their group on `/tonight/all`.
- Clusters, M31, M42 and M57 stay listed.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where the fix lives | On the page and in per-object judgement; verdict computation unchanged | "A good night depends on the person"; keep it checkable (S-07) | Frame (user) |
| Preference toggle | Parked | Doesn't fix the root cause | Frame |
| Top layout | Sky card + Moon card side by side; the Moon card moves up | The user's "two cards" idea | Plan (user) |
| Verdict wording | Sky words, chosen by level **and** reason (damp, no forecast, no dark window) | Never "Cloudy" on a summer night or "Partly clear" with no forecast | Plan (user) + Review F4 |
| Washed-out objects | Hidden, counted, and grouped on `/tonight/all`, all shipping in Phase 1 | Honest, and never a silent shrink | Plan (user) + Review F3, F6 |
| SVG | Map orientation, exact lit shape at 1%, IAU maria with libration | Stable and familiar; no licensed data | Plan (user) |
| Moment shown | Page load (clamped) plus a slider over the window and a "Now" button | User's request | Plan (user) |
| Moon score | **One scale for every object:** Moon-induced sky brightening at the object (K&S), weighted by type sensitivity (galaxies 1, globulars 0.6, open clusters 0.3, doubles 0.15) | Revision 1's two-scale formula reversed the ranking | Review F1, calibrated |
| Washed-out rule | Diffuse objects with SB_eff − sky > **3.5** mag at every best-window sample, and only because of the Moon; core offset **1.5**; b = a fallback; M16 exempt | Harness: full-Moon top 5 is clusters only; M33, M43, M74 and M101 hidden; M31, M42, M57 kept | Calibration (delegated) |
| What the count counts | Only objects that would clear the bar on a moonless night (full Moon, B6: 4) | The count blames the Moon only for what it actually hides | Review rev 2 F2 (user) |
| Moon card faint-objects line | Four cases by K and Moon up time: washed out / up part · unaffected / moonlit · none lost / dark night | Every night gets a true line; no illumination threshold | Review rev 2 F3 (user) |
| Verification | Property tests plus a checkpoint harness, with tuning bounded to T 3.0–4.0, offset 0–2, reference 1–2 | Avoid fitting to named objects | Review F2 |
| Slider plumbing | 10-minute states precomputed on the server; browser-safe `src/lib/moon-disc/` owns the type and geometry; fallback to a custom element if island nesting fails | Keeps astronomy-engine off the client | Plan + Review F7 |

## Scope

**In scope:**
- The moonlight model, the washed-out flag and its explanation.
- Disc states and geometry.
- Sky wording everywhere, plus the PRD and roadmap notes and the landing screenshot.
- The Moon card, with the old bright-Moon line removed.
- The slider.

**Out of scope:**
- A preference toggle and any change to the verdict thresholds.
- Sky-oriented rendering, earthshine, craters and textures.
- Exact rise/set times (S-05).
- #21 items 1, 3 and 4.
- Object extinction in the contrast.
- The landing tagline.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Honest moonlight in the ranking | Moonlit-sky model, single-scale moon score, washed-out flag, count line, `/tonight/all` group, checkpoint | Implementation drifting from the harness numbers |
| 2. Moon disc geometry | States (GeoVector, RotationAxis, Libration) and SVG paths; orientation tested on real states | Angle sign conventions |
| 3. Sky wording everywhere | `skyHeadline` (level + reason) in every reader, PRD and roadmap notes, landing re-capture | Many readers and specs |
| 4. The Moon card | Two-card top with the server SVG, the per-path matrix, bright-Moon line removed | Removal touch-list breadth |
| 5. The time slider | Interactive Moon over tonight's window | Client island nested in the server island |

**Prerequisites:**
- PR #78 (S-02 archive) merged.
- Local Supabase and the forecast fixture for e2e.

**Estimated effort:** about 5 sessions.

## Open Risks & Assumptions

- The candidates were calibrated in Warsaw at Bortle 3 and 6 only. The checkpoint adds Bieszczady (M-1 Night 3).
- K&S is single-scattering and V-band only, and weak near the horizon and very close to the Moon.
- Clusters "rising" under a bright Moon (18 → 36 cleared) is intended, but it is a visible change from M-1.
- Dropping "Go" changes the product's core word. The PRD note records it.

## Success Criteria (Summary)

- On a bright-Moon night nothing over-promises. The sky card covers only the clouds, the Moon card shows the Moon and its effect, and invisible targets are not recommended but are counted and findable.
- The slider shows the Moon at any moment of tonight's window, accurate to 1% lit.
