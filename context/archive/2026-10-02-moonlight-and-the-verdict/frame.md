# Frame Brief: Moonlight and the verdict

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

On bright-Moon nights (about 80% lit), Tonight's headline verdict says **Go** while most of the sky is effectively unfit for observing. All three of these feel wrong to the user:

- the verdict word;
- the ranked list, which still offers faint galaxies;
- the Moon being "buried".

Hard requirement, carried forward unchanged and not under question: a fairly detailed SVG of tonight's Moon, showing its lit fraction at 1% resolution, as it actually looks.

## Initial Framing (preserved)

- **User's stated cause or approach**: the verdict ignores the Moon. The Moon weighs so heavily on everything else that it must be separated out somehow. "We cannot simply say that the verdict is Go when we have 80% Moon lit."
- **User's proposed direction**:
  - a Moon vs stars (Messier) preference toggle; or
  - splitting the verdict into two cards, the Moon and the rest.

  Either way, keep it simple, and include the detailed Moon SVG.
- **Pre-dispatch narrowing**:
  - *Meaning of "Go":* "not sure". Maybe it shouldn't be one score; maybe it depends on what the user prefers to watch (the Moon, planets, faint Messier objects, or just whether the sky is clear), possibly saved in settings.
  - *What feels wrong:* all three. The verdict word, the ranked list, and the Moon being buried.
  - *Scope:* "the Moon is special, but other things can affect the visibility of various objects".

## Dimension Map

1. **What the verdict means.** The verdict computes something narrow, but its wording and presentation promise "a good night overall". ← initial framing, read as "the verdict is wrong"
2. **What the verdict models.** One headline stands for target classes that conditions affect differently. ← the two-cards or toggle proposal
3. **Deep-sky ranking under moonlight.** Per-object judgement lets faint targets look like good bets under a bright Moon.
4. **Page layout.** Moon information exists but is easy to miss, and there is no picture of the Moon.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. What the verdict means | `verdict.ts:69-117` uses dark-window clouds, humidity and fallback only, with no Moon input. This was a deliberate choice: `shape-notes.md:66-69` says "Night score (cloud + humidity …) is separate from object score", and PRD OQ2 (`prd.md:487-490`) is cloud and humidity thresholds only. The copy promises more: "Is tonight worth setting up for?" (`en.ts:74`), an unqualified "Go" (`en.ts:69`), and "Next night worth a look" (`en.ts:665`). The PRD itself wavers: "worth setting up for" (`prd.md:24`) against "whether the sky will be usable" (Business Logic). | STRONG |
| 2. What the verdict models | Per-class judgement already exists. The Moon and planets have their own −6° window and their own `verdict()` (`build.ts:419-421`). The Bortle penalty applies to galaxy and nebula types only (`score.ts:73-79`). The `isBrightMoon` flag exists (`build.ts:536-553`). All of it sits under one deep-sky-centred "Go" (`VerdictCard.astro:53-59`). No stored user preference about what to observe exists: `preferences.ts` covers theme and locale cookies only, and no profile table exists. The PRD has a single beginner persona (`prd.md:38-44`). | STRONG (model) / WEAK (preference) |
| 3. Deep-sky ranking under moonlight | The engine probe (Warsaw, 150 mm, real `rankObjects`) and the formula `moon = 1 − illum × share of samples with the Moon up` (`score.ts:131`) show the problem. The formula ignores object type, surface brightness and distance from the Moon (`moonSeparationDeg` exists but is never called). The ceiling at full Moon is 0.70 against the 0.45 bar (`parameters.ts:57-65`). Results: full Moon at Bortle 5 still clears 6 galaxies or nebulae, with M33 (surface brightness 23.6) and M31 in the top 5. At about 70% the count rises to 30 galaxies or nebulae cleared, against 26 at new moon. | STRONG |
| 4. Page layout | The order is verdict card, solar system (Moon card first), then the ranking (`TonightContent.astro:141-223`). So the Moon card is above the ranking, but it is text only, and no Moon image exists anywhere. The bright-Moon note is a secondary line under the headline and needs the Moon up for more than half the dark window. | PARTIAL |

## Narrowing Signals

