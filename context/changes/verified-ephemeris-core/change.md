---
change_id: verified-ephemeris-core
title: Verified ephemeris core - Messier catalogue, night model, sun/moon/object positions
status: implemented
created: 2026-09-22
updated: 2026-09-24
archived_at: null
---

## Notes

Roadmap item F-01 (`context/foundation/roadmap.md`), milestone M-1. Tracked on the GitHub Projects board "Sidereus Roadmap" as issue #3 (https://github.com/RafalSkwara/Sidereus/issues/3). Foundation, not user-visible: unlocks S-02 (ranking), S-04 (no-darkness explanation), S-05 (nights 4-7 moon/darkness data).
- 2026-09-24, Phase 3 manual gate: the user spot-checked several engine-predicted moon and object positions against Stellarium ("roughly correct, in fact surprisingly correct") and accepted 3.4/3.5 on that basis without recording the values. The `moon`/`objects` fixture sections therefore remain `pending` (6 todos in `npm test`); the sun sections are fully captured (all within 1 min). Phase 4's criterion "zero todo fixtures remaining" cannot be met honestly until those values are recorded — decision deferred to Phase 4.
- Fixtures and capture protocol: `src/lib/engine/fixtures/README.md`, values in `src/lib/engine/fixtures/stellarium/*.json` (sun sections captured 2026-09-24; moon/objects pending).
- Tolerance report: `context/changes/verified-ephemeris-core/tolerance-report.md` (regenerate the numbers with `npm test -- --reporter=verbose` and read the `[tolerance]` lines).
