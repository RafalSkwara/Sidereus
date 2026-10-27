# Evidence: structure, checked with dependency-cruiser

This is a second structural pass over the repo map. The lesson's tool, dependency-cruiser 18.7.0, is now a devDependency (`f0965f5`). The pass checks every structural claim in `repo-map.md` and `evidence/3-structure.md` against it. It does not rewrite either file: proposed edits are at the end, for the owner to approve.

Labels, as in `3-structure.md`: **evidence** (from a command in this run), **inference** (my reading of evidence), **unknown** (outside what the tool can see).

Raw outputs: `context/map/evidence/depcruise/` (68 KB, text only). The JSON results (0.7–1.1 MB each) are not committed; the commands below regenerate them.

## How it was run

| Run | What it is | Output |
|---|---|---|
| **native** | `npx depcruise src scripts --config .dependency-cruiser.cjs`: the committed config, as anyone would run it | `rules-head-native.txt` (`-T err`), `summary-head-native.txt` |
| **astro shim, HEAD** | `node context/map/evidence/depcruise/astro-shim.mjs <mirror> <out.json>`: the same config over a mirror tree where each `X.astro` becomes `X.astro.ts` (frontmatter + `<script>` blocks); the output is renamed back to `.astro` | `rules-head-astro-shim.txt` (`depcruise-fmt -T err`), `summary-head.txt`, `reaches-head.txt`, `metrics-folders-head.txt` (`-T metrics`, folder rows) |
| **astro shim, 321427c** | the same over `git archive 321427c src scripts`: the map's own HEAD, for an apples-to-apples check | `summary-321427c.txt` |

`summary-*.txt` come from `depcruise/analyse.mjs <result.json>`. It counts the JSON: runtime vs type-only file edges, isolates, runtime cycles (Tarjan), file-level runtime Ca/Ce, runtime reach (reverse BFS) for 21 hubs, boundary edge counts and folder pairs. `reaches-head.txt` is dependency-cruiser's own `--reaches` per hub, which follows type-only edges too.

Config (`.dependency-cruiser.cjs`, evidence):
- `tsConfig: tsconfig.json`, so the `@/*` alias resolves.
- `tsPreCompilationDeps: true`, so `import type` edges are seen and tagged `type-only`.
- `includeOnly` `src/`, `scripts/`, `node_modules/`; `doNotFollow` `node_modules`.
- Excluded as the map's noise rules: `*.test|spec.*`, `tests/`, `src/lib/test-support/`, `src/lib/engine/fixtures/`, `database.types.ts`, every `.json` (catalogue, gear catalogue, `scripts/data`).
- 15 rules:
  - cycles: runtime, and type-only (info);
  - orphans;
  - engine purity, plus type-only edges out of the engine (info);
  - islands: `.tsx` → server-only, and `.tsx` → an engine module other than `parameters`;
  - `sky-view` browser-only;
  - `finder-stars` server-only;
  - `stars.ts` ↛ catalogue barrel;
  - client observability ↛ server modules;
  - `sw.ts` never reaches the client barrel or `log-failure` (reachability rule);
  - `lib` ↛ `components`;
  - nothing → `pages`;
  - `api-errors` → `auth`;
  - `scripts` → `src`.
- ESLint: the root `.cjs` is outside the tsconfig project service, so `eslint.config.js` gained a small `cjsConfig` that lints `*.cjs` without type information. `npm run lint` stays green.

## What dependency-cruiser can and cannot see

- **`.astro` (evidence).** dependency-cruiser has no Astro parser. `extraExtensionsToScan: [".astro"]` makes each `.astro` file a node, so edges *into* it from `.ts`, `.tsx` or another `.astro` resolve. Its own frontmatter and `<script>` imports are not extracted. `tsPreCompilationDeps` does not help: it only decides whether type-only imports are kept. Effect at HEAD:
  - The native run sees 562 of 1,296 runtime file edges (43%) and 204 of 254 type-only edges.
  - It reports 91 orphans, 82 of them `.astro` files that only look unused.
  - The 49 pages and routes are mostly `.astro` files, so page reach is meaningless without the shim.