- **"Is a clear, 80%-Moon night good for a beginner?"** The user answered "depends on the person". No single "good night" headline can be true for everyone, which rules out folding the Moon into the one verdict level.
- **"Should the headline stay checkable by looking up?"** The user answered "yes, keep it checkable". The headline stays a sky (cloud) forecast, which also keeps S-07's verdict check sound (`roadmap.md:188-190`).
- **M33 in the top 5 at full Moon.** The user said: "probably OK if clearly marked, but it depends on how far the object is from the Moon … If something is not visible or hardly visible it feels like the user is being lied to." That places the honesty problem in per-object visibility under moonlight, including distance from the Moon.
- **Prior occurrence.** Issue #21 item 2, from the M-1 checkpoint (`archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md:167-175`), reads: "Bright moonlight never reorders the list … does not account for separation or surface brightness, so under a 98% moon galaxies (M33, M81) stay high." It names the same candidates the user arrived at independently.

## Cross-System Convention

Observing guides cited in the M-1 checkpoint and in the S-02 research (AAVSO, the S&T skyglow figures) treat moonlight as "nature's own light pollution". They judge it per target:
- bright clusters, doubles, planets and the Moon survive it;
- low-surface-brightness galaxies do not;
- distance from the Moon matters.

Planners usually show the weather ("is it clear") separately from the Moon's phase, its rise and set times, and a picture of the Moon. The leading hypothesis matches that convention. The user's toggle idea does not match it: guides show every class's conditions, rather than asking the observer to pick a class first.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: Tonight presents a cloud-only forecast as if it judged the whole night, and nothing on the page states the Moon's effect honestly. The Moon has no visible presence of its own, and the per-object judgement under moonlight ignores faintness and distance from the Moon, so effectively invisible targets are offered as good bets.

The user's instinct ("separate the Moon somehow") was right, but the split belongs on the page, not in the verdict computation. The verdict should stay a checkable sky forecast and be worded as one. The Moon should get its own prominent, visual statement of tonight's conditions (the SVG). Each deep-sky object's moonlight judgement should become honest: faint objects near a bright Moon marked or demoted, distant or bright ones kept. A per-user "what I want to watch" preference is not needed to fix the root cause. It could come later as a layer on top, but it is not the thing that makes Tonight truthful.

## Confidence

**HIGH.** The evidence comes from the code, the PRD, the shape notes and an engine probe, and it matches the observing convention. Two decisive narrowing answers ("depends on the person", "keep it checkable") point the same way. An independent prior occurrence (#21 item 2) diagnosed the same root cause and fixes.

## What Changes for /10x-plan

Plan a "make Tonight honest about the Moon" change, not a verdict-model or preferences change. It has three parts:

1. Keep the verdict's computation, and reword or reposition it as a sky (cloud) verdict.
2. Give the Moon a prominent block with the detailed 1%-resolution phase SVG.
3. Make deep-sky moonlight judgement depend on surface brightness and distance from the Moon. This touches the M-1 calibration and #21, so it needs its own checkpoint.

The preference toggle goes under "What We're NOT Doing", or into Parked as a possible later layer.

## References

- Code:
  - `src/lib/engine/verdict.ts:69-117`;
  - `src/lib/engine/score.ts:73-79, 123-131`;
  - `src/lib/engine/parameters.ts:57-65, 308-317`;
  - `src/lib/tonight/build.ts:419-421, 536-553`;
  - `src/components/tonight/VerdictCard.astro:53-59`, `TonightContent.astro:141-223`, `MoonCard.astro`;
  - `src/i18n/messages/en.ts:69, 74, 391-399, 665`.
- Foundation:
  - `context/foundation/prd.md:24, 38-44, 225-230, 487-490` and Business Logic;
  - `context/foundation/shape-notes.md:61-69`;
  - `context/foundation/roadmap.md:46, 110, 147, 188-190`.
- History:
  - `context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md:116-175`;
  - GitHub #21 item 2;
  - `context/archive/2026-10-01-moon-as-target/` (the bright-Moon line, ranking left unchanged by user choice).
- Investigation: three hypothesis agents (verdict meaning and PRD; ranking under a bright Moon, an engine probe that has since been deleted; per-class conditions and user intent) plus the prior-occurrence check.
