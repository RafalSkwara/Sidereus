# Grouped, icon-led facts with a spacing rhythm (ui-fact-rhythm) — Plan Brief

> Full plan: `context/changes/ui-fact-rhythm/plan.md`
> Research: `context/changes/ui-fact-rhythm/research.md`
> Plan review: `context/changes/ui-fact-rhythm/reviews/plan-review.md` (F1-F10, all applied with the owner's answers of 2026-10-14)

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
- what you'll see (an Eye in the accent colour), the eyepieces (Telescope), why (Info, muted);
- the actions.

**Spacing**: rows sit 40 px from their rule on each side, groups are 24 px apart, lines 8 px.

**Events and Nights** get quiet overline labels and one icon-led fact per line.

**Contract**: `/design` shows everything, a guard test keeps numeric spacing out of the family, and CLAUDE.md names the roles and components.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Grouping | Stat pair for Window and Best, ruled facts for the rest, the hairline, no box around the item | The owner's merge of 1A and 1B | Audit (owner) |
| Icons | Facts only, from one concept-keyed map (`src/components/ui/fact-icons.ts`) that absorbs S-07's kinds; one Moon icon everywhere, the Eye only for "what you'll see", CircleCheck/CircleSlash for Visible | Decision 2B; one concept, one icon | Audit + review F7 (owner) |
| Desktop | Only the pair is side by side, capped at `max-w-md` from `sm` | Decision 5; uncapped cards float values in wide boxes | Audit + experiment |
| Roles (D1) | `line` 8, `group` 24, `item` 40 px in `@theme inline`, fixed at every width; one-group rows `py-group` | The owner chose a looser rhythm than the default 8/20/32 | Owner |
| Overline (D2) | 13 px, weight 600, tracking 0.04em, sentence case, muted | Uppercase Polish dates would shout | Plan |
| Stat card (D3) | The gear cards' bordered surface, keeping the faint border in red (the fill is invisible there, 1.03:1); Best's direction on a second line; the shorter Window card stretches | Not a new card language; one line wraps at 320 px | Experiment + review F8 (owner) |
| 320 px rows (F2) | Measure first: Phase 1 shows the pair in a Targets expanded-row frame with fallbacks (a) as planned, (b) `text-label` value, (c) no `pl-10` indent, then stops for the owner | About 79 px of text per card in an opened row at 320 px | Review F2 (owner) |
| Fact icons (D4) | Muted, except the accent Eye on "what you'll see" and the amber safety icon; the event kind icon keeps heading ink | The audit's complaint was that the expect line looks like its neighbours | Review F9 (owner) |
| Order (D5) | Identity, pair, hairline, see, eyepieces, why | "When", then "what and how"; the Moon's note moves up | Plan |
| Planet copy (D6) | Labels Brightness / Apparent size / Phase / Rings (PL Jasność / Średnica kątowa / Faza / Pierścienie); label-free values | Labels must not repeat inside values ("jasność −1,9 mag") | Research + Plan |
| Events (D7) | Kind icon kept; each detail on its own line | One fact per line | Plan |
| Nights reason (D8) | Icons and roles now; short wording deferred | Seven shared reason variants; real nights differ | Research |

The owner kept every default except D1 (looser rhythm), and answered the review's F2, F7, F8 and F9 as above.

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
| 1. Contract | Roles, overline, icon map, Fact/FactList/StatCard/StatPair, `/design` specimens, the first guard; **stops for the owner's 320 px choice** | The pair in an opened row at 320 px |
| 2. Planet copy | Labels plus label-free values, `build.test` updated; lands with Phase 3's first commit | None material |
| 3. Targets, Planets, Moon, finder line | The rhythm on the most-used view, the skeleton following it | Exact-text markers; whitespace in slots; the S-08 rebase |
| 4. Events and Nights | Overline labels, one fact per line | `ol > li` counts and exact sentences in e2e |
| 5. Guard, rules, gate | The guard's break check, CLAUDE.md, before/after, the whole e2e suite and smoke | None new |

**Prerequisites:**
- main with ui-quiet-actions (c650a8a);
- a local Supabase stack, preview on 4331, forecast fixture on 4401, keys inline only, never `test:db`;
- S-08 not merged (rebase rules in the plan).

**Estimated effort:** about 2-3 sessions across 5 phases.

## Open Risks & Assumptions

- **S-08 overlap.** S-08 (HEAD 8bc0c1b, Phase 5 uncommitted) will likely merge first. It edits the same washed-out `<li>` line (merged result in the plan), `ObjectRow`'s root `<li>`, `ObjectCard` (`data-object-card`), `TonightPageSkeleton`'s plan branch, `design.astro`, `en.ts`/`pl.ts`, `helpers.ts` and CLAUDE.md. Its new row ids break `what-to-expect.spec.ts:92-101`, which S-08 narrows on its side.
- **Page length.** With item 40 the Targets page grows about 20% at 390 px (estimated; the experiment's item 32 measured +13%). That is the owner's looser rhythm, and the owner sees it in the before/after.
- **Red mode.** The stat card's fill is invisible in red (1.03:1), and the faint border carries the shape, as on the gear cards (owner, F8). The overline drops from 5.2:1 to 3.3:1 in red, still above the pinned 3:1.

## Success Criteria (Summary)

- A beginner can tell "when", "what" and "how" apart at a glance on every Tonight item list, in every theme and language.
- Window and Best are the first thing read, and a planet's numbers say what they are.
- The next agent cannot reintroduce per-file spacing without the guard failing, and finds the components in CLAUDE.md and `/design`.
