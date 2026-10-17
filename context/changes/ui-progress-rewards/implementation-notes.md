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
