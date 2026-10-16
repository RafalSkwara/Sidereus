import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Silent-catch guard (error-visibility D8): a failure in runtime code must leave a trace, so every `catch` clause,
 * every `.catch(...)` handler and every rejection handler given to `.then(ok, fail)` under src either reports or is
 * on the allowlist below with a reason. A new silent catch therefore fails CI, whatever its shape (an empty block, a
 * fallback expression, a rethrow without a cause or on one branch only, an error turned into a redirect or a key, a
 * constant).
 *
 * A site passes when its handler:
 *
 * - calls `logFailure` or `logNotice` (`@/lib/observability/log-failure`), or
 * - calls `report` / `reportAnd` / `<reporter>.report`, the browser-side reporters of Phases 7-9, recognised by
 *   name and only when the file imports them from `@/lib/observability/client` or `@/lib/offline/report` (for a
 *   `.catch(...)` or `.then(ok, ...)` the argument may itself be the call, `.catch(reportAnd("sw.index", undefined))`),
 *   or
 * - rethrows on every path: a bare `throw error` of the caught binding, or `throw new X(message, { cause })` whose
 *   cause is built from the caught binding, in a handler with no `return` of its own (outside nested functions). A
 *   handler that returns on some branch (`if (stored) return stored; throw error;`, or `if (error instanceof
 *   Redirect) throw error; return null;`) swallows the failures that take that branch, so it is judged as silent.
 *
 * Every other site is counted per file and compared with `ALLOWED_SILENT_CATCHES`, exactly like the no-console
 * guard's `ALLOWED_DISABLES`: more sites than the allowance fail (with their line numbers), and so does an
 * allowance that is not fully used, so a change that fixes a file must delete its entry. Each entry carries the
 * reason the sites are tolerated.
 *
 * Scope: `.ts` and `.tsx` under src (not tests, not `src/lib/test-support`, not generated files) and the frontmatter
 * and `<script>` blocks of `.astro` files, each parsed once with the TypeScript compiler API. Blind spots: a
 * `.catch(handler)` or `.then(ok, handler)` whose handler is a named function or reference (it counts as a site and
 * needs a report or an allowance, even when the function reports), a two-argument `.then` on a non-promise thenable
 * (it would count as a site), `try`/`finally` without a catch, and `.astro` template expressions (none exist today).
 */

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SRC_DIR = join(REPO_ROOT, "src");
const SELF = "src/lib/observability/silent-catch-guard.test.ts";

/** Generated files and the Vitest seams: not runtime code. */
const EXCLUDED_FILES = new Set(["src/lib/database.types.ts"]);
const EXCLUDED_DIRS = ["src/lib/test-support/"];

const LOG_NAMES = new Set(["logFailure", "logNotice"]);
/** The modules the browser-side reporters are imported from (they do not exist before Phase 7). */
const REPORTER_MODULES = new Set(["@/lib/observability/client", "@/lib/offline/report"]);
const REPORTER_NAMES = new Set(["report", "reportAnd"]);

/** Reasons shared by many entries. */
const CLIENT = "reported by Phases 7-9, or out of scope if that block is cut";
const INPUT =
  "an unparsable or invalid value from outside is an expected outcome, not a fault: the caller gets null, false or a validation issue";
const GEOLOCATION = "a denied or unavailable geolocation is the user's choice and would be noise";
const STORE_FAULT =
  "audit finding F8: the catch returns { ok: false, message, fault } with the sanitized fault built by faultFrom, and the route's saveFailureKey logs it, so the catch itself stays allowlisted";

/**
 * Every file with silent sites, the exact number of them and why they are tolerated. A catch, a `.catch(...)` or the
 * second argument of a `.then(ok, fail)` counts as one site. The "Permanent" entries stay for good; the browser-side
 * ones are reported by the client reporting of Phases 7-9 (planned, a separate PR) and leave the list when each of
 * those phases lands, or stay with their reason if that block is cut. Reasons carry no line numbers: the guard's
 * failure message names the lines.
 */
