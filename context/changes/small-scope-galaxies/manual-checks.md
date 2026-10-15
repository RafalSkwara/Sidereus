# Small-scope galaxies: manual checks (owner)

Four checks for the owner. Each one reads a line on the Targets page, so no screenshots are needed. Write the result after each check.

## Setup

- A fresh production build, served as a local preview on port 4333.
- The all-clear forecast fixture on port 4400.
- Local Supabase running.
- A full plan for your test account, from `npm run account:plan -- <email> full`. Pass the local secret key inline on that command only. Never export it, and never give it to the preview.
- Ports 4331, 4343 and 4401 belong to other agents. Do not use them.

## Checks

1. **60 mm at a Bortle 6 site, M31.** Set the telescope to 60 mm and the site to Bortle 6. On a night with M31 in the targets, its line reads "A faint grey smudge with a slightly brighter middle", not "very faint". If its reason line says "Bright for your 60 mm", the two now agree. The reason line is picked against the other listed targets, so it may name something else.
   - Result:

2. **60 mm at Bortle 6, April night, M101.** On an April night, M101 is not among the top five targets.
   - Result:

3. **150 mm at Bortle 4, M31.** M31 still reads "An oval glow with a bright centre".
   - Result:

4. **60 mm at Bortle 8 (the "city" preset), M31.** M31 reads "A very faint grey smudge; use averted vision" and is not in the top five. This is the owner's accepted outcome (plan review F6, 2026-10-15), not a defect.
   - Result:
