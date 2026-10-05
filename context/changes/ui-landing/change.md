---
change_id: ui-landing
title: Landing page in Nightfall, signed-out only
status: implemented
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Notes

/10x-ui pass on the landing view `/` (`src/pages/index.astro` + `src/components/Welcome.astro`) against the existing Nightfall contract (`src/styles/global.css`, `src/components/ui`). Includes the signed-in redirect from `/` to `/tonight` decided 2026-10-04 (`roadmap.md` S-10 open question, `context/changes/visual-redesign/change.md`). Part of S-10 visual-redesign (#86).

- **View:** `/` only (`src/pages/index.astro`, the `Welcome` shell and what it renders).
- **Contract variant:** existing design system. Values from the Nightfall theme blocks in `src/styles/global.css`, components from `src/components/ui/`; reference views `/gear` (sky header + ruled `Band`s) and `/tonight` (`TonightSky`, the Nightfall signature). No new palette.
- Runs autonomously, concurrently with three other /10x-ui passes (log, auth, onboarding) in their own worktrees. Non-UI choices are recorded as delegated below; visual judgement calls go into the PR body under "Visual choices for review".

## Delegated decisions

- **Plan interview (complexity LOW, 0 questions):** research settled every material choice; run autonomously, so the plan's structure was self-approved.
- **Redirect location:** in `src/pages/index.astro` (`Astro.redirect("/tonight")`, 302), not the middleware: the rule belongs to one page and the middleware stays about gating. A 302 (not 301) because the answer depends on the session.
- **Topbar logo** keeps linking to `/` (no shared-file edit while three other passes run); signed-in users take one extra redirect hop.
- **Dead copy:** `landing.openTonight` removed from both catalogues (unreachable after the redirect).
- **Screenshot:** recaptured with the existing opt-in spec (`CAPTURE_LANDING=1`), English/dark/1280×800 as before; one image for every locale and theme.
- **Tests:** one modest e2e spec (`tests/e2e/landing.spec.ts`) pins the redirect and the CTA targets; visuals are screenshot evidence.
- **Node:** the worktree guard refused `. "$NVM_DIR/nvm.sh"`, so every node command ran with `PATH=$HOME/.nvm/versions/node/v24.21.0/bin:$PATH` (the `.nvmrc` version; same effect as `nvm use`).