const ALLOWED_SILENT_CATCHES: Partial<Record<string, { count: number; reason: string }>> = {
  // Permanent: justified and staying.
  "src/lib/observability/log-failure.ts": {
    count: 5,
    reason:
      "the logger must never throw: a getter, proxy or console that fails cannot be reported anywhere else (it would recurse), so each of the five reads and writes falls back to no field or no line",
  },
  "src/lib/observability/fault.ts": {
    count: 1,
    reason:
      "faultFrom runs in a failure path and must never throw: a getter or proxy that fails while its code, status or cause is read cannot be reported anywhere else, so the read falls back to no field",
  },
  "src/lib/auth-redirect.ts": { count: 1, reason: INPUT },
  "src/lib/offline/copies.ts": { count: 1, reason: INPUT },
  "src/lib/tonight/hash-scroll.ts": { count: 1, reason: INPUT },
  "src/lib/gear/zones.ts": { count: 1, reason: `${INPUT} (an unknown time zone name)` },
  "src/lib/onboarding/schemas.ts": {
    count: 1,
    reason: `${INPUT} (malformed JSON from the form becomes a validation issue)`,
  },
  "src/layouts/Layout.astro": {
    count: 1,
    reason: `client script: a malformed theme cookie keeps the server's theme; ${INPUT}`,
  },
  "src/lib/sky-checks/schemas.ts": {
    count: 1,
    reason: "zod's `.catch(default)` for an unknown `from` value: schema parsing, not error handling",
  },
  "src/lib/offline/coalesce.ts": {
    count: 1,
    reason:
      "keeps the first rejection and rethrows it once the key is idle (the caller decides), so the error is not lost",
  },
  "src/lib/account-plan/store.ts": {
    count: 1,
    reason:
      "returns the shaped code and name of the error as the result's fault; the caller, account-plan/index.ts, logs account.plan",
  },
  "src/lib/catalogue/finder-stars.ts": {
    count: 1,
    reason:
      "resets the memo only; the same rejection still reaches every awaiting caller, and the finder loader logs finder.stars",
  },
  "src/pages/log/progress.astro": {
    count: 2,
    reason:
      "both handlers report through logMilestoneFailure, a one-line wrapper over logFailure that this guard does not see through",
  },
  "src/lib/location/locate.ts": {
    count: 1,
    reason: `${GEOLOCATION} (a failing permission query only means no recentre)`,
  },
  "src/lib/forecast/cache.ts": {
    count: 1,
    reason:
      "withReadTimeout's `.then(resolve, reject)` forwards the rejection to the promise its caller awaits, so nothing is lost; the caller's catch in forecast/service.ts logs it as forecast.cache-read",
  },
  "src/lib/forecast/open-meteo.ts": {
    count: 2,
    reason:
      "throws fixed-message ForecastErrors without a cause on purpose (the cause can quote the request URL, which carries the coordinates); each carries a step and status, which forecast/service.ts logs as forecast.fetch, so the catches themselves stay allowlisted",
  },
  "src/lib/location/geocode.ts": {
    count: 1,
    reason:
      "throws a fixed-message error without a cause on purpose (the cause can quote the request URL, which carries the search text); the failure surfaces in the place search's rejection handler in LocationPicker.tsx, which Phase 9 reports as island.geocode, or is out of scope if that block is cut",
  },
  "src/lib/gear/store.ts": {
    count: 1,
    reason: `${STORE_FAULT} (toSiteColumns, whose fault the create and update results carry)`,
  },
  "src/lib/observations/store.ts": {
    count: 3,
    reason: `${STORE_FAULT} (the gear lookups of create and update and the latest-night bound)`,
  },
  "src/lib/onboarding/store.ts": {
    count: 1,
    reason: `${STORE_FAULT} (the time zone resolution of completeOnboarding)`,
  },

  "src/lib/offline/install.ts": {
    count: 1,
    reason:
      "a refused or already-used install prompt is the user's choice, not a failure (owner, 2026-10-15: stays silent for good, no island.install step)",
  },

  // The browser side (service worker and islands), where no server line can be written. The client reporting of
  // Phases 7-9 (planned, a separate PR) is to report these and delete the entries; if that block is cut they stay.
  "src/sw.ts": {
    count: 26,
    reason: `${CLIENT}: 18 .catch handlers, the two .then rejection handlers (the index queue's and the timeout fallback's) and two bare catch blocks would report through Phase 8's reportAnd and report. Four more catches (network-first, the navigation route and networkOrOffline) fall back to the stored copy and rethrow only when there is none: a returned fallback swallows the failure, and that fallback is the feature, so a routine network fault there stays unreported (D14)`,
  },
  "src/lib/offline/register.ts": {
    count: 1,
    reason: `${CLIENT}: service worker registration, island.sw-register (Phase 9)`,
  },
  "src/components/location/LocationPicker.tsx": {
    count: 5,
    reason: `${CLIENT}: the map import's memo reset, the map-open rejection (island.import) and the place search's rejection (island.geocode), all Phase 9; and two geolocation sites that stay silent, the "Use my location" rejection and the recentre lookup (${GEOLOCATION})`,
  },
  "src/components/location/map-panel.tsx": {
    count: 2,
    reason: `${CLIENT}: a failed stylesheet load resets its memo (island.import, Phase 9); the other catch forwards to the browser's reportError, which Phase 9's global handler reports`,
  },
  "src/lib/gear/catalogue/load.ts": {
    count: 2,
    reason: `${CLIENT}: a failed catalogue import resets its memo (island.import, Phase 9)`,
  },
  "src/components/gear/EyepieceForm.tsx": {
    count: 1,
    reason: `${CLIENT}: a failed catalogue import sets "unavailable" (island.import, Phase 9)`,
  },
  "src/components/gear/TelescopeForm.tsx": {
    count: 1,
    reason: `${CLIENT}: a failed catalogue import sets "unavailable" (island.import, Phase 9)`,
  },
  "src/components/onboarding/OnboardingWizard.tsx": {
    count: 2,
    reason: `${CLIENT}: the failed telescope and eyepiece catalogue imports set "unavailable" (island.import, Phase 9)`,
  },
};