- **The astro shim (evidence).** It extracts the same 124 chunks as the map's TypeScript run: 110 frontmatters and 14 `<script>` tags, one of them `is:inline`. On `321427c` it reproduces the map's graph (next section). Template usage needs no extraction, because an Astro component used in a template must be imported in the frontmatter. There are no `import.meta.glob` or `Astro.glob` calls (`rg`, 0 hits). Inference: the shim run's coverage of static `.astro` edges equals the map's.
- **Virtual modules (evidence).** `cloudflare:workers`, `astro:env/server` and `astro:middleware` do not resolve, and the config's `includeOnly` drops them silently. Overriding it (`-I "^(src/|cloudflare:|astro:)"`) lists them as unresolved: 7 imports in 6 files (`supabase.ts`, `config-status.ts`, `tonight/island.ts`, `middleware.ts` ×2, `forecast/kv-cache.ts`, `observability/rate-limit.ts`). `rg "from ['\"](astro|cloudflare):"` finds the same 7.
- **Two classification quirks (evidence).**
  - dependency-cruiser tags `import X, { type Y } from "m"` exactly like `import type { Y } from "m"` (`type-only` + `import`). The two production cases (`SiteForm.tsx:4`, `OnboardingWizard.tsx:6` → `LocationPicker.tsx`) are runtime edges that a `dependencyTypesNot: ["type-only"]` rule would miss.
  - It keeps one entry per specifier, so `LocationPicker.tsx`'s `typeof import("./map-panel")` (:58) and its real `import("./map-panel")` (:63) merge into one `type-import` edge, and the dynamic import is not tagged `dynamic-import`.
  - `analyse.mjs` restores all three edges as runtime, by name.
- **Still not seen (unknown):** `Astro.locals` wiring, the `/_server-islands/*` URL surface, SQL/RLS/RPCs, CI, `wrangler.jsonc`, the service-worker build (`build-sw.mjs` bundles `src/sw.ts` by path), the Python oracles and their JSON fixtures, the generated JSON (excluded on purpose), and HTTP callers. These are the same blind spots as `3-structure.md`.

## Reconciliation with the map's graph at 321427c

| Map (`3-structure.md:16`) | dependency-cruiser + shim at `321427c` | Reading |
|---|---|---|
| 352 production files | 353 code files (+ `global.css` as a node) | evidence: same file set as `git ls-tree 321427c` under the noise rules. Inference: the map left out one file, probably `src/env.d.ts` (declarations only) |
| 1,285 runtime + 8 build | 1,293 runtime (8 of them `scripts/` → `scripts/`) | **equal** |
| 252 type-only | 254 | +2 = `env.d.ts`'s `import("@/lib/supabase").T` and `import("@/lib/preferences").T` type expressions (`type-import`), which the map did not count (inference) |
| 2 dynamic `import()` | 1 (`LocationPicker → map-panel`) | the other one, `finder-stars.ts → finder-stars.json`, is a generated JSON target the config excludes |
| 6 isolates | 6, identical list | **equal** |
| 0 unresolved | 0 | **equal** |

Reach convention (inference): for all 21 hubs, dependency-cruiser's runtime reach is exactly one file below the map's figure, with every page count equal. That includes the two that break a simpler pattern (`log-failure` 90 vs 91, `supabase.ts` 4 vs 5). The consistent reading is that the map's "reach N files" counts the contract file itself. Below, "confirms" for a reach means dependency-cruiser's importers + 1 = the map's N, and pages are equal.

## Verdicts on the map's structural claims

C = confirms, R = refines, X = contradicts, U = unknown (not re-derivable). Anchors: `rm` = `repo-map.md`, `3s` = `3-structure.md`. The numbers are from the shim run at `321427c` unless HEAD is named.

| # | Claim (anchor) | dependency-cruiser | Verdict |
|---|---|---|---|
| 1 | Production graph: 352 files, 1,285 runtime / 252 type / 8 build, 6 isolates, 0 unresolved (3s:16) | see the reconciliation table above | **C** (file count R: 353; type-only +2 explained) |
| 2 | Exactly one runtime file cycle: `engine/events.ts ↔ meteors.ts / pairings.ts` (3s:90, rm:162) | 1 SCC of those 3 files; `no-circular` warns on the two 2-file loops | **C** |
| 3 | Type-only cycle `i18n/index.ts ⇄ messages/pl.ts` (3s:154) | the only cycle that exists through type-only edges alone (`no-circular-type-only`) | **C** |
| 4 | "No runtime import leaves `src/lib/engine` except to its own carved-out files" (3s:76); "The engine imports nothing but `astronomy-engine`" (rm:101, rm:136) | `engine-purity` error: `src/lib/engine/meteors.ts → src/lib/catalogue/meteor-showers.ts` (runtime, `import { METEOR_SHOWERS }` at `meteors.ts:4`) | **X** (see New findings 1) |
| 5 | Only external of the engine: `astronomy-engine`, 14 imports (3s:76) | native run: 14 `astronomy-engine` entries from 10 production files, no other package | **C** |
| 6 | Engine type-only → `moon-disc/state.ts`, 2 edges (3s:109); engine → catalogue type-only 6 (3s:153) | `engine-no-type-imports-outside`: 2 → `moon-disc/state.ts`, 6 → `catalogue/index.ts`, plus 2 → `catalogue/meteor-showers.ts` | **C** |
| 7 | Boundary 1: `lib → components` 0; boundary 2: → `pages` 0 (3s:100-101) | 0 and 0 (`lib-not-components`, `not-to-pages`) | **C** |
| 8 | Boundary 3: islands reach no server-only module; the guard covers named islands only (3s:12, 3s:102) | all 32 `.tsx` files, **transitively**: 0 reach `gear/store|timezone`, `log-failure`, `supabase`, `account-plan`, `tonight/island|load`, `forecast`, `catalogue/index|finder-stars` or a non-`parameters` engine module | **C**, and R: now checked for every `.tsx`, not just the listed ones |
| 9 | Boundary 4: one edge `api-errors.ts → auth/session-user.ts` makes `session-user.ts` reachable from 64 files / 45 pages (3s:103, rm:100, rm:145) | 1 edge (`error-shape-not-accounts`); reach 63 + 1 / 45. Without that edge the reach is **1** file (`middleware.ts`) | **C** |
| 10 | Boundary 5: shared shell reads features, 7 edges (3s:104) | 7: `Topbar → account-plan`, `TopbarControls → offline/install`, `Layout →` `config-status`, `observability/client`, `offline/{install,page-state,register}` | **C** |
| 11 | Boundary 6: `GearShell → MilestoneCelebration`, `→ observations/redirect` (3s:105) | both edges present | **C** |
| 12 | Boundary 9: 33 page/route → `*store.ts` edges (3s:108) | 33 | **C** |
| 13 | Build edges 8, no script imports `src/` (3s:156) | 8 `scripts/ → scripts/`; 0 `scripts/ → src/` | **C** |
| 14 | Centres table: i18n 106/2, utils 51/0, button 39/1, parameters 32/0, targets 24/0, gear/store 23/2, GearShell 22/6, format 22/2, api-errors 20/3, engine/index 20/21, log-failure 18/1, account-plan 15/3 (3s:134-145) | all 12 Ca/Ce equal | **C** |
| 15 | Thin entries: Tonight pages Ce 12–15; `TonightContent` 21, `TargetsPageContent` 20; log pages 22/20/18/18; API routes Ce 2–12; `middleware.ts` 7; `sw.ts` 3; `design.astro` 78 (3s:147, 3s:159) | all equal (Tonight `.astro` pages 12–15; 20 API routes, Ce 2–12) | **C** |
| 16 | 9 `.astro` files use `server:defer` (3s:147, rm:109) | `rg -l server:defer src` = 9 (attribute, not an import: outside dependency-cruiser) | **C** (by `rg`) |
| 17 | Contract fan-in: `targets/labels.ts` 16, `save-failure.ts` 16, `read-failure.ts` 9, `OfflineCopy.astro` 8, `clock.ts` 10, `island.ts` 8 (3s:75-86) | equal | **C** |
| 18 | Reach: engine barrel 51/18, `catalogue/index` 54/28, `gear/store` 49/31, `account-plan` 44/28, `api-errors` 62/45, `targets/index` 74/32, `format.ts` 57/24, `parameters.ts` 95/33, `clock.ts` 28/16, `observations/store` 28/15, `sky-checks/store` 23/10, `session-plans/store` 8/4, `offline/copies` 33/27, `forecast/service` 20/8, `tonight/load` 19/8, `GearShell` 23/22, `supabase.ts` 5/3, `log-failure` 91/47 (rm:61-68, 3s:75-86) | every one = importers + 1, pages equal (`summary-321427c.txt`) | **C** |
| 19 | `forecast`: one importer, `tonight/load.ts` (rm:70, 3s:82) | `forecast/service.ts` Ca 1 (`load.ts`) | **C** |
| 20 | `database.types.ts` imported by 4 production files, all type-only (3s:170) | excluded by config; `rg` finds the same 4 files | **C** (by `rg`) |
| 21 | `log-failure.ts` reach 91 files / 47 pages, Ca 18 (rm:67, rm:155, rm:189, 3s:85, 3s:144) | at HEAD (after #245): Ca **20** (+`middleware.ts`, +`stream-guard.ts`), reach 91 + 1 = **92** / 47 | **R** (a #245 delta, as the map's Limitations predicted) |
| 22 | `middleware.ts` Ce 7 (3s:80, 3s:147) | 7 at `321427c`; **9** at HEAD (+`stream-guard.ts`, +`observability/log-failure.ts`) | **R** (#245) |
| 23 | `tonight/island.ts` (8: "finder, session-plan, sky-events islands load through it") (3s:75); "Tonight's island loader feeds the finder, session-plan and sky-events pages" (rm:117) | its 8 importers are **all seven Tonight page islands** (`TonightContent`, `Targets-`, `Plan-`, `Moon-`, `Planets-`, `Nights-`, `EventsPageContent`) **plus `finder/load.ts`** | **R** |
| 24 | Risk zone 1: "a change here reaches eight capabilities" (rm:17, rm:117) | runtime reach of `tonight/build.ts`: **21 files / 9 pages**, all in the Tonight page family (8 shells, their islands, `island.ts`, `load.ts`, `finder/load.ts`) plus `/design` and `design/plan-samples.ts`. Its spread is outgoing (Ce 15 into 8 folders) and compile-time (38 files reach it once type-only edges count) | **R** (inference: "reaches eight capabilities" holds for what Tonight *depends on* and for type changes, not for runtime dependents) |
| 25 | `DatabaseMissing.astro` (15), `fault.ts` (8) (3s:79, 3s:85) | Ca 22 and 9 | **R** (inference: the map counted importers from other capabilities only; the fold file is needed to tell) |
| 26 | Dynamic imports: 2 in production, both resolved (3s:16, 3s:172) | 1 code edge (`map-panel`), mis-tagged `type-import`; the JSON one is excluded | **R** |
| 27 | Cloudflare bindings and `astro:env` edges dropped (3s:171, rm:217) | dropped by default; visible with an `-I` override as 7 unresolved imports in 6 files | **R** |
| 28 | "dependency-cruiser … is not installed … `.astro` files would need a custom extractor" (rm:199, 3s:176) | installed and configured; the native run covers 43% of runtime edges, the shim 100% of the map's | **R** |
| 29 | "Tool worth installing: … declarative, whole-repo rules (every `.tsx` island) and cycle checks in CI" (3s:176) | the rules exist in `.dependency-cruiser.cjs` and pass except the 1 error and 3 warnings below; not wired into CI or `npm` scripts | **C** in part (CI not done) |
| 30 | Capability-level figures: the Mermaid edge counts (rm:24-47, 3s:44-67), the capability Ca/Ce/instability table (3s:22-40), "imports `shared`" counts (3s:42), the 15-capability SCC (3s:91), tonight Ca 11 and 169/69 edges (rm:60, rm:121), ≈36 foundation edges (3s:106) | not re-derivable: they fold files through `context/map/.work/capabilities.tsv`, which is not in the repo or any worktree | **U**. Inference: the file graph under them reproduces exactly at `321427c` (1,293 / 254 edges), so a re-fold with the same TSV would give the same numbers |

**Tally:** 30 rows covering about 80 numeric claims. **20 confirm** (rows 1–20; row 1 with a one-file refinement), **9 refine** (rows 21–29, row 29 confirming in part), **1 contradicts** (row 4), **1 group is unknown** (row 30).

## What dependency-cruiser shows that the map does not

1. **The engine has one runtime import outside itself (evidence).**
   - `src/lib/engine/meteors.ts:4` imports `METEOR_SHOWERS` from `src/lib/catalogue/meteor-showers.ts`, a 149-line hand-entered table with 0 imports (`grep -c ^import` = 0).
   - Inference: purity in substance holds, since the table is data, with no clock, env, network or fs. But `purity.test.ts` greps content patterns and restricts imports only for the moon-disc module (`purity.test.ts:16, 40-50`), so nothing guards which modules the engine imports. The committed `engine-purity` rule is the first check that does, and it fails today.
   - Unknown: whether the map's fold attributes `meteor-showers.ts` to sky-events, which would hide this edge at capability level.
2. **Compile-time blast radius is far larger than runtime reach (evidence, `reaches-head.txt`).** Following type-only edges too, dependency-cruiser's `--reaches` gives, against the runtime figures:

   | Hub | Files (pages) with type edges | Runtime files (pages) |
   |---|---|---|
   | engine barrel | 187 (46) | 50 (18) |
   | `catalogue/index` | 215 (46) | 53 (28) |
   | `gear/store` | 74 (33) | 48 (31) |
   | `log-failure` | 113 (47) | 91 (47) |
   | `tonight/build.ts` | 38 (9) | 21 (9) |

   The 17 extra files for `build.ts` are mostly the Tonight components that take `TonightView` slices as props, plus `session-plans/read.ts`, `sky-checks/record.ts` and `tonight/plan-editor-view.ts`. Inference: a type change in the engine, the catalogue or `TonightView` fans out to most of the app at type-check time. `astro check` in CI catches it, so this is change cost, not runtime risk.
3. **`session-user.ts`'s page reach hinges on one edge (evidence).** Its importers are `api-errors.ts` and `middleware.ts`. Remove `api-errors → session-user` and the reach drops from 63 files / 45 pages to 1 file. This strengthens Watch: accounts. Inference: moving `isRoutineSessionError` / `statusOfAuthError` out of `auth/` would remove the layering break entirely.
4. **Every guarded boundary also holds transitively (evidence).**
   - No `.tsx` (32 files) reaches server-only code.
   - `sky-view` reaches neither the engine nor the catalogue barrel.
   - `stars.ts` does not import the catalogue barrel.
   - `finder-stars.ts` is imported only by server code.
   - `sw.ts`'s runtime closure (10 files) contains neither the client barrel nor `log-failure`.

   The regex guard tests (`island-imports.test.ts`, `client-imports.test.ts`) check named lists. These rules check the whole graph, but only when someone runs them.
5. **Centres the map's table omits (evidence; inference: mechanical).** `forms/ServerError.tsx` Ca 25, `ui/Band.astro` 24, `gear/DatabaseMissing.astro` 22 and `ui/PageHeader.astro` 21 are design-system primitives, like `button.tsx`.
6. **Folder metrics (evidence, `metrics-folders-head.txt`; runtime and type-only, folder cut, not capabilities).**
   - Most depended-on: `src/lib/tonight` has N 20, Ca 97, Ce 58 and I 37%; `src/lib/observability` has Ca 60, Ce 1 and I 2%.
   - Stable leaves: `src/lib/engine` (I 17%), `src/lib/catalogue` (8%), `src/lib/gear` (10%).
   - `src/lib/session-plans` is the most unstable lib folder (53%), consistent with the map's session-plan instability of 0.77 (inference).
7. **The #245 delta (evidence).**
   - Since `321427c`: +1 file (`observability/stream-guard.ts`) and +3 runtime edges (1,293 → 1,296).
   - `middleware.ts` Ce 7 → 9; `log-failure` Ca 18 → 20.
   - No new cycle and no new rule violation. The Limitations line "would shift the error-visibility and accounts counts slightly and no ranking" holds.

## Rule results at HEAD (shim run, `rules-head-astro-shim.txt`)

| Severity | Rule | Finding |
|---|---|---|
| error | `engine-purity` | `engine/meteors.ts → catalogue/meteor-showers.ts` (New findings 1) |
| warn | `no-circular` | `events.ts ↔ meteors.ts`, `events.ts ↔ pairings.ts` (each loop reported from both ends: 4 lines) |
| warn | `error-shape-not-accounts` | `api-errors.ts → auth/session-user.ts` |
| info | `no-circular-type-only` | `i18n/index.ts ⇄ messages/pl.ts` (plus the two engine loops, which also carry type edges) |
| info | `engine-no-type-imports-outside` | 10 type-only edges (row 6) |
| info | `no-orphans` | `catalogue/vmag-colour-pins.ts` (imported by tests only, as the map says) |
| — | all island, sky-view, stars, finder-stars, client-observability, worker, `lib → components`, `→ pages`, `scripts → src` rules | 0 |

The native run (`rules-head-native.txt`) reports the same error and warnings, plus 91 orphans. 82 of those are `.astro` artefacts, so its `no-orphans` output is not trustworthy without the shim.

## Still unknown

- **Capability-level numbers** (row 30) until `capabilities.tsv` is recovered or recommitted.
- **The reach convention** (map N = importers + 1) is inferred from 21 consistent cases, not from the map's script.
- **`.astro` edges that are not static imports.** None were found (no glob imports), but dependency-cruiser alone cannot prove that. The shim is a second custom extractor, written to the same rule as the map's.
- **Runtime wiring outside imports**: `Astro.locals` (104 files), the `/_server-islands/*` URL surface, SQL/RLS/RPCs, CI, `wrangler.jsonc`, the service-worker build by path, Python oracles → JSON fixtures, HTTP callers. Unchanged from `3-structure.md`.

## Commands run

1. `npx depcruise --help`; read `node_modules/dependency-cruiser/src/extract/extract-dependencies.mjs` (`.astro` handling: `extraExtensionsToScan` skips extraction).
2. `npx depcruise src scripts --config .dependency-cruiser.cjs -T err` and `-T json` (native).
3. `node context/map/evidence/depcruise/astro-shim.mjs <mirror> full.json` (HEAD); `git archive 321427c src scripts | tar -x -C <dir>` then `astro-shim.mjs <mirror> full-321427c.json <dir>`.
4. `node context/map/evidence/depcruise/analyse.mjs <json>` → `summary-*.txt`; `npx depcruise-fmt -T err|metrics full.json`; `npx depcruise-fmt -T json --reaches "^<hub>$" full.json` per hub.
5. `npx depcruise src --config .dependency-cruiser.cjs -I "^(src/|cloudflare:|astro:)" -T json` (virtual modules).
6. Cross-checks with `rg`: `server:defer` (9), `database.types` importers (4), `astronomy-engine` importers, `from "(astro|cloudflare):` (7), `import.meta.glob|Astro.glob` (0), `<script` tags (14), `LocationPicker`/`map-panel` imports, `meteor-showers.ts` imports (0), `purity.test.ts` scope.
7. `npx eslint --max-warnings 0 .dependency-cruiser.cjs eslint.config.js`; `npm run lint`.

## Proposed edits to repo-map.md

For the owner's decision; none is applied.

| # | Section | Old statement | New statement | Evidence anchor |
|---|---|---|---|---|
| E1 | Real couplings, row "engine → everything that ranks" (rm:101) | "The engine imports nothing but `astronomy-engine` (pure, purity-tested)" | "At runtime the engine imports `astronomy-engine` and one data table, `catalogue/meteor-showers.ts` (`engine/meteors.ts:4`). Purity in substance holds (the table has no imports), but no test guards the engine's import targets; the `engine-purity` rule in `.dependency-cruiser.cjs` flags this edge" | 3b row 4, New findings 1 |
| E2 | Risk zone 2, Mitigation (rm:136) | "The engine imports nothing but `astronomy-engine`, has 23 unit test files and no mocks" | "Apart from one data table (`meteor-showers.ts`), the engine imports only `astronomy-engine`; it has 23 unit test files and no mocks" | 3b row 4 |
| E3 | Risk zone 1, intro (rm:117) and Signal 2 (rm:121) | "Tonight's island loader feeds the finder, session-plan and sky-events pages, so a change here reaches eight capabilities" | "Tonight's island loader `island.ts` is imported by all seven Tonight page islands and the finder's loader. At runtime a change to `build.ts` reaches 21 files / 9 pages, the Tonight page family plus `/design`. Its eight-capability spread comes from what it depends on (Ce 15) and from its types (38 files once type-only edges count)" | 3b rows 23–24, New findings 2 |
| E4 | Limitations, Graph coverage (rm:199) and front matter `graph_coverage` (rm:7) | "The lesson's tool, dependency-cruiser, is not installed and was not installed. `.astro` files would need a custom extractor anyway." | "dependency-cruiser 18.7 is configured (`.dependency-cruiser.cjs`). Natively it sees 43% of runtime edges (`.astro` files have no outgoing edges); with the astro shim it reproduces this map's file graph at `321427c` exactly (1,293 runtime edges, 6 isolates, 1 cycle). See `evidence/3b-structure-dependency-cruiser.md`" | 3b reconciliation, row 28 |
| E5 | Real couplings, row `api-errors.ts → auth/session-user.ts` (rm:100) | "real layering break: … so `session-user.ts` is reachable from 45 pages" | append: "Without this one edge, only `middleware.ts` would reach it" | 3b row 9, New findings 3 |
| E6 | Terrain, error-visibility `rch` (rm:67) and First day 8 (rm:189) | "`log-failure.ts` reach 91 files / 47 pages" | "… 91 files / 47 pages at `321427c` (92 / 47 at `2e028e5`, Ca 18 → 20 after #245)" | 3b row 21 |
| E7 | Limitations (after the Graph coverage bullets) | — | new bullet: "Reach figures count the contract file itself (dependency-cruiser reproduces each as importers + 1, with equal page counts)" | 3b reconciliation |

Not map edits, for the owner to decide separately:
- add an `npm run depcruise` script and a CI step, with the one error either fixed or baselined (`--baseline`);
- recommit `capabilities.tsv`, so the capability-level numbers (row 30) can be re-verified.
