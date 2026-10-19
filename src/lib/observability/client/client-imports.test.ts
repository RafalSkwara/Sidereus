import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The import guard for the client reporting code (error-visibility Phase 9), in the style of
 * `src/components/island-imports.test.ts`. Two rules, each the only protection of a risk:
 *
 * - Everything under `src/lib/observability/client/` runs in the browser (the page) or in the service worker (the core).
 *   An import of server code would ship it to every visitor and break the worker's bundle: the engine, the catalogue,
 *   the logger (`log-failure`, which holds the only `console` site and 88 auth codes), the server's report and limiter
 *   modules, `cloudflare:workers`, an Astro virtual module or a Node built-in. Checked by alias and by relative path.
 * - The service worker never imports the page's barrel `@/lib/observability/client` (it gained `browser.ts`, which
 *   touches `window`), nor the logger. `src/sw.ts` and `src/lib/offline/report.ts` take the core from the leaf modules
 *   (`.../client/reporter`, `classify`, `steps`). The build's bundle check sees only the logger, so this holds the rest
 *   (Phase 8 impl review F3).
 */

const SRC = fileURLToPath(new URL("../../../", import.meta.url));
const CLIENT_DIR = join(SRC, "lib/observability/client");
const BARREL = "@/lib/observability/client";

const NODE_BUILTINS = new Set(builtinModules.map((name) => name.replace(/^node:/, "")));

/** Comments blanked, so a comment that quotes an import is not one. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|\s)\/\/[^\n]*/gm, (match, lead: string) => lead + " ".repeat(match.length - lead.length));
}

/** Module specifiers of every static import, re-export and dynamic import in `source`. */
function importSpecifiers(source: string): string[] {
  return [...withoutComments(source).matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)].map((m) => m[1]);
}

/** `specifier` as seen from `file`, with a relative path turned into the `@/` alias of the same module. */
function aliasForm(file: string, specifier: string): string {
  if (!specifier.startsWith(".")) return specifier;
  const path = relative(SRC, resolve(dirname(file), specifier))
    .split("\\")
    .join("/");
  return `@/${path}`;
}

function isUnder(specifier: string, module: string): boolean {
  return specifier === module || specifier.startsWith(`${module}/`);
}

/** Why a client module may not import `specifier` (already in alias form), or `null` when it may. */
function serverImportReason(specifier: string): string | null {
  if (isUnder(specifier, "@/lib/engine") || specifier === "astronomy-engine") return "the sky engine";
  if (isUnder(specifier, "@/lib/catalogue")) return "the catalogue";
  // The logger and the server's own report, limiter and fault modules; only `client/` itself is browser code.
  if (isUnder(specifier, "@/lib/observability") && !isUnder(specifier, BARREL)) return "server-side observability code";
  if (specifier.startsWith("cloudflare:")) return "the Workers runtime";
  if (specifier.startsWith("astro:")) return "an Astro virtual module";
  if (specifier.startsWith("node:") || NODE_BUILTINS.has(specifier.split("/")[0])) return "a Node built-in";
  return null;
}

/** Why the service worker's reporter may not import `specifier` (alias form), or `null` when it may. */
function workerImportReason(specifier: string): string | null {
  if (specifier === BARREL || specifier === `${BARREL}/index`) return "the page's barrel, which holds browser.ts";
  if (isUnder(specifier, "@/lib/observability/log-failure")) return "the logger";
  return null;
}

function offenders(files: string[], reasonFor: (specifier: string) => string | null): string[] {
  return files.flatMap((file) =>
    importSpecifiers(readFileSync(file, "utf8")).flatMap((specifier) => {
      const reason = reasonFor(aliasForm(file, specifier));
      return reason === null ? [] : [`${relative(SRC, file)} imports ${specifier} (${reason})`];
    }),
  );
}

const CLIENT_SOURCES = readdirSync(CLIENT_DIR)
  .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
  .map((name) => join(CLIENT_DIR, name));
const WORKER_SOURCES = [join(SRC, "sw.ts"), join(SRC, "lib/offline/report.ts")];

const specifiersOf = (file: string) => importSpecifiers(readFileSync(file, "utf8"));

