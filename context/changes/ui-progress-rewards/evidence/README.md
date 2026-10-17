# Evidence

Only a handful of key screenshots are committed, as compressed WebP (about 1.5 MB in all): the full set of PNGs (owner-question mockups, badge-art sheets in every theme, the whole impl screenshot gate, about 21 MB) stayed out of git history on purpose (orchestrator, 2026-10-17). Re-create them locally:

- badge art: `node context/changes/ui-progress-rewards/evidence/badge-art/render.mjs` (no server needed) writes `badge-art-sheet.png`, `badge-art-phone-*.png` and `badge-art-desktop-*.png` here; don't commit the PNGs.
- the screenshot gate: the steps in `plan.md` Phase 4 against a preview build.

Committed:

- `impl/page-en-{dark,red,light}-390.webp`, `impl/page-pl-dark-320.webp`, `impl/page-en-dark-1440.webp`: the progress page, full height (Caldwell and "Seen so far" closed).
- `impl/caldwell-open-red-390.webp`: the Caldwell band opened, red.
- `impl/dialog-red-390.webp`, `impl/dialog-dark-1440.webp`: the celebration dialog with badges.
- `impl/design-c-milestone-badge-red-390.webp`: the `/design` badge specimens, red.
- `badge-art/badge-art-sheet.webp`, `badge-art/badge-art-phone-{red,light}.webp`: the approved art (round 1, after the art decisions).
