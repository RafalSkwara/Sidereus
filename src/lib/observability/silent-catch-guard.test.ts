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
 * - calls `logFailure` or `logNotice` (`@/lib/observability/log-failure`), `logReadFailure`
 *   (`@/lib/observability/read-failure`, the pages' read failures, which picks one of the two by the fault) or
 *   `saveFailureKey` (`@/lib/observability/save-failure`, the save routes' one step: it logs a server fault, a refusal
 *   and a session fault, and stays silent only for the user's own input mistake), or
 * - calls `report` / `reportAnd` / `<reporter>.report`, the browser-side reporters (the page's `@/lib/observability/client`, the worker's `@/lib/offline/report`), recognised by
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

const LOG_NAMES = new Set(["logFailure", "logNotice", "logReadFailure", "saveFailureKey"]);
/** The modules the browser-side reporters are imported from: the page's barrel and the service worker's module. */
const REPORTER_MODULES = new Set(["@/lib/observability/client", "@/lib/offline/report"]);
const REPORTER_NAMES = new Set(["report", "reportAnd"]);

/** Reasons shared by many entries. */
const INPUT =
  "an unparsable or invalid value from outside is an expected outcome, not a fault: the caller gets null, false or a validation issue";
const GEOLOCATION = "a denied or unavailable geolocation is the user's choice and would be noise";
const MEMO_RESET =
  "resets the memo only; the same rejection still reaches every awaiting caller, which reports it (island.import)";
const STORE_FAULT =
  "audit finding F8: the catch returns { ok: false, message, fault } with the sanitized fault built by faultFrom, and the route's saveFailureKey logs it, so the catch itself stays allowlisted";

/**
 * Every file with silent sites, the exact number of them and why they are tolerated. A catch, a `.catch(...)` or the
 * second argument of a `.then(ok, fail)` counts as one site. Every entry stays for a reason: the browser side is
 * reported by the client reporters (Phases 7-9), so what is left there either cannot report (the reporter's own
 * failure), is routine by design (D14, geolocation, the install prompt), or reaches a site that reports. Reasons carry no
 * line numbers: the guard's failure message names the lines.
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
  "src/lib/observability/client/reporter.ts": {
    count: 1,
    reason:
      "the client reporter must never throw and cannot report its own failure anywhere else (it would recurse): a send that throws or rejects, or a value that defeats a read, is absorbed in the one handler",
  },
  "src/lib/observability/client-report.ts": {
    count: 2,
    reason: `${INPUT} (a client report that is not JSON, or a body the client broke off mid-upload, is refused with 400; the route logs nothing for a refused report, so a forged or aborted request cannot leave a line, D13)`,
  },
  "src/lib/observability/client/browser.ts": {
    count: 1,
    reason:
      "the hydration test reads the message of whatever the page threw, which can throw (a getter) and cannot be reported anywhere else: the read falls back to no message and the error is still reported, as island.uncaught",
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
      "throws a fixed-message error without a cause on purpose (the cause can quote the request URL, which carries the search text); the failure surfaces in the place search's rejection handler in LocationPicker.tsx, which reports it as island.geocode",
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

  // The browser side (service worker and islands), where no server line can be written.
  "src/sw.ts": {
    count: 6,
    reason:
      "two things. Four catches (network-first, the navigation route and networkOrOffline) fall back to the stored copy and rethrow only when there is none: a returned fallback swallows the failure, and that fallback is the feature, so a routine network fault there stays unreported (D14). And the index queue's two sites (serial's `.then(task, task)` and its `.catch`) swallow nothing: the same `run` is returned and awaited by its callers, which report in nearly every case (the one exception, `purge()` awaited at the auth route, escapes to Workbox, as before this change), so the rejection reaches a site that reports (a report at the `.catch` would send a second report of one failure under another step), and `indexQueue` is never rejected, so the `.then` rejection handler is unreachable",
  },
  "src/components/location/LocationPicker.tsx": {
    count: 3,
    reason: `three silent sites that stay: the map chunk's memo reset (${MEMO_RESET}: the map-open rejection and the failed-import consumers above it report island.import), and two geolocation sites, the "Use my location" rejection and the recentre lookup (${GEOLOCATION})`,
  },
  "src/components/location/map-panel.tsx": {
    count: 1,
    reason:
      "forwards to the browser's reportError, which the global handler reports (as island.uncaught: Leaflet and the panel are /_astro/ chunks); the guard does not know reportError as a reporter, and a failed stylesheet load is reported by the memo's own handler as island.import",
  },
  "src/lib/gear/catalogue/load.ts": {
    count: 2,
    reason: `${MEMO_RESET}: the telescope and eyepiece catalogue loaders`,
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

/** A call that writes the failure down: `logFailure(...)`, `logNotice(...)`, `logReadFailure(...)`, `saveFailureKey(...)`, an imported `report(...)` / `reportAnd(...)`. */
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
const SAMPLES: { name: string; silent: string; reported: string; path?: string }[] = [
  {
    name: "a failed read turned into a redirect key without saveFailureKey",
    silent: `try {\n  await read();\n} catch (error) {\n  return fail(thrownKey(error, "errors.save.sessionPlan"));\n}\n`,
    reported: `try {\n  await read();\n} catch (error) {\n  return fail(saveFailureKey("save.plan", { message: thrownKey(error, "errors.save.sessionPlan"), ...withFault(error) }));\n}\n`,
  },
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
    name: "a page read that falls back to a banner",
    silent: `let loadError = null;\ntry {\n  rows = await store.list();\n} catch (error) {\n  loadError = "errors.load.observations";\n}\n`,
    reported: `let loadError = null;\ntry {\n  rows = await store.list();\n} catch (error) {\n  logReadFailure("read.log", error);\n  loadError = "errors.load.observations";\n}\n`,
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
  {
    name: "a rethrow whose cause is not the caught error",
    silent: `try {\n  await fetchIt();\n} catch (error) {\n  throw new Error("fixed", { cause: other });\n}\n`,
    reported: `try {\n  await fetchIt();\n} catch (error) {\n  throw new Error("fixed", { cause: error });\n}\n`,
  },
  {
    name: "a nested catch that logs while the outer one stays silent",
    silent: `try {\n  a();\n} catch {\n  try {\n    b();\n  } catch (error) {\n    logFailure("forecast.fetch", error);\n  }\n}\n`,
    reported: `try {\n  a();\n} catch (outer) {\n  logFailure("forecast.fetch", outer);\n  try {\n    b();\n  } catch (error) {\n    logFailure("forecast.fetch", error);\n  }\n}\n`,
  },
  {
    name: "a .then(ok, fail) with a named handler",
    silent: `p.then(ok, fail);\n`,
    reported: `p.then(ok, (error: unknown) => {\n  logFailure("tonight.build", error);\n});\n`,
  },
  {
    name: "a catch in a .tsx file",
    path: "src/sample.tsx",
    silent: `const x = <div />;\ntry { a(); } catch { /* none */ }\n`,
    reported: `const x = <div />;\ntry { a(); } catch (error) { logFailure("read.log", error); }\n`,
  },
  {
    name: "a catch in an .astro frontmatter",
    path: "src/pages/sample.astro",
    silent: `---\nimport Layout from "../layouts/Layout.astro";\ntry {\n  await load();\n} catch {\n  // ignored\n}\n---\n\n<Layout />\n`,
    reported: `---\nimport Layout from "../layouts/Layout.astro";\ntry {\n  await load();\n} catch (error) {\n  logFailure("read.log", error);\n}\n---\n\n<Layout />\n`,
  },
  {
    name: "a .catch in an .astro script block, beside a JSON-LD block that holds no code",
    path: "src/pages/sample.astro",
    silent: `---\nconst title = "x";\n---\n<div></div>\n<script>\n  load().catch(() => null);\n</script>\n<script type="application/ld+json">\n  {"a": 1}\n</script>\n`,
    reported: `---\nconst title = "x";\n---\n<div></div>\n<script>\n  load().catch((error) => { logFailure("read.log", error); });\n</script>\n<script type="application/ld+json">\n  {"a": 1}\n</script>\n`,
  },
];

describe("analyzeSource: the guard's rule on in-memory samples", () => {
  it("finds one silent site in each shape as written and none once it reports", () => {
    expect(SAMPLES.length).toBeGreaterThanOrEqual(17);
    SAMPLES.forEach(({ name, silent, reported, path }, i) => {
      const file = path ?? "src/sample.ts";
      expect(analyzeSource(silent, file).silent, `case ${String(i)}: ${name} without a report`).toHaveLength(1);
      expect(analyzeSource(reported, file).silent, `case ${String(i)}: ${name} with a report`).toEqual([]);
    });
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