describe("client reporting import guard", () => {
  it("keeps every module under observability/client free of server code, and the barrel out of the service worker", () => {
    // Non-vacuity: the scans cover the five modules and the two worker files, and read their real imports.
    expect(CLIENT_SOURCES.map((file) => relative(CLIENT_DIR, file)).sort()).toEqual([
      "browser.ts",
      "classify.ts",
      "index.ts",
      "reporter.ts",
      "steps.ts",
    ]);
    const barrel = CLIENT_SOURCES.find((file) => file.endsWith("index.ts"));
    expect(barrel && specifiersOf(barrel), "the barrel re-exports the page's reporter").toContain("./browser");
    const browser = CLIENT_SOURCES.find((file) => file.endsWith("browser.ts"));
    expect(browser && specifiersOf(browser)).toEqual(["./reporter", "./steps"]);
    expect(WORKER_SOURCES.map((file) => relative(SRC, file))).toEqual(["sw.ts", "lib/offline/report.ts"]);
    expect(specifiersOf(WORKER_SOURCES[0])).toContain("@/lib/offline/report");
    expect(specifiersOf(WORKER_SOURCES[1])).toEqual([
      "@/lib/observability/client/reporter",
      "@/lib/observability/client/steps",
    ]);

    expect(offenders(CLIENT_SOURCES, serverImportReason), "client modules importing server code").toEqual([]);
    expect(offenders(WORKER_SOURCES, workerImportReason), "the service worker importing the page's reporter").toEqual(
      [],
    );
  });

  it("flags a sample of every forbidden family, by alias and by relative path, and leaves the allowed imports alone", () => {
    const inClient = join(CLIENT_DIR, "sample.ts");
    const forbidden = [
      "@/lib/engine",
      "@/lib/engine/parameters",
      "astronomy-engine",
      "@/lib/catalogue",
      "@/lib/catalogue/stars",
      "@/lib/observability/log-failure",
      "@/lib/observability/client-report",
      "@/lib/observability/rate-limit",
      "../log-failure",
      "../../engine/parameters",
      "../../catalogue/index",
      "cloudflare:workers",
      "astro:env/server",
      "astro:middleware",
      "node:fs",
      "fs",
      "path",
      "crypto",
      "node:crypto",
    ];
    for (const specifier of forbidden) {
      const source = `import { x } from "${specifier}";`;
      expect(serverImportReason(aliasForm(inClient, importSpecifiers(source)[0])), `must refuse ${specifier}`).not.toBe(
        null,
      );
    }
    for (const specifier of ["./reporter", "./steps", "./classify", "@/lib/observability/client/steps", "react"]) {
      expect(serverImportReason(aliasForm(inClient, specifier)), `must allow ${specifier}`).toBe(null);
    }

    const inWorker = join(SRC, "lib/offline/sample.ts");
    for (const specifier of [
      "@/lib/observability/client",
      "@/lib/observability/client/index",
      "../observability/client",
      "@/lib/observability/log-failure",
      "../observability/log-failure",
    ]) {
      expect(workerImportReason(aliasForm(inWorker, specifier)), `the worker must refuse ${specifier}`).not.toBe(null);
    }
    for (const specifier of [
      "@/lib/observability/client/reporter",
      "@/lib/observability/client/steps",
      "../observability/client/classify",
      "@/lib/offline/report",
    ]) {
      expect(workerImportReason(aliasForm(inWorker, specifier)), `the worker must allow ${specifier}`).toBe(null);
    }
  });

  it("reads static imports, re-exports and dynamic imports from an in-memory source and ignores comments", () => {
    const sample = [
      'import { a } from "./reporter";',
      "import type { B } from '@/lib/engine';",
      'export * from "../log-failure";',
      'const lazy = import("node:fs");',
      '// import { c } from "@/lib/catalogue";',
      '/* export * from "cloudflare:workers"; */',
      'import "astro:env/server";',
    ].join("\n");
    expect(importSpecifiers(sample)).toEqual([
      "./reporter",
      "@/lib/engine",
      "../log-failure",
      "node:fs",
      "astro:env/server",
    ]);
  });
});
