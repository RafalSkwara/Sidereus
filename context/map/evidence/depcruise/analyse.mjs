// Count what a dependency-cruiser JSON result says about the repo map's structural claims (m4 L2, evidence 3b).
// Usage: node context/map/evidence/depcruise/analyse.mjs <depcruise.json>   (prints a plain-text summary)
// "runtime" = a file edge with at least one import that is not type-level; "type-only" = only `import type` or
// `import("x").T` type expressions (dependency-cruiser's "type-only" / "type-import").
// dependency-cruiser keeps one entry per specifier, so LocationPicker.tsx's `typeof import("./map-panel")` (:58) and its
// real `import("./map-panel")` (:63) become a single "type-import" entry; that edge is restored as a runtime dynamic import.
// It also tags `import X, { type Y } from "m"` exactly like `import type { Y } from "m"` ("type-only" + "import"); the two
// such production imports (SiteForm.tsx:4, OnboardingWizard.tsx:6) are restored as runtime edges.
const MISLABELLED_DYNAMIC = new Set(["src/components/location/LocationPicker.tsx -> src/components/location/map-panel.tsx"]);
const MISLABELLED_RUNTIME = new Set([
  "src/components/gear/SiteForm.tsx -> src/components/location/LocationPicker.tsx",
  "src/components/onboarding/OnboardingWizard.tsx -> src/components/location/LocationPicker.tsx",
]);
import { readFileSync } from "node:fs";

const result = JSON.parse(readFileSync(process.argv[2], "utf8"));
const local = (p) => /^(src|scripts)\//.test(p);
const modules = result.modules.filter((m) => local(m.source));
const isPage = (p) => /^src\/pages\//.test(p);

const runtime = new Map(); // from -> Set(to)
const typeOnly = new Map();
let dynamic = 0;
const unresolved = [];
const externals = new Set();
for (const m of modules) {
  runtime.set(m.source, runtime.get(m.source) ?? new Set());
  typeOnly.set(m.source, typeOnly.get(m.source) ?? new Set());
  const byTarget = new Map();
  for (const d of m.dependencies) {
    if (d.couldNotResolve) {
      unresolved.push(`${m.source} -> ${d.module}`);
      continue;
    }
    if (!local(d.resolved)) {
      if (!d.coreModule) externals.add(d.module);
      continue;
    }
    const key = `${m.source} -> ${d.resolved}`;
    const restored = MISLABELLED_DYNAMIC.has(key) || MISLABELLED_RUNTIME.has(key);
    if (d.dependencyTypes.includes("dynamic-import") || MISLABELLED_DYNAMIC.has(key)) dynamic += 1;
    const types = byTarget.get(d.resolved) ?? [];
    const typeLevel = d.dependencyTypes.includes("type-only") || d.dependencyTypes.includes("type-import");
    types.push(typeLevel && !restored ? "type" : "runtime");
    byTarget.set(d.resolved, types);
  }
  for (const [to, types] of byTarget) (types.includes("runtime") ? runtime : typeOnly).get(m.source).add(to);
}
const count = (g) => [...g.values()].reduce((n, s) => n + s.size, 0);
const files = modules.map((m) => m.source);
const byExt = {};
for (const f of files) {
  const ext = f.match(/\.[a-z]+$/)?.[0] ?? "?";
  byExt[ext] = (byExt[ext] ?? 0) + 1;
}

const incoming = new Map(files.map((f) => [f, new Set()]));
for (const [from, tos] of runtime) for (const to of tos) incoming.get(to)?.add(from);
const ca = (f) => incoming.get(f)?.size ?? 0;
const ce = (f) => runtime.get(f)?.size ?? 0;
function reach(target) {
  const seen = new Set();
  const stack = [target];
  while (stack.length) for (const from of incoming.get(stack.pop()) ?? []) if (!seen.has(from)) seen.add(from), stack.push(from);
  return { files: seen.size, pages: [...seen].filter(isPage).length };
}

