---
change_id: ui-auth
title: Auth views in Nightfall (/10x-ui pass on sign-in and sign-up)
status: implemented
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Notes

- **/10x-ui target:** `/auth/signin` and `/auth/signup` (`src/pages/auth/signin.astro`, `signup.astro`), rendered in `src/components/AuthShell.astro` with the forms in `src/components/auth/`. `confirm-email.astro` shares the shell and follows it.
- **Token source:** `src/styles/global.css` (theme blocks, published through `@theme inline`); components in `src/components/ui/` and `src/components/forms/`.
- **Contract variant:** existing design system (Nightfall, S-10 `visual-redesign`, #86). Extend, never fork; `/gear` and `/tonight` are the reference views.
- **Pre-audit (2026-10-05):** 0 literal colours, 0 arbitrary values, 0 palette classes in the 6 auth files; 9 stock Tailwind sizes or off-role classes (`text-3xl`, `text-5xl`, `text-sm`, `text-xs`, `rounded-2xl`, `text-primary` as a link colour). The forms already read `FormField` / `SubmitButton` / `ServerError`; the pages import nothing from `src/components/ui/`.
- **Scope rule:** a visual pass only. Routes, error-key mapping, `safeNextPath` and `next` handling stay as they are.
- Run as one of four concurrent `/10x-ui` passes (log, auth, onboarding, landing) that close S-10; part of #86.
