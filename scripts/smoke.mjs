// Smoke test: proves the built app, the Cloudflare adapter, the Supabase auth flow, onboarding, the gear routes and /tonight still work
// together. Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs
// It signs up a throwaway user and writes gear rows, so point it at local Supabase only (as CI does), never hosted.
// The finder-chart steps (finder-chart D-9, test-plan 6.4) also grant and remove the full plan through the operator command
// (`node scripts/account-plan.mjs <email> full|free`, a child process) with the SUPABASE_URL and SUPABASE_SECRET_KEY of
// the local stack, passed inline on the command: `SUPABASE_URL=<api url> SUPABASE_SECRET_KEY=<secret key> npm run smoke`.
// Never export the key (the preview must not inherit it). Without it those steps fail under CI and are skipped locally.

import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const email = `smoke-${Date.now()}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const site = {
  name: "Smoke site",
  latitudeDeg: "52.23",
  longitudeDeg: "21.01",
  bortle: "5",
  minAltitudeDeg: "20",
  timeZoneMode: "auto",
};
// The onboarding form's fields (`onboardingInputSchema`): the 150 mm reflector preset, the Supplied pair
// kit and the "Suburb" sky scene (Bortle 6).
const onboarding = {
  latitudeDeg: "52.23",
  longitudeDeg: "21.01",
  bortle: "6",
  telescopeName: "150 mm reflector",
  apertureMm: "150",
  focalLengthMm: "750",
  eyepieces: JSON.stringify([
    { name: "25 mm Plössl", focalLengthMm: "25", afovPreset: "plossl" },
    { name: "10 mm Plössl", focalLengthMm: "10", afovPreset: "plossl" },
  ]),
};
// PRD NFR session longevity (S-09): the auth cookie lives 30 days from the last refresh (src/lib/session-cookie.ts).
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const jar = new Map();

/**
 * Max-Age of every Supabase auth cookie a response writes (`sb-<ref>-auth-token`, possibly chunked `.0`, `.1`),
 * leaving out removals (Max-Age=0) of chunks that are no longer needed.
 */
function authCookieMaxAges(setCookies) {
  return setCookies
    .filter((raw) => /^sb-[^=]*-auth-token(\.\d+)?=/.test(raw))
    .map((raw) => Number(/;\s*max-age=(\d+)/i.exec(raw)?.[1] ?? NaN))
    .filter((maxAge) => maxAge !== 0);
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

async function request(path, { method = "GET", form, body = false } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  storeCookies(response);
  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
    setCookies: response.headers.getSetCookie(),
    // Read only when a step asks, so the redirect steps never wait on a body.
    body: body ? await response.text() : "",
  };
}

const ACCOUNT_PLAN_SCRIPT = fileURLToPath(new URL("./account-plan.mjs", import.meta.url));
const execFileAsync = promisify(execFile);
const hasPlanKey = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

/**
 * Grants or removes the full plan for the smoke user with the operator command. The child inherits SUPABASE_URL and
 * SUPABASE_SECRET_KEY from this process's environment; the key is never read, printed or put on a command line here.
 */
async function setPlan(plan) {
  try {
    await execFileAsync(process.execPath, [ACCOUNT_PLAN_SCRIPT, email, plan], { env: process.env });
  } catch (error) {
    const stderr = error instanceof Error && "stderr" in error ? String(error.stderr).trim() : "";
    throw new Error(`account-plan ${plan} failed${stderr ? `: ${stderr}` : ""}`, { cause: error });
  }
}

/**
 * Smoke's no-darkness window at its 52 N site (Bortle 6, dark threshold -15): about 8 June to 2 July, where the
 * ranking is empty and M13 is "not ranked". Same window as tests/e2e/helpers.ts.
 */
function inNoDarknessWindow(now = new Date()) {
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  return (month === 6 && day >= 8) || (month === 7 && day <= 2);
}

// The finder chart's server island (finder-chart Phase 6). The shell's preload link carries its signed URL; the island
// route is not behind the middleware, so replaying that URL is the HTTP proof that the island itself checks the plan.
const FINDER_ISLAND_PATH = "/_server-islands/FinderContent";
const FINDER_PAGE = "/tonight/finder?object=M13&from=targets";
let islandUrl = "";

/**
 * The finder island's URL from the shell's `<link rel="preload" as="fetch" href="/_server-islands/FinderContent?e=…">`,
 * or "" when there is none. The HTML escapes `&` as `&amp;` inside the attribute, so it is decoded here, as the service
 * worker's `islandUrlFromShell` (src/lib/offline/copies.ts) does; a POST island has no such link, so the capture is empty
 * and every step that needs it fails.
 */
function islandUrlFromShell(html) {
  for (const [, list] of html.matchAll(/<link\b([^>]*)>/gi)) {
    const attributes = new Map();
    for (const [, key, value] of list.matchAll(/([^\s"'>/=]+)\s*=\s*"([^"]*)"/g)) {
      attributes.set(key.toLowerCase(), value.replaceAll("&amp;", "&"));
    }
    const href = attributes.get("href") ?? "";
    if (
      attributes.get("rel") === "preload" &&
      attributes.get("as") === "fetch" &&
      href.startsWith(FINDER_ISLAND_PATH)
    ) {
      return href;
    }
  }
  return "";
}

/** A step that replays the captured island URL; fails loudly (never skips) when the capture is empty. */
function replayIsland() {
  if (!islandUrl) {
    return Promise.reject(new Error("no island URL was captured from the full account's shell (finder step 2 failed)"));
  }
  return request(islandUrl, { body: true });
}

const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  [
    "tonight redirects anonymous user, remembering the page",
    () => request("/tonight"),
    { status: 302, location: "/auth/signin?next=%2Ftonight", exact: true },
  ],
  [
    "signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email, password } }),
    { status: 302, location: "/onboarding", exact: true },
  ],
  ["onboarding renders", () => request("/onboarding"), { status: 200 }],
  [
    "invalid onboarding returns with error",
    () => request("/api/onboarding", { method: "POST", form: { ...onboarding, latitudeDeg: "95" } }),
    { status: 302, location: "/onboarding?error=errors.site.latitudeRange", exact: true, absent: "95" },
  ],
  [
    "onboarding saves and opens tonight",
    () => request("/api/onboarding", { method: "POST", form: onboarding }),
    { status: 302, location: "/tonight", exact: true },
  ],
  [
    "onboarding redirects once set up",
    () => request("/onboarding"),
    { status: 302, location: "/tonight", exact: true },
  ],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    { status: 302, location: "/auth/signin?error=" },
  ],
  [
    "signin rejects wrong password, keeping the page to continue to",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong", next: "/gear" } }),
    { status: 302, location: "/auth/signin?error=errors.auth.invalidCredentials&next=%2Fgear", exact: true },
  ],
  [
    "signin accepts correct password, with a 30-day session cookie",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/tonight", exact: true, sessionMaxAge: SESSION_MAX_AGE_SECONDS },
  ],
  [
    "signin continues to the requested page",
    () => request("/api/auth/signin", { method: "POST", form: { email, password, next: "/gear" } }),
    { status: 302, location: "/gear", exact: true },
  ],
  [
    "signin ignores an off-site next",
    () => request("/api/auth/signin", { method: "POST", form: { email, password, next: "//evil.example" } }),
    { status: 302, location: "/tonight", exact: true },
  ],
  ["gear renders", () => request("/gear"), { status: 200 }],
  [
    "create site redirects to gear",
    () => request("/api/gear/sites", { method: "POST", form: site }),
    { status: 302, location: "/gear?saved=site", exact: true },
  ],
  [
    "invalid site returns to form with error",
    () => request("/api/gear/sites", { method: "POST", form: { ...site, latitudeDeg: "95" } }),
    { status: 302, location: "/gear/sites/new?error=errors.site.latitudeRange", exact: true, absent: "95" },
  ],
  [
    "create telescope redirects to gear",
    () =>
      request("/api/gear/telescopes", {
        method: "POST",
        form: { name: "Smoke Newtonian", apertureMm: "130", focalLengthMm: "650" },
      }),
    { status: 302, location: "/gear?saved=telescope", exact: true },
  ],
  [
    "create eyepiece redirects to gear",
    () =>
      request("/api/gear/eyepieces", {
        method: "POST",
        form: { name: "Smoke Plossl", focalLengthMm: "25", afovPreset: "plossl" },
      }),
    { status: 302, location: "/gear?saved=eyepiece", exact: true },
  ],
  // Renders even when the forecast is unreachable: the verdict falls back to "marginal — no weather data".
  ["tonight renders for signed-in user", () => request("/tonight"), { status: 200 }],
  // Finder chart (finder-chart Phase 6, test-plan 6.4): the smoke user is on the free plan until step 2 grants it.
  [
    "finder 1: a free account's shell is the locked state, with no island",
    () => request(FINDER_PAGE, { body: true }),
    {
      status: 200,
      bodyIncludes: ['data-finder-state="locked"'],
      bodyExcludes: [FINDER_ISLAND_PATH, "data-finder-chart"],
    },
  ],
  [
    "finder 2: after the grant, the full account's shell streams the island (URL captured)",
    async () => {
      await setPlan("full");
      const result = await request(FINDER_PAGE, { body: true });
      islandUrl = islandUrlFromShell(result.body);
      if (!islandUrl) throw new Error("the full account's shell has no preload link to the finder island");
      return result;
    },
    {
      status: 200,
      needsPlanGrant: true,
      bodyIncludes: [FINDER_ISLAND_PATH],
      bodyExcludes: ['data-finder-state="locked"'],
    },
  ],
  [
    "finder 3: the full account's island builds the chart",
    () => replayIsland(),
    {
      status: 200,
      needsPlanGrant: true,
      // In the no-darkness window nothing is ranked, so M13 is "not ranked" instead of a chart.
      ...(inNoDarknessWindow()
        ? { skippedNote: "no astronomical darkness", bodyIncludes: ['data-finder-state="not-ranked"'] }
        : { bodyIncludes: ["data-finder-chart"] }),
    },
  ],
  [
    "finder 4: after a demotion the island answers locked and builds no chart",
    async () => {
      await setPlan("free");
      return replayIsland();
    },
    {
      status: 200,
      needsPlanGrant: true,
      bodyIncludes: ['data-finder-state="locked"'],
      bodyExcludes: ["data-finder-chart"],
    },
  ],
  [
    // A well-formed id that matches no row: the route answers with the store's fixed "not found" key.
    "answering an unknown sky check returns with a fixed error",
    () =>
      request("/api/log/sky/00000000-0000-4000-8000-000000000000", {
        method: "POST",
        form: { action: "clear", from: "sky" },
      }),
    { status: 302, location: "/log/sky?error=errors.notFound.skyCheck", exact: true },
  ],
  ["dashboard redirects to tonight", () => request("/dashboard"), { status: 302, location: "/tonight", exact: true }],
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  [
    "finder 5: signed out, the page redirects to sign-in, remembering the chart",
    () => request("/tonight/finder?object=M13"),
    { status: 302, location: "/auth/signin?next=%2Ftonight%2Ffinder%3Fobject%3DM13", exact: true },
  ],
  [
    // The island route is not gated, so a leaked URL is the case: it must still refuse to build the chart.
    "finder 6: signed out, a leaked island URL answers locked and builds no chart",
    () => replayIsland(),
    {
      status: 200,
      needsPlanGrant: true,
      bodyIncludes: ['data-finder-state="locked"'],
      bodyExcludes: ["data-finder-chart"],
    },
  ],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  ["gear redirects after signout", () => request("/gear"), { status: 302, location: "/auth/signin" }],
  ["tonight redirects after signout", () => request("/tonight"), { status: 302, location: "/auth/signin" }],
];

let failed = 0;
let skippedPlanSteps = false;
for (const [name, run, expected] of steps) {
  if (expected.needsPlanGrant && !hasPlanKey) {
    // No way to grant or remove the plan: fail under CI, say so and carry on locally (finder-chart D-9).
    if (process.env.CI) {
      failed++;
      console.log(
        `FAIL  ${name}  -> needs SUPABASE_URL and SUPABASE_SECRET_KEY of the local stack, inline on the command`,
      );
    } else if (!skippedPlanSteps) {
      skippedPlanSteps = true;
      console.log("SKIPPED (no SUPABASE_SECRET_KEY): finder plan steps");
    }
    continue;
  }
  let actual;
  try {
    actual = await run();
  } catch (error) {
    failed++;
    console.log(`FAIL  ${name}  -> ${error instanceof Error ? error.message : String(error)}`);
    continue;
  }
  const maxAges = expected.sessionMaxAge === undefined ? [] : authCookieMaxAges(actual.setCookies);
  const missingIncludes = (expected.bodyIncludes ?? []).filter((text) => !actual.body.includes(text));
  const presentExcludes = (expected.bodyExcludes ?? []).filter((text) => actual.body.includes(text));
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined ||
      (expected.exact ? actual.location === expected.location : actual.location.startsWith(expected.location))) &&
    // A submitted value (here a coordinate) must never come back in the redirect.
    (expected.absent === undefined || !actual.location.includes(expected.absent)) &&
    (expected.sessionMaxAge === undefined ||
      (maxAges.length > 0 && maxAges.every((maxAge) => maxAge === expected.sessionMaxAge))) &&
    missingIncludes.length === 0 &&
    presentExcludes.length === 0;
  const cookieNote = expected.sessionMaxAge === undefined ? "" : `  auth cookie max-age ${maxAges.join(",") || "none"}`;
  const label = ok && expected.skippedNote ? `SKIPPED (${expected.skippedNote})` : ok ? "PASS" : "FAIL";
  console.log(`${label}  ${name}  -> ${actual.status} ${actual.location}${cookieNote}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? ""}`);
    if (expected.absent !== undefined) console.log(`      and no "${expected.absent}" in the location`);
    for (const text of missingIncludes) console.log(`      and the body to include ${text}`);
    for (const text of presentExcludes) console.log(`      and the body not to include ${text}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
