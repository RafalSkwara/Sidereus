---
change_id: ui-log
title: Log views in Nightfall (/10x-ui pass)
status: implementing
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Notes

- Part of S-10 `visual-redesign` (#86): one of the four remaining `/10x-ui` passes (log, auth, onboarding, landing), run concurrently in separate worktrees on 2026-10-05.
- **View:** the log area: `/log` (list, `src/pages/log/index.astro`), `/log/new`, `/log/[id]` (edit) and `/log/sky` (`src/pages/log/*`), plus the components only they render: `src/components/observations/{ObservationForm,TargetPicker}.tsx`, `src/components/sky-checks/SkyTally.astro` (and `SkyAnswerForm.astro`, shared with Tonight's `SkyCheckCard`, left unchanged).
- **Token source:** `src/styles/global.css` (theme blocks, published through `@theme inline`). Components: `src/components/ui/` and `src/components/forms/`. Reference views: `/gear` and `/tonight`.
- **Contract variant:** existing design system (Nightfall), extended minimally. No new palette.
- **Pre-audit (2026-10-05):** 0 literal colours; 6 arbitrary values (`tracking-[0.18em]` ×3, `ring-[3px]` ×3); 56 raw type sizes (`text-xs` … `text-5xl`) instead of the type roles; 11 boxed `rounded-2xl` cards; 12 imports from `ui/` / `forms/` across 8 files, no `PageHeader` or `Band` anywhere and `BackLink` on one page only.
- **Delegated (autonomous run):** every non-UI choice in this change is decided by the agent and recorded as "delegated" in plan.md.
