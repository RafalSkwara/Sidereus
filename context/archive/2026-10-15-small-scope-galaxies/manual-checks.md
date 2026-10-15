# Small-scope galaxies: manual checks (owner)

Four checks for the owner. Each one reads a line on the Targets page. The agent ran them on 2026-10-15 with evidence (the owner's standing rule); the results are below each check.

## How the agent ran them

- **Server:** a fresh `npm run build`, previewed on port 4333, with `dist/server/.dev.vars` pointing at the local Supabase and at the forecast fixture on port 4400 (all clear). Local keys were passed inline on the commands only.
- **Script:** `evidence/owner-checks.spec.ts.txt`, a temporary Playwright script, run from `tests/e2e` and then moved out of the suite.
  - It signs up a fresh user and onboards in Madrid.
  - It grants the full plan with `npm run account:plan`.
  - Through the user's own Supabase session it moves the site to Warsaw (52.23 N, 21.01 E, Europe/Warsaw, the calibration and guard site) and sets the Bortle class and the telescope (aperture, f/5) for each check.
  - It opens `/tonight/targets?sort=rank` (the default order, with the rest of the list open) and reads each object's markers: `li[data-object-card]` for the best five, `data-expect` for the line, and the details paragraph for the reason line.
  - Screenshots are 430 px wide.
- **Fixed date:** the Targets page reads the server's real clock (`src/lib/tonight/island.ts:55`), and its only night choice is `?night=next`, so no other night can be picked on the page. The page checks therefore ran on the night of 2026-10-15 (Warsaw), the day of the run, recorded here.
- **April (check 2):** an April night cannot be reached in the page without a server clock override, which is out of scope. It was checked at engine level on 2026-04-15 with the same inputs the Targets island passes to `rankObjects`: Warsaw, minimum altitude 15°, the dark window for the Bortle class, f/5, unlimited list. That is the same setup as guard G1 in `src/lib/engine/small-scope.test.ts`.

## Setup

- A fresh production build, served as a local preview on port 4333.
- The all-clear forecast fixture on port 4400.
- Local Supabase running.
- A full plan for your test account, from `npm run account:plan -- <email> full`. Pass the local secret key inline on that command only. Never export it, and never give it to the preview.
- Ports 4331, 4343 and 4401 belong to other agents. Do not use them.

## Checks

1. **60 mm at a Bortle 6 site, M31.** Set the telescope to 60 mm and the site to Bortle 6. On a night with M31 in the targets, its line reads "A faint grey smudge with a slightly brighter middle", not "very faint". If its reason line says "Bright for your 60 mm", the two now agree. The reason line is picked against the other listed targets, so it may name something else.
   - Result: **PASS** (night of 2026-10-15, Warsaw, Bortle 6, 60/300 mm).
     - M31 is #1 in the best five (M31, M45, NGC869, M34, M39), with `data-expect="galaxySmudge"`.
     - EN: "A faint grey smudge with a slightly brighter middle." beside the reason "Up for 10 h 14 min of the dark window · bright for your 60 mm". This is the #159 setting, and the two lines now agree.
     - PL: "Słaba szara plamka z nieco jaśniejszym środkiem." beside "Na niebie przez 10 godz. 14 min w oknie ciemności · jasny obiekt dla Twoich 60 mm".
     - Screenshots: `evidence/check1-m31-60mm-b6-en.png`, `evidence/check1-m31-60mm-b6-pl.png`.

2. **60 mm at Bortle 6, April night, M101.** On an April night, M101 is not among the top five targets.
   - Result: **PASS**.
     - **Engine level, 2026-04-15, Warsaw** (`evidence/check2-april-engine.txt`). The best five is M3, M13, M92, M81, M53 in every case below, and M101's reason is never "bright".

       | Bortle | Aperture | M101 rank | Rank score | Line |
       |---|---|---|---|---|
       | 6 | 60 mm | #17 | 0.7533 | `galaxyLimit` |
       | 6 | 80 mm | #26 | 0.7533 | `galaxyLimit` |
       | 5 | 60 mm | #17 | 0.7850 | `galaxyFaint` |
       | 5 | 80 mm | #21 | 0.7850 | `galaxyFaint` |

       Before this change M101 was #6 in all four.
     - **Page level, night of 2026-10-15, Bortle 6, 60 mm:** M101 is not in the best five (M31, M45, NGC869, M34, M39). Screenshot `evidence/check2-top5-60mm-b6-en.png`.

3. **150 mm at Bortle 4, M31.** M31 still reads "An oval glow with a bright centre".
   - Result: **PASS** (night of 2026-10-15, Warsaw, Bortle 4, 150/750 mm).
     - M31 is #1 in the best five (M31, M34, NGC869, M33, M39), with `data-expect="galaxyBright"`.
     - Line: "An oval glow with a bright centre, easy to see straight on." beside "Up for 9 h 35 min of the dark window · bright for your 150 mm".
     - Screenshot: `evidence/check3-m31-150mm-b4-en.png`.

4. **60 mm at Bortle 8 (the "city" preset), M31.** M31 reads "A very faint grey smudge; use averted vision" and is not in the top five. This is the owner's accepted outcome (plan review F6, 2026-10-15), not a defect.
   - Result: **PASS** (night of 2026-10-15, Warsaw, Bortle 8, 60/300 mm).
     - The best five is M45, NGC869, M34, M39, M52. M31 is #13 in the rest of the list, with `data-expect="galaxyFaint"`.
     - Line: "A very faint grey smudge; use averted vision." Its reason line no longer says "bright": "Up for 10 h 54 min of the dark window · holds up better in moonlight than the rest".
     - Screenshots: `evidence/check4-top5-60mm-b8-en.png`, `evidence/check4-m31-60mm-b8-en.png`.