type SiteKind = "catch" | ".catch" | ".then";

interface Site {
  kind: SiteKind;
  line: number;
}

interface FileAnalysis {
  /** Every catch clause, `.catch(...)` call and `.then(ok, fail)` call, passing or not. */
  total: number;
  /** The sites that neither report nor rethrow with a cause. */
  silent: Site[];
}

/** What a chunk of source imports, as far as the recogniser needs it. */
interface Imports {
  /** Local names bound to `report` / `reportAnd` imported from a reporter module. */
  reporters: Set<string>;
  /** True when anything is imported from a reporter module (a `<reporter>.report(...)` call then counts). */
  fromReporterModule: boolean;
}

function importsOf(sourceFile: ts.SourceFile): Imports {
  const imports: Imports = { reporters: new Set(), fromReporterModule: false };
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!REPORTER_MODULES.has(statement.moduleSpecifier.text)) continue;
    imports.fromReporterModule = true;
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if (REPORTER_NAMES.has((element.propertyName ?? element.name).text)) imports.reporters.add(element.name.text);
    }
  }
  return imports;
}

function isFunction(node: ts.Node): boolean {
  return (
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

/** True when `test` holds for `root` or any node below it that is not behind `skip` (a nested site judged on its own). */
function someNode(root: ts.Node, test: (node: ts.Node) => boolean, skip: (node: ts.Node) => boolean): boolean {
  const visit = (node: ts.Node): boolean => {
    if (test(node)) return true;
    return ts.forEachChild(node, (child) => (skip(child) ? undefined : visit(child) ? true : undefined)) === true;
  };
  return visit(root);
}

function mentions(root: ts.Node, name: string): boolean {
  return someNode(
    root,
    (node) => ts.isIdentifier(node) && node.text === name,
    () => false,
  );
}

/** `catch` clauses nested inside a handler are sites of their own: a log there does not excuse the outer one. */
const skipNestedCatch = (node: ts.Node): boolean => ts.isCatchClause(node);

/** A call that writes the failure down: `logFailure(...)`, `logNotice(...)`, an imported `report(...)` / `reportAnd(...)`. */
function isReportingCall(node: ts.Node, imports: Imports): boolean {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return LOG_NAMES.has(callee.text) || imports.reporters.has(callee.text);
  return ts.isPropertyAccessExpression(callee) && callee.name.text === "report" && imports.fromReporterModule;
}

/** `throw error` of the caught binding, or `throw new X(message, { cause })` whose cause is built from it. */
function isRethrowWithCause(node: ts.Node, binding: string | undefined): boolean {
  if (binding === undefined || !ts.isThrowStatement(node)) return false;
  const thrown = node.expression;
  if (ts.isIdentifier(thrown)) return thrown.text === binding;
  if (!ts.isNewExpression(thrown)) return false;
  return (thrown.arguments ?? []).some(
    (argument) =>
      ts.isObjectLiteralExpression(argument) &&
      argument.properties.some((property) => {
        if (ts.isShorthandPropertyAssignment(property)) {
          return property.name.text === "cause" && property.name.text === binding;
        }
        return (
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.name) &&
          property.name.text === "cause" &&
          mentions(property.initializer, binding)
        );
      }),
  );
}

/**
 * Does a handler body (a catch block, or the body of a `.catch` / `.then` rejection callback) report or rethrow with
 * a cause? A rethrow counts only when the handler has no `return` of its own: `if (stored) return stored; throw
 * error;` and `if (error instanceof Redirect) throw error; return null;` both swallow some failures.
 */
function handlerPasses(body: ts.Node, binding: string | undefined, imports: Imports): boolean {
  const skipFunctionsAndCatch = (node: ts.Node): boolean => skipNestedCatch(node) || isFunction(node);
  if (someNode(body, (node) => isReportingCall(node, imports), skipNestedCatch)) return true;
  if (someNode(body, (node) => ts.isReturnStatement(node), isFunction)) return false;
  return someNode(body, (node) => isRethrowWithCause(node, binding), skipFunctionsAndCatch);
}

/** The rejection handler of a `.catch(handler)` call or the second argument of a `.then(ok, handler)` call. */
function rejectionHandlerPasses(handler: ts.Expression, imports: Imports): boolean {
  if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) {
    const parameter = handler.parameters.at(0);
    const binding = parameter !== undefined && ts.isIdentifier(parameter.name) ? parameter.name.text : undefined;
    return handlerPasses(handler.body, binding, imports);
  }
  // `.catch(reportAnd("sw.index", undefined))`: the handler is made by the reporter's own helper.
  return (
    ts.isCallExpression(handler) &&
    ts.isIdentifier(handler.expression) &&
    imports.reporters.has(handler.expression.text)
  );
}

