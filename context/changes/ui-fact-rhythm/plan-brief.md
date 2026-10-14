# Grouped, icon-led facts with a spacing rhythm (ui-fact-rhythm) — Plan Brief

> Full plan: `context/changes/ui-fact-rhythm/plan.md`
> Research: `context/changes/ui-fact-rhythm/research.md`

## What & Why

The owner asked for data points that are separated more visibly, with more whitespace and more icons (ui-refine audit, findings 2, 4, 5, 8 and 9). On Targets, Planets, the Moon, Sky events and Nights, every fact sits at one size, weight and colour, with no grouping. This change gives those lists a rhythm, following the owner's decisions 2, 3 and 5:

- Window and Best as two small stat cards side by side;
- every other fact one icon-led line;
- a hairline between "when" and "what and how";
- spacing from three roles.

## Starting Point

The colour, type and radius tokens hold (0 literal hits in the 15 view files), but the next layer is missing:

- **Spacing**: 43 distinct utilities, with six spellings for "between lines".
- **Components**: no shared fact or stat component.
- **Group labels**: four spellings.
- **Icons**: no icon vocabulary (S-07 keeps its own map).
- **Planet facts**: unlabelled ("34″").

The reverted experiment (`evidence/exp-stat-cards/`) proved the merged 1A plus 1B direction in all three themes.

## Desired End State

**Each target, planet and Moon target** reads as:

- its identity (a planet adds its labelled facts);
- the stat pair: Window "20:51–07:10"; Best "03:21" over "NNE, 87°";
- a hairline;
- what you'll see (Eye), the eyepieces (Telescope), why (Info, muted);
- the actions.

**Spacing**: items are 32 px apart, groups 20 px, lines 8 px.

**Events and Nights** get quiet overline labels and one icon-led fact per line.

**Contract**: `/design` shows everything, a guard test keeps numeric spacing out of the family, and CLAUDE.md names the roles and components.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Grouping | Stat pair for Window and Best, ruled facts for the rest, the hairline, no box around the item | The owner's merge of 1A and 1B | Audit (owner) |
| Icons | Facts only, from one map (`src/lib/ui/fact-icons.ts`) that absorbs S-07's kinds | Decision 2B; one concept, one icon | Audit (owner) |
| Desktop | Only the pair is side by side, capped at `max-w-md` from `sm` | Decision 5; uncapped cards float values in wide boxes | Audit + experiment |
| Roles (D1) | `line` 8, `group` 20, `item` 32 px in `@theme inline`; one-group rows `py-group` | Three clearly different steps; Tailwind 4.3.3 publishes them as utilities | Research + Plan |
| Overline (D2) | 13 px, weight 600, tracking 0.04em, sentence case, muted | Uppercase Polish dates would shout | Plan |
| Stat card (D3) | The gear cards' bordered surface; Best's direction on a second line | Not a new card language; one line wraps at 320 px | Experiment |
| Fact icons (D4) | All muted; safety keeps amber; the event kind icon keeps heading ink | A calm vocabulary; the expect line keeps first place and foreground ink | Plan |
| Order (D5) | Identity, pair, hairline, see, eyepieces, why | "When", then "what and how"; the Moon's note moves up | Plan |
| Planet copy (D6) | Labels Brightness / Apparent size / Phase / Rings (PL Jasność / Średnica kątowa / Faza / Pierścienie); label-free values | Labels must not repeat inside values ("jasność −1,9 mag") | Research + Plan |
| Events (D7) | Kind icon kept; each detail on its own line | One fact per line | Plan |
| Nights reason (D8) | Icons and roles now; short wording deferred | Seven shared reason variants; real nights differ | Research |

D1-D8 are the agent's defaults. The owner confirms them at plan review.

## Scope

**In scope:**
- the roles, the overline, the icon map;
- `Fact`, `FactList`, `StatCard`, `StatPair`;
- the Targets, Planets and Moon details;
- the finder's expect line;
- `SkyEventList`, `NightStrip`;
- the planet labels in EN and PL;
- `/design` specimens, the guard test, the CLAUDE.md rules;
- the before/after evidence.

**Out of scope:**
- the dashboard (change 3);
- navigation (change 4);
- /log, /log/progress and /gear (change 5);
- the plan page (S-08 in parallel);
- splitting the targets' reason;
- a short Nights reason;
- new colour tokens;
- `buttonVariants`.

## Architecture / Approach

The /10x-ui order: the contract first (tokens, the map, the four components, `/design`), then the copy the labels need, then the views, then the guard, the rules and the gate.

Views pass content; the components own the icons and the rhythm. Markers that e2e reads exactly (`data-expect`, `data-event-visibility`) move onto the `Fact` root, whose only text is the sentence.

UI code runs in Opus subagents at high effort. Non-UI code (copy with the view model, the guard) runs in Sonnet at high effort. Docs and capture run in Sonnet at medium effort.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Contract | Roles, overline, icon map, Fact/FactList/StatCard/StatPair, `/design` specimens | The pair at 320 px in Polish |
| 2. Planet copy | Labels plus label-free values, `build.test` updated | Polish wording (owner review) |
| 3. Targets, Planets, Moon, finder line | The rhythm on the most-used view | Exact-text markers; whitespace in slots |
| 4. Events and Nights | Overline labels, one fact per line | `ol > li` counts and exact sentences in e2e |
| 5. Guard, rules, gate | Rhythm guard, CLAUDE.md, before/after, the whole e2e suite and smoke | Overlap with S-08 on a rebase |

**Prerequisites:**
- main with ui-quiet-actions (c650a8a);
- a local Supabase stack, preview on 4331, forecast fixture on 4401, keys inline only, never `test:db`;
- S-08 not merged (rebase rules in the plan).

**Estimated effort:** about 2-3 sessions across 5 phases.

## Open Risks & Assumptions

- **S-08 overlap.** Both changes edit `ObjectRow`, `TargetsPageContent`, `design.astro`, `en.ts`/`pl.ts`, `tonight-phone.spec.ts` and CLAUDE.md. Whichever merges second keeps S-08's row ids and both sets of keys.
- **Page length.** The Targets page grows about 13% at 390 px. That is the owner's "more room", but the owner sees it in the before/after.
- **Red mode.** The stat card's border is faint in red, and its fill carries the shape, as on the gear cards.

## Success Criteria (Summary)

- A beginner can tell "when", "what" and "how" apart at a glance on every Tonight item list, in every theme and language.
- Window and Best are the first thing read, and a planet's numbers say what they are.
- The next agent cannot reintroduce per-file spacing without the guard failing, and finds the components in CLAUDE.md and `/design`.
