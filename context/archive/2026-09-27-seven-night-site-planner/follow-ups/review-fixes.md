# Follow-ups from reviews: seven-night-site-planner

Queued by `/10x-impl-review` (2026-09-27, autonomous triage under the user's delegation). None blocks merging S-05.

- **No-JS fallback for Tonight** (impl review F2, lesson "Tonight's content needs JavaScript"). With JavaScript off, `/tonight` never leaves its skeleton because `TonightContent` is a server island (`server:defer`). This was already true on `main` before S-05. Options: a `<noscript>` link to a server-rendered variant, or render the island inline when a no-JS signal is present. This needs its own change and product call (the PRD has no no-JS requirement).
- **Production CPU check after merge** (plan, Performance Considerations; impl review F1). Watch `cpuTime` / `exceededCpu` for `/_server-islands/TonightContent` in Workers observability against the upgrade trigger in `context/foundation/infrastructure.md` (warm Tonight p95 above 8 ms). Local measurement: `buildTonight` 25–26 ms cold, 4.1 ms warm, against 21–24 ms and 2.2 ms on `main`.
- **Strip failure isolation** (impl review F5, accepted). If a strip-night computation ever throws in production, build the strip in its own try so only the strip degrades, not the verdict and ranking.