/** Finds every site in one chunk of TypeScript (`lineOffset` places an `.astro` chunk in its file). */
function analyzeChunk(code: string, scriptKind: ts.ScriptKind, lineOffset: number): FileAnalysis {
  const sourceFile = ts.createSourceFile("chunk.ts", code, ts.ScriptTarget.Latest, true, scriptKind);
  const imports = importsOf(sourceFile);
  const analysis: FileAnalysis = { total: 0, silent: [] };
  const lineOf = (position: number): number => sourceFile.getLineAndCharacterOfPosition(position).line + 1 + lineOffset;

  const visit = (node: ts.Node): void => {
    if (ts.isCatchClause(node)) {
      analysis.total++;
      const binding =
        node.variableDeclaration !== undefined && ts.isIdentifier(node.variableDeclaration.name)
          ? node.variableDeclaration.name.text
          : undefined;
      if (!handlerPasses(node.block, binding, imports)) {
        analysis.silent.push({ kind: "catch", line: lineOf(node.getStart(sourceFile)) });
      }
    } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      // `.catch(handler)`, and the second argument of `.then(ok, handler)` (a one-argument `.then` has none).
      const handler = method === "catch" ? node.arguments.at(0) : method === "then" ? node.arguments.at(1) : undefined;
      if (handler !== undefined) {
        analysis.total++;
        if (!rejectionHandlerPasses(handler, imports)) {
          analysis.silent.push({
            kind: method === "catch" ? ".catch" : ".then",
            line: lineOf(node.expression.name.getStart(sourceFile)),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return analysis;
}

const FRONTMATTER = /^---[^\S\n]*\r?\n([\s\S]*?)\r?\n---/;
const SCRIPT_BLOCK = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
/** A `<script type="...">` that is not JavaScript (JSON-LD, import maps) holds no code to scan. */
const NON_JS_SCRIPT = /\btype\s*=\s*["'](?!module["']|text\/javascript["']|text\/typescript["'])/;

function lineCount(text: string): number {
  return text.split("\n").length - 1;
}

/** Analyzes one file's source: TypeScript as is, an `.astro` file as its frontmatter plus its `<script>` blocks. */
export function analyzeSource(source: string, path: string): FileAnalysis {
  if (!path.endsWith(".astro")) {
    return analyzeChunk(source, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS, 0);
  }
  const result: FileAnalysis = { total: 0, silent: [] };
  const add = (chunk: FileAnalysis): void => {
    result.total += chunk.total;
    result.silent.push(...chunk.silent);
  };
  const frontmatter = FRONTMATTER.exec(source);
  if (frontmatter !== null) {
    // The frontmatter starts on the line after the opening fence.
    add(analyzeChunk(frontmatter[1], ts.ScriptKind.TS, 1));
  }
  for (const match of source.matchAll(SCRIPT_BLOCK)) {
    if (NON_JS_SCRIPT.test(match[1])) continue;
    const bodyStart = match.index + match[0].indexOf(">") + 1;
    add(analyzeChunk(match[2], ts.ScriptKind.TS, lineCount(source.slice(0, bodyStart))));
  }
  result.silent.sort((a, b) => a.line - b.line);
  return result;
}

function isScanned(file: string): boolean {
  if (file === SELF || EXCLUDED_FILES.has(file)) return false;
  if (EXCLUDED_DIRS.some((dir) => file.startsWith(dir))) return false;
  if (/\.test\.tsx?$/.test(file) || file.endsWith(".d.ts")) return false;
  return /\.(?:ts|tsx|astro)$/.test(file);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

const files = sourceFiles(SRC_DIR)
  .map((path) => relative(REPO_ROOT, path))
  .filter(isScanned)
  .sort();

/** Parses every scanned file once; the guard cases below share the result. */
const inventory = new Map<string, FileAnalysis>();
for (const file of files) inventory.set(file, analyzeSource(readFileSync(join(REPO_ROOT, file), "utf8"), file));

const describeSites = (sites: Site[]): string =>
  sites.map((site) => `${String(site.line)}${site.kind === "catch" ? "" : ` (${site.kind})`}`).join(", ");

/** Compares the inventory with an allowlist; every line of the result is one violation, naming the sites. */
function violationsOf(
  analysis: ReadonlyMap<string, FileAnalysis>,
  allowed: Partial<Record<string, { count: number; reason: string }>>,
): string[] {
  const violations: string[] = [];
  for (const [file, { silent }] of analysis) {
    const allowance = allowed[file]?.count ?? 0;
    if (silent.length > allowance) {
      violations.push(
        `${file}: ${String(silent.length)} silent site(s), allowed ${String(allowance)}; lines ${describeSites(silent)}. Log it with logFailure(step, error), or rethrow with a cause`,
      );
    } else if (silent.length < allowance) {
      violations.push(
        `${file}: ${String(silent.length)} silent site(s), allowed ${String(allowance)}: the allowance is not fully used, lower it or delete the entry`,
      );
    }
  }
  for (const [file, entry] of Object.entries(allowed)) {
    if (!analysis.has(file))
      violations.push(`${file}: allowlisted but not a scanned file (moved, deleted or excluded?)`);
    if (entry?.reason.trim() === "") violations.push(`${file}: allowlist entry without a reason`);
  }
  return violations;
}

/** In-memory samples of the shapes the audit found: each is silent as written and passes once it reports. */
const SAMPLES: { name: string; silent: string; reported: string }[] = [
  {
    name: "an empty block with a comment",
    silent: `try {\n  await save();\n} catch {\n  // never mind\n}\n`,
    reported: `import { logFailure } from "@/lib/observability/log-failure";\ntry {\n  await save();\n} catch (error) {\n  logFailure("forecast.fetch", error);\n}\n`,
  },
  {
    name: "a fallback expression",
    silent: `function read() {\n  try {\n    return fetchIt();\n  } catch {\n    return usable ? fromStored(copy) : null;\n  }\n}\n`,
    reported: `function read() {\n  try {\n    return fetchIt();\n  } catch (error) {\n    logFailure("forecast.fetch", error);\n    return usable ? fromStored(copy) : null;\n  }\n}\n`,
  },
  {
    name: "a rethrow without a cause",
    silent: `try {\n  await fetchIt();\n} catch {\n  throw new Error("The forecast request failed");\n}\n`,
    reported: `try {\n  await fetchIt();\n} catch (error) {\n  logNotice("forecast.fetch", error);\n  throw new Error("The forecast request failed");\n}\n`,
  },
  {
    name: "an error turned into a redirect or a key",
    silent: `try {\n  await save();\n} catch (error) {\n  return fail(thrownKey(error));\n}\n`,
    reported: `try {\n  await save();\n} catch (error) {\n  logFailure("tonight.plan-edits", error);\n  return fail(thrownKey(error));\n}\n`,
  },
  {
    name: "a constant return",
    silent: `async function load() {\n  try {\n    return await read();\n  } catch (error) {\n    return null;\n  }\n}\n`,
    reported: `async function load() {\n  try {\n    return await read();\n  } catch (error) {\n    logFailure("tonight.plan-edits", error);\n    return null;\n  }\n}\n`,
  },
  {
    name: "a .catch handler that returns a constant",
    silent: `const stored = await index.read().catch(() => undefined);\n`,
    reported: `const stored = await index.read().catch((error: unknown) => {\n  logNotice("progress.seen", error);\n  return undefined;\n});\n`,
  },
  {
    name: "a conditional rethrow that returns on another branch",
    silent: `async function read() {\n  try {\n    return await fetchIt();\n  } catch (error) {\n    const stored = await readStored();\n    if (stored) return stored;\n    throw error;\n  }\n}\n`,
    reported: `async function read() {\n  try {\n    return await fetchIt();\n  } catch (error) {\n    logNotice("forecast.fetch", error);\n    const stored = await readStored();\n    if (stored) return stored;\n    throw error;\n  }\n}\n`,
  },
  {
    name: "a rejection handler given to .then(ok, fail)",
    silent: `load().then(use, () => undefined);\n`,
    reported: `load().then(use, (error: unknown) => {\n  logFailure("tonight.build", error);\n});\n`,
  },
  {
    name: "a .catch(reportAnd(...)) handler without its import",
    silent: `const stored = await index.read().catch(reportAnd("sw.index", undefined));\n`,
    reported: `import { reportAnd } from "@/lib/offline/report";\nconst stored = await index.read().catch(reportAnd("sw.index", undefined));\n`,
  },
];

describe("analyzeSource: the guard's rule on in-memory samples", () => {
  it.each(SAMPLES)("$name is silent as written and passes once it reports", ({ silent, reported }) => {
    expect(analyzeSource(silent, "src/sample.ts").silent, "without a report").toHaveLength(1);
    expect(analyzeSource(reported, "src/sample.ts").silent, "with a report").toEqual([]);
  });

  it("reports the line of each silent site", () => {
    const source = `const a = 1;\ntry {\n  a();\n} catch {\n  // ignored\n}\nb().catch(() => null);\n`;
    expect(analyzeSource(source, "src/sample.ts").silent).toEqual([
      { kind: "catch", line: 4 },
      { kind: ".catch", line: 7 },
    ]);
  });

  it("treats a reporter as one only when the file imports it from a reporter module", () => {
    const call = `x().catch(reportAnd("sw.index", undefined));\n`;
    expect(analyzeSource(`import { reportAnd } from "@/lib/offline/report";\n${call}`, "src/a.ts").silent).toEqual([]);
    expect(
      analyzeSource(`import { reportAnd } from "@/lib/observability/client";\n${call}`, "src/a.ts").silent,
    ).toEqual([]);
    expect(analyzeSource(`import { reportAnd } from "./elsewhere";\n${call}`, "src/a.ts").silent).toHaveLength(1);
    expect(analyzeSource(`import { other } from "@/lib/offline/report";\n${call}`, "src/a.ts").silent).toHaveLength(1);
    const aliased = `import { report as send } from "@/lib/offline/report";\nx().catch((e) => send("sw.shell", e));\n`;
    expect(analyzeSource(aliased, "src/a.ts").silent).toEqual([]);
    const method = `import { createReporter } from "@/lib/observability/client";\nconst r = createReporter();\ntry { a(); } catch (e) { r.report("sw.shell", e); }\n`;
    expect(analyzeSource(method, "src/a.ts").silent).toEqual([]);
    expect(analyzeSource(`try { a(); } catch (e) { r.report("sw.shell", e); }\n`, "src/a.ts").silent).toHaveLength(1);
    expect(analyzeSource(`try { a(); } catch (e) { report("sw.shell", e); }\n`, "src/a.ts").silent).toHaveLength(1);
  });

  it("accepts a rethrow only with the caught error as the cause (or a bare rethrow)", () => {
    const rethrows = (body: string): number =>
      analyzeSource(`try { a(); } catch (error) { ${body} }\n`, "src/a.ts").silent.length;
    expect(rethrows("throw error;")).toBe(0);
    expect(rethrows('throw new Error("fixed", { cause: error });')).toBe(0);
    expect(rethrows('throw new Error("fixed", { cause: faultFrom(error) });')).toBe(0);
    expect(rethrows('throw new Error("fixed");')).toBe(1);
    expect(rethrows('throw new Error("fixed", { cause: other });')).toBe(1);
    expect(rethrows('throw new Error("fixed", { cause: undefined });')).toBe(1);
    expect(rethrows("throw other;")).toBe(1);
    // A throw inside a callback does not leave the handler.
    expect(rethrows("queue(() => { throw error; });")).toBe(1);
    // A rethrow on one branch only: the other branch swallows the failure, wherever the return sits.
    expect(rethrows("if (stored) return stored; throw error;")).toBe(1);
    expect(rethrows("if (error instanceof Redirect) throw error; return null;")).toBe(1);
    expect(rethrows("return; throw error;")).toBe(1);
    // A return inside a nested function is not the handler's own.
    expect(rethrows("const pick = () => { return 1; }; throw error;")).toBe(0);
    expect(rethrows('if (isRoutine(error)) { logNotice("forecast.fetch", error); return null; } throw error;')).toBe(0);
    // A catch without a binding has no cause to keep.
    expect(
      analyzeSource('try { a(); } catch { throw new Error("fixed", { cause: undefined }); }\n', "src/a.ts").silent,
    ).toHaveLength(1);
    expect(
      analyzeSource('try { a(); } catch (cause) { throw new Error("fixed", { cause }); }\n', "src/a.ts").silent,
    ).toEqual([]);
  });

  it("counts the second argument of a two-argument .then as a site, judged like a .catch handler", () => {
    const silentCount = (source: string): number => analyzeSource(source, "src/a.ts").silent.length;
    expect(silentCount("p.then(ok, () => undefined);")).toBe(1);
    expect(silentCount("p.then(ok, fail);")).toBe(1);
    expect(silentCount("p.then(ok, (error) => { throw error; });")).toBe(0);
    expect(silentCount("p.then(ok, (error) => { if (a) return 1; throw error; });")).toBe(1);
    expect(silentCount('p.then(ok, (error) => { logFailure("tonight.build", error); });')).toBe(0);
    expect(
      silentCount(`import { reportAnd } from "@/lib/offline/report";\np.then(ok, reportAnd("sw.index", undefined));`),
    ).toBe(0);
    // A one-argument `.then` has no rejection handler, and its callback is not judged.
    expect(silentCount("p.then(() => undefined);")).toBe(0);
    expect(analyzeSource("p.then(ok, () => undefined);\n", "src/a.ts").silent).toEqual([{ kind: ".then", line: 1 }]);
  });

  it("judges a nested catch on its own: a log inside it does not excuse the outer one", () => {
    const source = `try {\n  a();\n} catch {\n  try {\n    b();\n  } catch (error) {\n    logFailure("forecast.fetch", error);\n  }\n}\n`;
    expect(analyzeSource(source, "src/a.ts").silent).toEqual([{ kind: "catch", line: 3 }]);
  });

  it("scans .tsx and the frontmatter and scripts of .astro, placing each site on its file line", () => {
    expect(analyzeSource("const x = <div />;\ntry { a(); } catch { /* none */ }\n", "src/a.tsx").silent).toEqual([
      { kind: "catch", line: 2 },
    ]);

    const frontmatter = `---\nimport Layout from "../layouts/Layout.astro";\ntry {\n  await load();\n} catch {\n  // ignored\n}\n---\n\n<Layout />\n`;
    expect(analyzeSource(frontmatter, "src/pages/sample.astro").silent, "frontmatter catch").toEqual([
      { kind: "catch", line: 5 },
    ]);
    const reported = frontmatter
      .replace("// ignored", 'logFailure("read.log", error);')
      .replace("catch {", "catch (error) {");
    expect(analyzeSource(reported, "src/pages/sample.astro").silent, "frontmatter with a report").toEqual([]);

    const scripted = `---\nconst title = "x";\n---\n<div></div>\n<script>\n  load().catch(() => null);\n</script>\n<script type="application/ld+json">\n  {"a": 1}\n</script>\n`;
    expect(analyzeSource(scripted, "src/pages/sample.astro").silent, "script catch").toEqual([
      { kind: ".catch", line: 6 },
    ]);
  });
});

describe("silent-catch guard", () => {
  it("scans the runtime source tree, and only it", () => {
    expect(files.length).toBeGreaterThanOrEqual(250);
    for (const file of [
      "src/sw.ts",
      "src/lib/forecast/service.ts",
      "src/layouts/Layout.astro",
      "src/lib/gear/store.ts",
    ]) {
      expect(files, file).toContain(file);
    }
    expect(files.filter((file) => /\.test\.tsx?$/.test(file))).toEqual([]);
    expect(files.filter((file) => file.startsWith("src/lib/test-support/"))).toEqual([]);
    expect(files).not.toContain("src/lib/database.types.ts");
    expect(files).not.toContain(SELF);
    // Non-vacuity: the inventory finds catches, in .ts, .tsx and .astro files alike.
    const total = [...inventory.values()].reduce((sum, analysis) => sum + analysis.total, 0);
    expect(total).toBeGreaterThanOrEqual(60);
    for (const extension of [".ts", ".tsx", ".astro"]) {
      const withSites = [...inventory].filter(([file, analysis]) => file.endsWith(extension) && analysis.total > 0);
      expect(withSites.length, `${extension} files with a catch`).toBeGreaterThan(0);
    }
  });

  it("allows silent catches only where listed, with the exact count and a reason", () => {
    expect(
      violationsOf(inventory, ALLOWED_SILENT_CATCHES),
      "a silent catch needs logFailure(step, error), a rethrow with a cause, or an entry in ALLOWED_SILENT_CATCHES with its reason",
    ).toEqual([]);
  });

  it("fails a site above its allowance and an allowance that is not fully used, naming the lines", () => {
    const sample = new Map([
      ["src/sample.ts", analyzeSource("try { a(); } catch {}\nb().catch(() => null);\n", "src/sample.ts")],
    ]);
    expect(violationsOf(sample, {})).toEqual([
      expect.stringContaining("2 silent site(s), allowed 0; lines 1, 2 (.catch)"),
    ]);
    expect(violationsOf(sample, { "src/sample.ts": { count: 2, reason: "test" } })).toEqual([]);
    expect(violationsOf(sample, { "src/sample.ts": { count: 3, reason: "test" } })).toEqual([
      expect.stringContaining("not fully used"),
    ]);
    expect(violationsOf(sample, { "src/sample.ts": { count: 2, reason: " " } })).toEqual([
      expect.stringContaining("without a reason"),
    ]);
    expect(violationsOf(sample, { "src/gone.ts": { count: 1, reason: "test" } })).toEqual([
      expect.stringContaining("src/sample.ts: 2 silent"),
      expect.stringContaining("src/gone.ts: allowlisted but not a scanned file"),
    ]);
  });
});