// Tarjan SCC over runtime edges.
let index = 0;
const idx = new Map(), low = new Map(), onStack = new Set(), stack = [], sccs = [];
function strong(v) {
  idx.set(v, index), low.set(v, index++), stack.push(v), onStack.add(v);
  for (const w of runtime.get(v) ?? []) {
    if (!idx.has(w)) strong(w), low.set(v, Math.min(low.get(v), low.get(w)));
    else if (onStack.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
  }
  if (low.get(v) === idx.get(v)) {
    const c = [];
    let w;
    do (w = stack.pop()), onStack.delete(w), c.push(w);
    while (w !== v);
    if (c.length > 1) sccs.push(c);
  }
}
for (const f of files) if (!idx.has(f)) strong(f);

const out = [];
const line = (...a) => out.push(a.join(" "));
line("# dependency-cruiser analysis of", process.argv[2].split("/").pop());
line("local modules:", files.length, JSON.stringify(byExt), "| pages/routes:", files.filter(isPage).length);
line("local file edges: runtime", count(runtime), "| type-only", count(typeOnly), "| dynamic import() edges", dynamic);
line("external packages (distinct specifiers, excl. node core):", externals.size, "| unresolved:", unresolved.length);
for (const u of unresolved) line("  unresolved:", u);
const typeIn = new Set([...typeOnly.values()].flatMap((s) => [...s]));
const isolates = files.filter((f) => ca(f) === 0 && ce(f) === 0 && !typeOnly.get(f)?.size && !typeIn.has(f));
line("isolates (no runtime/type edge in or out):", isolates.length);
for (const f of isolates) line("  ", f);
line("runtime cycles (strongly connected components):", sccs.length);
for (const c of sccs) line("  ", c.sort().join(" <-> "));

line("\n## Hubs: runtime Ca / Ce / reach (files, pages)");
const hubs = [
  "src/lib/tonight/build.ts", "src/lib/tonight/load.ts", "src/lib/tonight/island.ts", "src/lib/engine/index.ts",
  "src/lib/catalogue/index.ts", "src/lib/gear/store.ts", "src/lib/auth/session-user.ts",
  "src/lib/observability/log-failure.ts", "src/lib/api-errors.ts", "src/lib/account-plan/index.ts",
  "src/lib/targets/index.ts", "src/lib/tonight/format.ts", "src/lib/engine/parameters.ts", "src/lib/clock.ts",
  "src/lib/observations/store.ts", "src/lib/sky-checks/store.ts", "src/lib/offline/copies.ts",
  "src/lib/forecast/service.ts", "src/lib/supabase.ts", "src/components/gear/GearShell.astro",
  "src/lib/session-plans/store.ts",
];
for (const h of hubs) {
  const r = reach(h);
  line(h, "Ca", ca(h), "Ce", ce(h), "reach", r.files, "files /", r.pages, "pages");
}
line("\n## Top 15 runtime Ca");
for (const f of [...files].sort((a, b) => ca(b) - ca(a)).slice(0, 15)) line(f, "Ca", ca(f), "Ce", ce(f));
line("\n## Top 10 runtime Ce");
for (const f of [...files].sort((a, b) => ce(b) - ce(a)).slice(0, 10)) line(f, "Ce", ce(f), "Ca", ca(f));

line("\n## Boundary counts (runtime edges)");
const edges = [...runtime].flatMap(([from, tos]) => [...tos].map((to) => [from, to]));
const cnt = (pred) => edges.filter(([a, b]) => pred(a, b));
const show = (label, list) => {
  line(label, list.length);
  for (const [a, b] of list.slice(0, 40)) line("  ", a, "->", b);
};
show("lib -> components:", cnt((a, b) => a.startsWith("src/lib/") && b.startsWith("src/components/")));
show("non-page -> pages:", cnt((a, b) => !isPage(a) && isPage(b)));
show("engine -> outside engine:", cnt((a, b) => a.startsWith("src/lib/engine/") && !b.startsWith("src/lib/engine/")));
show("api-errors -> auth:", cnt((a, b) => a === "src/lib/api-errors.ts" && b.startsWith("src/lib/auth/")));
line("scripts -> scripts runtime edges:", cnt((a, b) => a.startsWith("scripts/") && b.startsWith("scripts/")).length);
show("scripts -> src:",cnt((a, b) => a.startsWith("scripts/") && b.startsWith("src/")));
line("page/route -> *store.ts:", cnt((a, b) => isPage(a) && /store\.ts$/.test(b)).length);
const serverOnly = /^src\/lib\/(gear\/(store|timezone)|observability\/log-failure|supabase|account-plan\/|tonight\/(island|load)|forecast\/|catalogue\/(index|finder-stars))/;
const tsx = files.filter((f) => f.endsWith(".tsx"));
const tsxReach = new Map();
for (const t of tsx) {
  const seen = new Set();
  const st = [t];
  while (st.length) for (const to of runtime.get(st.pop()) ?? []) if (!seen.has(to)) seen.add(to), st.push(to);
  const bad = [...seen].filter((f) => serverOnly.test(f) || /^src\/lib\/engine\/(?!parameters\.ts$)/.test(f));
  if (bad.length) tsxReach.set(t, bad);
}
line(".tsx files:", tsx.length, "| .tsx that transitively reach a server-only or non-parameters engine module:", tsxReach.size);
for (const [t, bad] of tsxReach) line("  ", t, "->", bad.join(", "));
const swSeen = new Set();
const swStack = ["src/sw.ts"];
while (swStack.length) for (const to of runtime.get(swStack.pop()) ?? []) if (!swSeen.has(to)) swSeen.add(to), swStack.push(to);
line("sw.ts runtime closure:", swSeen.size, "files; reaches observability/client barrel or log-failure:",
  [...swSeen].filter((f) => /observability\/(client\/index|log-failure)\.ts$/.test(f)).length);

line("\n## Folder-level runtime edges (src/<lib|components|pages>/<folder>), top 30 cross-folder pairs");
const folder = (f) => f.match(/^src\/(lib|components|pages)\/([^/.]+)(?=\/)/)?.slice(1, 3).join("/") ?? f.replace(/\/[^/]+$/, "") ;
const pairs = new Map();
for (const [a, b] of edges) {
  const k = `${folder(a)} -> ${folder(b)}`;
  if (folder(a) !== folder(b)) pairs.set(k, (pairs.get(k) ?? 0) + 1);
}
for (const [k, n] of [...pairs].sort((x, y) => y[1] - x[1]).slice(0, 30)) line(n, k);

console.log(out.join("\n"));
