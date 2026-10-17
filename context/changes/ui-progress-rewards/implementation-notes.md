# Implementation notes — ui-progress-rewards

## Checklist markup budget (Phase 3, plan criterion 3.6)

Measured on the production preview build (`npm run build`, `astro preview`), signed in, `/log/progress` in English,
with a temporary probe spec (deleted): the summed `outerHTML` length of the two `[data-checklist-grid]` blocks plus
the sprite (`[data-object-type-sprite]`, after only), raw characters and gzip (Node `zlib`, default level).

| State                        | Before (chips) raw | Before gzip | After (tiles + sprite) raw | After gzip |
| ---------------------------- | -----------------: | ----------: | -------------------------: | ---------: |
| Journey state, 1 seen (M31)  |             47,640 |       3,025 |                    103,758 |      4,926 |
| 37 Messier + 6 Caldwell seen |             61,206 |       3,204 |                    111,318 |      5,298 |

The plan's estimate was 95–110 KB raw and 6–9 KB gzip; the result is inside the raw range and under the gzip one.
Phase 4 pins the journey's own state (1 seen, step 3) at the measured value plus about 10 %: **114,000 characters**.

For context (not pinned): the Milestones band with the 11 badges (Phase 2) is 80,680 raw / 12,155 gzip with 1 seen
(82,850 / 12,312 with the 37-object log); the whole document went from 166,865 / 24,216 (Phase 2 build, chips) to
234,294 / 27,776 (1 seen).

## Phone scroll height at 390 px (37 Messier + 6 Caldwell seen)

| Build                                     | `scrollHeight` |
| ----------------------------------------- | -------------: |
| Before (chips, Seen so far lists open)    |       5,945 px |
| After, Caldwell and the Seen lists closed |       6,349 px |
| After, every `<details>` open             |      11,710 px |

With P8 A (Caldwell and both "Seen so far" lists closed) the page grows by about 400 px over the chips, Messier's 55
tile rows less the two seen lists that used to sit open.

## Final verification (Phase 4, 2026-10-17)

Against a fresh `npm run build` previewed on port 4345, the forecast fixture on 4346 and the local Supabase stack (keys
inline on the commands only):

- `npx eslint . --max-warnings 0` (the `npm run lint` equivalent), `npx astro check` (0 errors, 0 warnings), `npm test`
  (813 passed, 1 skipped), `npm run test:guards` (52 passed), `npm run build`: green.
- The whole e2e suite: 63 passed, no retries. `npm run smoke`: 75 steps passed, none failed or skipped.
- `tests/e2e/observing-milestones.spec.ts` with `--repeat-each=3`: 6 of 6 passed. Break check: with every tile's
  sentence forced to "seen", step 2 went red ("…, galaxy, not seen" expected); restored.
- Rhythm guard break check: an `mt-4` in `ChecklistLegend` went red; restored.
- The `/10x-ui` hardcoded-value grep over `src/pages/log/progress.astro`, `src/components/progress/**`,
  `src/components/ui/Band.astro` and `src/lib/progress/object-family.ts`: 0 hits.
- Keyboard (probe): the Caldwell band is closed on load, Enter on its summary opens and closes it, Space opens a "Seen
  so far" list, and a reload closes them again. Accessibility tree: the M31 tile reads
  `listitem: M31, Andromeda Galaxy, galaxy, seen`; a closed band's tiles are out of the tree until opened.
- Screenshots in `evidence/impl/`: the signed-in page with the 37-object log (`page-en-{dark,light,red}-{390,1440}`,
  `page-pl-{dark,light,red}-320`), the Caldwell band opened (`caldwell-open-*`), the live dialog with three badges
  (`dialog-*`), and `/design`'s blocks (`design-c-{progress-icons,milestone-badge,milestone-celebration}-*-{390,1440}`,
  `design-c-checklist-*-390`). The plan named `evidence/after/`; the lead asked for `evidence/impl/`.

## Deviation: the art is picked by a switch, not a `MILESTONE_ART` record (impl review F7)

Phase 2 planned `badge-art/index.ts` with `MILESTONE_ART: Readonly<Record<MilestoneKey, AstroComponent>>`. The
type-aware lint types an .astro component used as a value as `error`, so the record failed `no-unsafe-assignment` in a
`.ts` module and in an .astro frontmatter alike. `MilestoneBadge` renders the art through an exhaustive `switch` in its
template whose `never` default fails `astro check` on a milestone without art: the same guarantee the record gave.
