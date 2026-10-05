# Frame Brief: Visual redesign (S-10, #86)

> Framing step before /10x-plan. This document captures what is _actually_
> at issue, separated from what was initially assumed.

## Reported Observation

"Both light and dark themes are very generic and look very much like coming from an LLM. This needs to be properly redesigned." (user, 2026-10-04, `context/foundation/roadmap.md:28`)

## Initial Framing (preserved)

- **User's stated cause or approach**: the themes (light and dark) are what is generic.
- **User's proposed direction**: a proper redesign: a distinct visual identity on every screen, with red night mode keeping its function (#86).
- **Pre-dispatch narrowing** (2026-10-04): what reads as generic is **the colours, the type and the sameness of blocks**, all three. Where it shows: **everywhere equally**, with no single screen standing out.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Palette**: the navy/amber dark and paper/amber light tokens read as a stock "night app" look. ← initial framing
2. **Typography**: the Newsreader/Public Sans pairing, and the same kicker + serif h1/h2 strings on every screen with no type roles.
3. **Composition and hierarchy**: every section on every page gets one card recipe, so nothing is primary and every screen has the same rhythm.
4. **Contract architecture**: the look lives in copy-pasted class strings, not in tokens and components, so a theme change cannot reach shape, rhythm or hierarchy.

## Hypothesis Investigation

| Hypothesis                                     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Verdict                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Palette is generic (initial framing)        | User names the colours. Dark `#0b1020`/`#141b30`, amber `#f2c36b`; light paper `#f7f3ea` (`src/styles/global.css:23-30`, `:54-62`). Kept only because it was "closest to what's built, so the retrofit is mechanical" (`context/archive/2026-09-26-ui-foundation/plan-brief.md:31`).                                                                                                                                                                                                                                                                                                                  | STRONG                                                                  |
| 2. Typography is generic                       | User names the type. The fonts were set in the same retrofit (`ui-foundation/plan-brief.md:21`). There is no type-scale token (`global.css:261-313`). Kicker string ×19 and page h1 string ×~8 are copied by hand (research §2). Arbitrary sizes drift between `/design` and the live app (`design.astro:97` vs `FormField.tsx:5-6`).                                                                                                                                                                                                                                                                 | STRONG                                                                  |
| 3. Composition: every section is the same card | One recipe, `rounded-2xl border border-border bg-surface p-4 sm:p-6`, ×39 in 24 files. Gear, log, sky checks and auth each use exactly 1 surface treatment with no emphasised section (`gear/index.astro:94/132/167` byte-identical; `AuthShell.astro:22`). No section-level shadow anywhere. No full-bleed band; every page is `max-w-3xl` (`GearShell.astro:20`). Even Tonight's verdict, the product's main answer, is a 10% tint in an equal-width cell beside the Moon card (`VerdictCard.astro:40`, `TonightContent.astro:166`). A token swap would recolour this sameness without breaking it. | STRONG                                                                  |
| 4. The look is not in the contract             | `ui/` holds only `button.tsx` (4 importers). No Card, PageHeader, LinkButton, Select or Label component exists. `primaryLink` is redefined in 5 files and `selectBase` in 4. `rounded-2xl` is not tied to `--radius` (Tailwind default `1rem`, `node_modules/tailwindcss/theme.css:402`). No elevation, spacing or type token (research §1, §3).                                                                                                                                                                                                                                                      | STRONG (enabling: it explains why 1–3 can't be fixed from `global.css`) |

Counter-evidence considered: a modest type ladder exists (h1 4xl/5xl, verdict h2 3xl, section h2 2xl), Tonight groups card lists under unboxed section headers, and the landing has a real unboxed hero over a star field (`Welcome.astro:35-50`). These are hooks a redesign can build on, but none of them separates sections by surface, size or elevation, so they don't undo dimension 3.

## Narrowing Signals

- The user picked colours **and** type **and** sameness of blocks. The palette-only reading of "the themes" is therefore ruled out as the whole problem.
- "Everywhere equally" fits a system-level cause (one recipe, no components) over a per-screen cause. It also means the first `/10x-ui` pass on one view is a vehicle for the system, not the target.
- **Prior occurrence:** the only previous design pass, ui-foundation (F-03), was a colour retrofit (about 300 palette classes onto tokens) plus i18n (`ui-foundation/plan-brief.md:9-27`). Its direction was chosen _because_ it changed least. Composition, type roles and components were never designed. Repeating a token-level change would repeat that outcome.

## Cross-System Convention

A recognisable visual identity is usually carried by a design system, not a palette alone: type roles with a deliberate pairing, a small set of surface tiers (page, band, panel, inset) with elevation or layering, a radius and spacing rhythm, and a few signature components. Colour themes are then one layer of that system. The leading hypothesis matches this. The repo's own `/10x-ui` contract (tokens, then shared components, then views) is shaped the same way.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: Sidereus has no designed visual system, only a colour-token layer over screens that were never composed. Every view repeats one hand-copied card recipe with stock type roles, so any palette reads as a template.

The initial framing is right but incomplete. The themes are generic, but changing them alone would leave the same equal-weight stack of bordered cards on every screen, and the user named that sameness as part of the problem. Addressing it means each design direction has to specify composition and hierarchy (what is boxed and what isn't, surface tiers, how the primary item on a screen is emphasised), type roles and component shapes, not only colours and fonts. The contract then has to carry those as tokens and shared components, so that every view inherits them.

## Confidence

**HIGH**: strong in-repo evidence on all four dimensions, a decisive narrowing answer from the user, and a matching prior occurrence (the token-only retrofit that produced this look).

## What Changes for /10x-plan

- **The direction step:** the 2–3 directions must each show composition and hierarchy (a screen with a clear primary element, surface tiers, type roles), not just a palette and type pairing. The palettes cover light, dark and the red adaptation.
- **The contract** grows beyond colour: a type scale, surface/elevation tiers, a radius rhythm that cards actually use, and shared components (Card/Panel tiers, PageHeader, LinkButton usable from Astro, Select, Label, Chip). The guards stay green; a non-colour `:root` token goes into `red-theme.test.ts` `NON_COLOUR_TOKENS` or `@theme`.
- **S-11:** Tonight's own composition (verdict as primary) belongs to S-11's dashboard, which should be built on this contract.

## References

- Research: `context/changes/visual-redesign/research.md`
- Source files: `src/styles/global.css:19-114,261-313`; `src/pages/gear/index.astro:80-94`; `src/components/AuthShell.astro:22`; `src/components/gear/GearShell.astro:20`; `src/components/tonight/VerdictCard.astro:40`; `src/components/tonight/TonightContent.astro:166`; `src/components/Welcome.astro:35-50`
- History: `context/archive/2026-09-26-ui-foundation/plan-brief.md:9-36`
- Investigation: one composition-hypothesis worker (Step 3); dimensions 1, 2 and 4 drawn from the research workers' findings
