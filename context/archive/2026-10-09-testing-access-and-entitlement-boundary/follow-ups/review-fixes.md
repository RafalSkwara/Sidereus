# Review follow-ups: testing-access-and-entitlement-boundary

From `reviews/impl-review.md` (2026-10-09).

## F3 — Lint client `<script>` blocks in .astro files (owner chose Fix B: document now, separate change)

- **Problem:** eslint-plugin-astro lints each client `<script>` as a virtual `X.astro/1.ts`, which inherits `projectService: true` from `baseConfig`; the project service cannot find it, the parse fails, and the plugin's postprocess drops the error, so no rule runs on those scripts. `calculateConfigForFile` still reports `no-console` at error, so `no-console-guard.test.ts` passes. 8 files have scripts today (Layout, GearCard, Notice, ToastRegion, design, offline, tonight/targets, tonight/planets); none logs.
- **Proposed change:** a config for `**/*.astro/*.{ts,js}` extending `tseslint.configs.disableTypeChecked` with `parserOptions: { projectService: false, project: null }`, fix whatever lint findings it surfaces in the 8 scripts, and add an end-to-end case to the guard that lints an in-memory `.astro` with `<script>console.log(1)</script>` and expects one `no-console` error. Then drop the "not linted yet" notes from CLAUDE.md, test-plan §6.4 and the guard header.
- **Documented in:** CLAUDE.md coordinates tripwire, test-plan §6.4 Blind spots, `src/lib/no-console-guard.test.ts` header.
