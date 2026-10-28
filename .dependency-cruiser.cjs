// dependency-cruiser configuration (10xArchitect m4 L2 structure check).
// Run: npm run depcruise (CI's `ci` job runs it; it fails on `error`-severity violations only, `warn` and `info`
// are reported). The CI run is native, with no .astro shim: the rules that fail the build (engine purity, island
// purity) concern .ts and .tsx files, whose imports native mode reads in full.
//
// .astro files: dependency-cruiser has no Astro parser. `extraExtensionsToScan` adds them as nodes, so imports
// INTO an .astro file (from .ts/.tsx/.astro) resolve, but an .astro file's own imports (frontmatter, <script>) are
// not extracted. context/map/evidence/depcruise/astro-shim.mjs runs this same config over a mirror tree in which
// each .astro file is replaced by its frontmatter and <script> blocks as TypeScript, to see those edges too.
//
// Exclusions follow the repo map's noise rules: tests, test-only fixtures and helpers, the generated
// database.types.ts and the generated catalogue / gear-catalogue / scripts data JSON.

const SERVER_ONLY = [
  "^src/lib/gear/(store|timezone)\\.ts$",
  "^src/lib/observability/log-failure\\.ts$",
  "^src/lib/supabase\\.ts$",
  "^src/lib/account-plan/",
  "^src/lib/tonight/(island|load)\\.ts$",
  "^src/lib/forecast/",
  "^src/lib/catalogue/(index|finder-stars)\\.ts$",
];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "warn",
      comment: "A runtime import cycle. Type-only cycles are reported by no-circular-type-only.",
      from: {},
      to: { circular: true, viaOnly: { dependencyTypesNot: ["type-only"] } },
    },
    {
      name: "no-circular-type-only",
      severity: "info",
      comment: "A cycle that closes only through `import type` edges (mechanical, erased at build).",
      from: {},
      to: { circular: true, dependencyTypes: ["type-only"] },
    },
    {
      name: "no-orphans",
      severity: "info",
      comment:
        "A module nothing imports and that imports nothing. Entry points (pages, middleware, sw, scripts) are expected.",
      from: {
        orphan: true,
        pathNot: ["\\.d\\.ts$", "^src/pages/", "^src/middleware\\.ts$", "^src/sw\\.ts$", "^scripts/"],
      },
      to: {},
    },
    {
      name: "engine-purity",
      severity: "error",
      comment:
        "The sky engine imports only itself, astronomy-engine and the meteor-shower table (CLAUDE.md). " +
        "src/lib/engine/purity.test.ts pins the same allowlist in the agents' end-of-turn loop; this rule backs it up in CI. " +
        "src/lib/catalogue/meteor-showers.ts is the one named exception: a hand-entered table of constants with no imports, " +
        "so it is pure data and carries no clock, env, network or filesystem access.",
      from: { path: "^src/lib/engine/" },
      to: {
        dependencyTypesNot: ["type-only"],
        pathNot: ["^src/lib/engine/", "^node_modules/astronomy-engine/", "^src/lib/catalogue/meteor-showers\\.ts$"],
      },
    },
    {
      name: "engine-no-type-imports-outside",
      severity: "info",
      comment: "Type-only edges leaving the engine (a layering inversion even when erased at build).",
      from: { path: "^src/lib/engine/" },
      to: { dependencyTypes: ["type-only"], pathNot: ["^src/lib/engine/", "^node_modules/astronomy-engine/"] },
    },
    {
      name: "island-no-server-only",
      severity: "error",
      comment:
        "A React component (.tsx) must not import a server-only module at runtime (CLAUDE.md island imports). " +
        "src/components/island-imports.test.ts pins the named islands' import lists in the end-of-turn loop; this rule is " +
        "the backstop in CI for every .tsx. It checks direct edges: `reachable: true` would follow type-only edges too " +
        "(i18n/messages/en.ts imports the engine's types) and flag every island that calls getMessages.",
      from: { path: "\\.tsx$" },
      to: { dependencyTypesNot: ["type-only"], path: SERVER_ONLY },
    },
    {
      name: "island-no-engine-barrel",
      severity: "error",
      comment: "Islands take engine constants from engine/parameters only, never other engine modules.",
      from: { path: "\\.tsx$" },
      to: { dependencyTypesNot: ["type-only"], path: "^src/lib/engine/", pathNot: "^src/lib/engine/parameters\\.ts$" },
    },
    {
      name: "sky-view-browser-only",
      severity: "error",
      comment: "src/lib/sky-view is browser code: never astronomy-engine, the engine or the catalogue barrel.",
      from: { path: "^src/lib/sky-view/" },
      to: {
        dependencyTypesNot: ["type-only"],
        path: [
          "^node_modules/astronomy-engine/",
          "^src/lib/engine/(?!parameters\\.ts$)",
          "^src/lib/catalogue/index\\.ts$",
        ],
      },
    },
    {
      name: "finder-stars-server-only",
      severity: "error",
      comment: "Only server code may load the finder star file: never stars.ts, the catalogue barrel or a .tsx.",
      from: { path: ["\\.tsx$", "^src/lib/catalogue/(stars|index)\\.ts$", "^src/lib/sky-view/"] },
      to: { path: "^src/lib/catalogue/finder-stars\\.ts$" },
    },
    {
      name: "stars-not-catalogue-barrel",
      severity: "error",
      comment: "stars.ts must never import ./index (it would ship messier.json to the browser).",
      from: { path: "^src/lib/catalogue/stars\\.ts$" },
      to: { path: "^src/lib/catalogue/index\\.ts$" },
    },
    {
      name: "client-observability-no-server",
      severity: "error",
      comment: "Client observability modules import no server code (client-imports.test.ts).",
      from: { path: "^src/lib/observability/client/" },
      to: { dependencyTypesNot: ["type-only"], path: SERVER_ONLY },
    },
    {
      name: "worker-no-client-barrel",
      severity: "error",
      comment: "The service worker never imports the client barrel or log-failure (client-imports.test.ts).",
      from: { path: "^src/sw\\.ts$" },
      to: {
        path: ["^src/lib/observability/client/index\\.ts$", "^src/lib/observability/log-failure\\.ts$"],
        reachable: true,
      },
    },
    {
      name: "lib-not-components",
      severity: "warn",
      comment: "src/lib is below the components layer.",
      from: { path: "^src/lib/" },
      to: { dependencyTypesNot: ["type-only"], path: "^src/components/" },
    },
    {
      name: "not-to-pages",
      severity: "warn",
      comment: "Nothing imports a page or route.",
      from: { pathNot: "^src/pages/" },
      to: { path: "^src/pages/" },
    },
    {
      name: "error-shape-not-accounts",
      severity: "warn",
      comment: "The shared error shape (api-errors.ts) depends on accounts: the repo map's one layering break.",
      from: { path: "^src/lib/api-errors\\.ts$" },
      to: { dependencyTypesNot: ["type-only"], path: "^src/lib/auth/" },
    },
    {
      name: "scripts-not-src",
      severity: "info",
      comment: "Build scripts stand apart from the app code.",
      from: { path: "^scripts/" },
      to: { path: "^src/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    includeOnly: { path: ["^src/", "^scripts/", "^node_modules/"] },
    exclude: {
      path: [
        "\\.(test|spec)\\.(ts|tsx|mjs|js)$",
        "^tests/",
        "^src/lib/test-support/",
        "^src/lib/engine/fixtures/",
        "^src/lib/database\\.types\\.ts$",
        "\\.json$",
        "^scripts/badge-art/out/",
      ],
    },
    tsPreCompilationDeps: true,
    extraExtensionsToScan: [".astro"],
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
      extensions: [".ts", ".tsx", ".mjs", ".js", ".d.ts", ".astro"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
