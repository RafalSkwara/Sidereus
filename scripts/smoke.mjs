// Smoke test: proves the built app, the Cloudflare adapter, the Supabase auth flow, onboarding, the gear routes and /tonight still work
// together. Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs
// It signs up a throwaway user and writes gear rows, so point it at local Supabase only (as CI does), never hosted.
// The finder-chart steps (finder-chart D-9, test-plan 6.4) also grant and remove the full plan through the operator command
// (`node scripts/account-plan.mjs <email> full|free`, a child process) with the SUPABASE_URL and SUPABASE_SECRET_KEY of
// the local stack, passed inline on the command: `SUPABASE_URL=<api url> SUPABASE_SECRET_KEY=<secret key> npm run smoke`.
// Never export the key (the preview must not inherit it). Without it those steps fail under CI and are skipped locally.
// The Session plan steps (adjustable-session-plan Phase 3, test-plan 6.4's first full-plan POST route) walk the same plan
// grant over POST /api/tonight/plan and its island; they need the migration `session_plans` applied to the local stack.

import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { DEFAULT_SCENARIO, SCENARIOS } from "../tests/e2e/clock-scenarios.mjs";

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
 * The smoke's clock (test-suite-diet Phase 6): the same pinned moments as the e2e suite (`tests/e2e/clock-scenarios.mjs`),
 * sent as the loopback-only cookie `sidereus-test-now` that the server's clock seam reads (src/lib/clock.ts). The default
 * is `evening`, a dark, clear night at the smoke site, so the ranked steps always have a ranking. `SMOKE_CLOCK=noDarkness`
 * (21 June at this 52 N site, Bortle 6: no astronomical darkness, the ranking is empty and M13 is "not ranked") walks the
 * other branch; `civilDawn` and `deepNight` walk the hours around the night's edge; `real` sends no cookie.
 */
const SMOKE_CLOCK = process.env.SMOKE_CLOCK ?? DEFAULT_SCENARIO;
if (SMOKE_CLOCK !== "real" && !(SMOKE_CLOCK in SCENARIOS)) {
  throw new Error(`SMOKE_CLOCK=${SMOKE_CLOCK} is not a scenario: ${Object.keys(SCENARIOS).join(", ")} or real`);
}
if (SMOKE_CLOCK !== "real") jar.set("sidereus-test-now", SCENARIOS[SMOKE_CLOCK]);
// Only the explicit `real` mode reads the real month (about 8 June to 2 July at this site); every pinned run knows its branch.
const realMonthHasNoDarkness = () => {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  return (month === 6 && day >= 8) || (month === 7 && day <= 2);
};
const NO_DARKNESS_RUN = SMOKE_CLOCK === "noDarkness" || (SMOKE_CLOCK === "real" && realMonthHasNoDarkness());
// The finder chart's server island (finder-chart Phase 6). The shell's preload link carries its signed URL; the island
// route is not behind the middleware, so replaying that URL is the HTTP proof that the island itself checks the plan.
const FINDER_ISLAND_PATH = "/_server-islands/FinderContent";
const FINDER_PAGE = "/tonight/finder?object=M13&from=targets";
let islandUrl = "";
// The Targets page's island (what-to-expect Phase 2): the same capture, from the `/tonight/targets` shell, so the
// expectation line's gate is proven on the island itself and not only on the page that streams it.
const TARGETS_ISLAND_PATH = "/_server-islands/TargetsPageContent";
const TARGETS_PAGE = "/tonight/targets";
let targetsIslandUrl = "";

/**
 * An island's URL from the shell's `<link rel="preload" as="fetch" href="/_server-islands/<Name>?e=…">` (`path` is
 * the island's route, e.g. FINDER_ISLAND_PATH), or "" when there is none. The HTML escapes `&` as `&amp;` inside the
 * attribute, so it is decoded here, as the service worker's `islandUrlFromShell` (src/lib/offline/copies.ts) does; a
 * POST island has no such link, so the capture is empty and every step that needs it fails.
 */
function islandUrlFromShell(html, path) {
  for (const [, list] of html.matchAll(/<link\b([^>]*)>/gi)) {
    const attributes = new Map();
    for (const [, key, value] of list.matchAll(/([^\s"'>/=]+)\s*=\s*"([^"]*)"/g)) {
      attributes.set(key.toLowerCase(), value.replaceAll("&amp;", "&"));
    }
    const href = attributes.get("href") ?? "";
    if (attributes.get("rel") === "preload" && attributes.get("as") === "fetch" && href.startsWith(path)) {
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

/** A step that replays the Targets island's captured URL; fails loudly (never skips) when the capture is empty. */
function replayTargetsIsland() {
  if (!targetsIslandUrl) {
    return Promise.reject(new Error("no Targets island URL was captured from the shell (expect step 1 failed)"));
  }
  return request(targetsIslandUrl, { body: true });
}

// The Session plan's server island and shell (adjustable-session-plan Phase 3, test-plan 6.4). Its own capture variables:
// never the finder's `islandUrl`. The site id and the night come from the island's own `OfflineCopy` data attributes
// (`data-site-id`, `data-night-date`), read from the first replay, so the POST names the night the server computes.
const PLAN_ISLAND_PATH = "/_server-islands/PlanPageContent";
const PLAN_PAGE = "/tonight/plan";
const SAVE_PLAN = "/api/tonight/plan";
const RESET_PLAN = "/api/tonight/plan/reset";
let planIslandUrl = "";
let planSiteId = "";
let planNight = "";
const planLocation = (query) => `/tonight/plan?site=${planSiteId}&${query}`;
const EDITED = "data-session-plan-edited";
const HELD = "data-session-plan-held";
const LOCKED = "data-session-plan-locked";

/** The value of a `data-<name>="…"` attribute in `html`, or "" when there is none. */
function dataAttribute(html, name) {
  return new RegExp(`\\bdata-${name}="([^"]*)"`).exec(html)?.[1] ?? "";
}

/** A step that replays the Session plan island's captured URL; fails loudly (never skips) when the capture is empty. */
function replayPlanIsland() {
  if (!planIslandUrl) {
    return Promise.reject(new Error("no Session plan island URL was captured from the shell (plan step 1 failed)"));
  }
  return request(planIslandUrl, { body: true });
}

/** A POST to a Session plan route, as the editor's form will send it: `targets` repeated, as an array of pairs. */
function postPlan(path, targets = [], site = planSiteId) {
  if (!planSiteId || !planNight) {
    return Promise.reject(new Error("no site id or night was read from the Session plan island (plan step 1 failed)"));
  }
  return request(path, {
    method: "POST",
    form: [["site", site], ["night", planNight], ...targets.map((key) => ["targets", key])],
  });
}

// The route's refusals (plan 8 to plan 10), each a fixed `?error=` key that the route's order of checks decides:
// shape (`savePlanSchema`: every issue is `errors.save.sessionPlan`), then the catalogue (`isKnownTarget`, the same key),
// then the user's own site (`errors.notFound.site`), tonight's date, and last the window of each newly added key
// (`errors.sessionPlan.notVisible`). Only the fixed key and a well-formed site id reach the location, never a submitted key.
const NEVER_RISES = "M7";
const FOREIGN_SITE = "00000000-0000-4000-8000-000000000000";

/**
 * What the island says its night did with a saved list: `data-session-plan-state` is "edited" on a night that passes
 * and "held" on one that does not (a no-go or no darkness), so the date never decides it.
 */
function savedListMarker(body) {
  return dataAttribute(body, "session-plan-state") === "held" ? HELD : EDITED;
}

const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  [
    // test-suite-diet D4 (7): what landing.spec's CTA test pinned in the browser, over HTTP.
    "home carries both call-to-action links when signed out",
    () => request("/", { body: true }),
    { status: 200, bodyIncludes: ['href="/auth/signup"', 'href="/auth/signin"'] },
  ],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  [
    "log redirects anonymous user, remembering the page",
    () => request("/log"),
    { status: 302, location: "/auth/signin?next=%2Flog", exact: true },
  ],
  [
    // test-suite-diet: converted from `sign-in-continue.spec.ts`, the one thing the redirect steps do not pin: the sign-in
    // page puts the page to continue to into its form (the hidden `next` that `POST /api/auth/signin` reads).
    "the sign-in page carries the page to continue to in its form",
    () => request("/auth/signin?next=%2Flog", { body: true }),
    { status: 200, bodyIncludes: ['name="next" value="/log"'] },
  ],
  [
    // auth-loose-ends D2, the risk: `next` lost on the click from sign-in to sign-up. Signed-out renders, so they sit
    // before the walk signs up (a signed-in visitor gets the D1 redirect from both pages).
    "the sign-in page's sign-up link carries the page to continue to",
    () => request("/auth/signin?next=%2Flog", { body: true }),
    { status: 200, bodyIncludes: ['href="/auth/signup?next=%2Flog"'] },
  ],
  [
    "the sign-up page carries the page to continue to in its form",
    () => request("/auth/signup?next=%2Flog", { body: true }),
    { status: 200, bodyIncludes: ['name="next" value="/log"'] },
  ],
  [
    "tonight redirects anonymous user, remembering the page",
    () => request("/tonight"),
    { status: 302, location: "/auth/signin?next=%2Ftonight", exact: true },
  ],
  [
    // auth-loose-ends D2: the walk's own sign-up carries `next`, so a new user still goes through first-run setup, with
    // the page they asked for kept for its end. Without `next` the e2e `signUp` helper expects bare `/onboarding`.
    "signup creates account, keeping the page to continue to through onboarding",
    () => request("/api/auth/signup", { method: "POST", form: { email, password, next: "/gear" } }),
    { status: 302, location: "/onboarding?next=%2Fgear", exact: true },
  ],
  ["onboarding renders", () => request("/onboarding"), { status: 200 }],
  [
    "onboarding with a page to continue to posts its form there",
    () => request("/onboarding?next=%2Fgear", { body: true }),
    { status: 200, bodyIncludes: ['action="/api/onboarding?next=%2Fgear"'] },
  ],
  [
    "invalid onboarding returns with error",
    () => request("/api/onboarding", { method: "POST", form: { ...onboarding, latitudeDeg: "95" } }),
    { status: 302, location: "/onboarding?error=errors.site.latitudeRange", exact: true, absent: "95" },
  ],
  [
    "invalid onboarding keeps the page to continue to",
    () => request("/api/onboarding?next=%2Fgear", { method: "POST", form: { ...onboarding, latitudeDeg: "95" } }),
    { status: 302, location: "/onboarding?error=errors.site.latitudeRange&next=%2Fgear", exact: true, absent: "95" },
  ],
  [
    // test-suite-diet D4 (2): a body that is not valid eyepiece JSON comes back as a fixed key, never the payload.
    "malformed onboarding eyepieces return with a fixed error and no payload",
    () =>
      request("/api/onboarding", {
        method: "POST",
        form: { ...onboarding, eyepieces: '[{"name":"Evil 52.23"' },
      }),
    { status: 302, location: "/onboarding?error=errors.onboarding.eyepiecesMalformed", exact: true, absent: "52.23" },
  ],
  ["onboarding is still unsaved after the refusals: the form renders", () => request("/onboarding"), { status: 200 }],
  [
    "onboarding saves and continues to the requested page",
    () => request("/api/onboarding?next=%2Fgear", { method: "POST", form: onboarding }),
    { status: 302, location: "/gear", exact: true },
  ],
  [
    "onboarding redirects once set up",
    () => request("/onboarding"),
    { status: 302, location: "/tonight", exact: true },
  ],
  [
    // Impl review F1: the walk's save carries `next`, so the route's default (`next ?? "/tonight"`) is pinned here, on
    // the "already has gear" branch, without a second account.
    "onboarding post without a page to continue to lands on tonight once set up",
    () => request("/api/onboarding", { method: "POST", form: onboarding }),
    { status: 302, location: "/tonight", exact: true },
  ],
  [
    "onboarding redirects once set up to the page to continue to",
    () => request("/onboarding?next=%2Fgear"),
    { status: 302, location: "/gear", exact: true },
  ],
  [
    // The account exists now (a user mistake: no log line). A failed sign-up keeps the session, so the walk stays signed in.
    "signup with the same email keeps the page to continue to",
    () => request("/api/auth/signup", { method: "POST", form: { email, password, next: "/gear" } }),
    { status: 302, location: "/auth/signup?error=errors.auth.userExists&next=%2Fgear", exact: true },
  ],
  [
    // A sign-up redirect must not leave the origin through `next` (no open redirect).
    "signup with the same email ignores an off-site next",
    () => request("/api/auth/signup", { method: "POST", form: { email, password, next: "//evil.example" } }),
    { status: 302, location: "/auth/signup?error=errors.auth.userExists", exact: true },
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
  [
    // auth-loose-ends D1: the session above is still held, so a signed-in visitor must not be left on an auth page.
    "signed-in sign-in page redirects to tonight",
    () => request("/auth/signin"),
    { status: 302, location: "/tonight", exact: true },
  ],
  [
    "signed-in sign-up page continues to the requested page",
    () => request("/auth/signup?next=%2Fgear"),
    { status: 302, location: "/gear", exact: true },
  ],
  [
    // The new reader of `next` must refuse an off-site target like the sign-in route does (no open redirect).
    "signed-in auth page ignores an off-site next",
    () => request("/auth/signin?next=%2F%2Fevil.example"),
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
    // What to expect (what-to-expect Phase 2, D-11): a free account's Targets island holds the one locked line and no
    // phrase. The marker is the valued `data-expect="`: the bare attribute is a substring of `data-expect-locked`.
    "expect 1: a free account's Targets island holds the locked line and no phrase (URL captured)",
    async () => {
      const shell = await request(TARGETS_PAGE, { body: true });
      targetsIslandUrl = islandUrlFromShell(shell.body, TARGETS_ISLAND_PATH);
      if (!targetsIslandUrl) throw new Error("the Targets shell has no preload link to its island");
      return replayTargetsIsland();
    },
    {
      status: 200,
      // In the no-darkness window nothing is ranked, so there is no count line for the locked line to sit under.
      ...(NO_DARKNESS_RUN
        ? { skippedNote: "no astronomical darkness", bodyExcludes: ['data-expect="'] }
        : { bodyIncludes: ["data-expect-locked"], bodyExcludes: ['data-expect="'] }),
    },
  ],
  [
    "finder 2: after the grant, the full account's shell streams the island (URL captured)",
    async () => {
      await setPlan("full");
      const result = await request(FINDER_PAGE, { body: true });
      islandUrl = islandUrlFromShell(result.body, FINDER_ISLAND_PATH);
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
      ...(NO_DARKNESS_RUN
        ? { skippedNote: "no astronomical darkness", bodyIncludes: ['data-finder-state="not-ranked"'] }
        : { bodyIncludes: ["data-finder-chart", 'data-expect="'] }),
    },
  ],
  [
    "expect 2: the full account's Targets island holds the expectation lines",
    () => replayTargetsIsland(),
    {
      status: 200,
      needsPlanGrant: true,
      ...(NO_DARKNESS_RUN
        ? { skippedNote: "no astronomical darkness", bodyExcludes: ["data-expect-locked"] }
        : { bodyIncludes: ['data-expect="'], bodyExcludes: ["data-expect-locked"] }),
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
    // Session plan (adjustable-session-plan Phase 3, test-plan 6.4). The account is free here (finder 4 demoted it). The
    // first replay captures the island's URL and reads the site id and the night off its offline metadata.
    "plan 1: a free account's save is refused with the plan key, and nothing is submitted back",
    async () => {
      const shell = await request(PLAN_PAGE, { body: true });
      planIslandUrl = islandUrlFromShell(shell.body, PLAN_ISLAND_PATH);
      if (!planIslandUrl) throw new Error("the Session plan shell has no preload link to its island");
      const island = await replayPlanIsland();
      planSiteId = dataAttribute(island.body, "site-id");
      planNight = dataAttribute(island.body, "night-date");
      if (!planSiteId || !planNight) throw new Error("the Session plan island has no data-site-id or data-night-date");
      return postPlan(SAVE_PLAN, ["M31"]);
    },
    {
      status: 302,
      location: () => planLocation("error=errors.accountPlan.needsFull"),
      exact: true,
      absent: "M31",
    },
  ],
  [
    "plan 2: after the grant the island shows the suggested plan, which proves plan 1 wrote nothing",
    async () => {
      await setPlan("full");
      return replayPlanIsland();
    },
    {
      status: 200,
      needsPlanGrant: true,
      bodyIncludes: ['data-session-plan-state="suggested"'],
      bodyExcludes: [EDITED, HELD, LOCKED],
    },
  ],
  [
    // An empty list is a saved plan with no targets: on a night that passes it is the edited plan, on one that does not
    // (a no-go, no darkness) it is held. The island's own state decides which, not the date.
    "plan 3: the full account saves a list and the island shows it (edited, or held on a night that does not pass)",
    async () => {
      const saved = await postPlan(SAVE_PLAN);
      const island = await replayPlanIsland();
      return { ...saved, body: island.body };
    },
    {
      status: 302,
      location: () => planLocation("saved=plan"),
      exact: true,
      needsPlanGrant: true,
      bodyIncludesFrom: (actual) => [savedListMarker(actual.body)],
    },
  ],
  [
    "plan 4: after a demotion the island shows the lock and none of the edits",
    async () => {
      await setPlan("free");
      return replayPlanIsland();
    },
    {
      status: 200,
      needsPlanGrant: true,
      bodyIncludes: [LOCKED, 'data-session-plan-state="locked"'],
      bodyExcludes: [EDITED, HELD],
    },
  ],
  [
    "plan 5: the edits return with the plan (D11), and a reset removes them",
    async () => {
      await setPlan("full");
      const back = await replayPlanIsland();
      if (!back.body.includes(savedListMarker(back.body))) {
        throw new Error("the saved list did not come back after the plan did");
      }
      const reset = await postPlan(RESET_PLAN);
      const island = await replayPlanIsland();
      return { ...reset, body: island.body };
    },
    {
      status: 302,
      location: () => planLocation("saved=plan-reset"),
      exact: true,
      needsPlanGrant: true,
      bodyExcludes: [EDITED, HELD],
    },
  ],
  [
    // The account is full here and plan 5's reset left no saved list, so every key below is a newly added one. M7 is the
    // southernmost object in the catalogue (dec -34.8 deg; NGC104 is not in it, and Caldwell stops at -23 deg): at
    // smoke's 52.23 N it culminates at 90 - 52.23 - 34.8 = 3.0 deg, under the site's minimum altitude (15 deg from
    // onboarding, 20 deg for the created site) on every night of the year, so `deepSkyWindow` is null whatever the
    // date, the moon or the darkness (a night with no dark window has none either, which is the same refusal).
    "plan 8: a newly added key that never rises at the site is refused as not visible, and nothing is saved",
    () => postPlan(SAVE_PLAN, [NEVER_RISES]),
    {
      status: 302,
      location: () => planLocation("error=errors.sessionPlan.notVisible"),
      exact: true,
      needsPlanGrant: true,
      absent: NEVER_RISES,
    },
  ],
  [
    // A well-formed id that is not the user's: the route's own-site read finds no row, so the key is `notFound.site`,
    // and the foreign id itself is the one value allowed in the location (it passes `isGearId`).
    "plan 9: a well-formed site that is not the user's is refused as not found",
    () => postPlan(SAVE_PLAN, ["M31"], FOREIGN_SITE),
    {
      status: 302,
      location: `/tonight/plan?site=${FOREIGN_SITE}&error=errors.notFound.site`,
      exact: true,
      needsPlanGrant: true,
    },
  ],
  [
    // NGC1 passes the key grammar but the catalogue lacks it; a repeated key fails the schema's refinement. Both are
    // `errors.save.sessionPlan`, and neither key comes back in the location.
    "plan 10: an unknown catalogue key and a repeated key are refused with the save key",
    async () => {
      const unknown = await postPlan(SAVE_PLAN, ["NGC1"]);
      if (unknown.location !== planLocation("error=errors.save.sessionPlan")) {
        throw new Error(`an unknown key answered ${unknown.status} ${unknown.location}`);
      }
      return postPlan(SAVE_PLAN, ["M31", "M31"]);
    },
    {
      status: 302,
      location: () => planLocation("error=errors.save.sessionPlan"),
      exact: true,
      needsPlanGrant: true,
      absent: "M31",
    },
  ],
  [
    // test-suite-diet D4 (3): a coordinate pair posted as the site is refused with the save key and never reaches the
    // location (`site=` is added only for a well-formed id); plan 11 below reads back that nothing was saved.
    "plan 12: a coordinate pair as the site is refused, and the location holds neither the pair nor a site",
    () => postPlan(SAVE_PLAN, ["M31"], "52.23,21.01"),
    {
      status: 302,
      location: "/tonight/plan?error=errors.save.sessionPlan",
      exact: true,
      needsPlanGrant: true,
      absent: "52.23",
    },
  ],
  [
    // test-suite-diet D4 (11), converted from `session-plan-edit.spec.ts` "a save for a night that is over ...": a posted
    // night that is not tonight's is refused with the fixed `nightOver` key, and the stale night never reaches the
    // location. Plan 11 below reads back that nothing was saved.
    "plan 13: a save for a night that is over is refused with the nightOver key, and the night never comes back",
    () =>
      request(SAVE_PLAN, {
        method: "POST",
        form: [
          ["site", planSiteId],
          ["night", "2020-01-01"],
          ["targets", "M31"],
        ],
      }),
    {
      status: 302,
      location: () => planLocation("error=errors.sessionPlan.nightOver"),
      exact: true,
      needsPlanGrant: true,
      absent: "2020-01-01",
    },
  ],
  [
    "plan 11: none of the refusals (plans 8 to 10, 12 and 13) wrote a list, so the island still shows the suggested plan",
    () => replayPlanIsland(),
    {
      status: 200,
      needsPlanGrant: true,
      bodyIncludes: ['data-session-plan-state="suggested"'],
      bodyExcludes: [EDITED, HELD, LOCKED],
    },
  ],
  [
    // test-suite-diet D4 (12): one gear UPDATE route over HTTP (the create routes are walked above): a changed name comes
    // back as the saved notice and is read back on /gear.
    "gear: updating a site redirects to gear with the saved notice",
    () => request(`/api/gear/sites/${planSiteId}`, { method: "POST", form: { ...site, name: "Smoke site renamed" } }),
    { status: 302, location: "/gear?saved=site", exact: true, needsPlanGrant: true },
  ],
  [
    "gear: the renamed site is on the gear page",
    () => request("/gear", { body: true }),
    { status: 200, bodyIncludes: ["Smoke site renamed"], needsPlanGrant: true },
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
  [
    // test-suite-diet D4 (4): the `from` of a sky-check answer is an enum; anything else, an off-site URL included, falls
    // back to the sky checks page, so the redirect stays on this origin.
    "answering a sky check with an off-site from stays on this origin",
    () =>
      request("/api/log/sky/00000000-0000-4000-8000-000000000000", {
        method: "POST",
        form: { action: "clear", from: "https://evil.example" },
      }),
    { status: 302, location: "/log/sky?error=errors.notFound.skyCheck", exact: true, absent: "evil" },
  ],
  [
    // test-suite-diet D4 (1): a coordinate pair as the log target returns a fixed key, never the value.
    "log: a coordinate pair as the target is refused with a fixed key and no value",
    () =>
      request("/api/log", {
        method: "POST",
        form: { target: "52.23,21.01", rating: "3", night: "2019-03-07" },
      }),
    {
      status: 302,
      location: "/log/new?night=2019-03-07&error=errors.observation.objectInvalid",
      exact: true,
      absent: "52.23",
    },
  ],
  [
    "log: the refused entry wrote nothing, the log page holds neither the value nor the night",
    () => request("/log", { body: true }),
    { status: 200, bodyExcludes: ["52.23", "2019-03-07"] },
  ],
  [
    "log: an entry id that matches no row is a 404",
    () => request("/log/00000000-0000-4000-8000-000000000000"),
    { status: 404 },
  ],
  ["home sends a signed-in user to tonight", () => request("/"), { status: 302, location: "/tonight", exact: true }],
  [
    // The fragment of /tonight/all#more never reaches the server; the legacy page redirects whole.
    "the legacy all-objects page redirects to the targets list",
    () => request("/tonight/all"),
    { status: 301, location: "/tonight/targets", exact: true },
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
  [
    // What to expect (what-to-expect Phase 4, D-11): the Targets island route is not gated either. Signed out, a leaked
    // URL's island loads no Tonight (the user is null), so it renders neither the lines nor the locked line, and no
    // offline copy either: no Tonight load happened at all, not just a missing marker. The URL was captured in
    // `expect 1`, before any grant, so this step needs none.
    "expect 3: signed out, a leaked Targets island URL loads no Tonight and renders no line",
    () => replayTargetsIsland(),
    {
      status: 200,
      bodyExcludes: ['data-expect="', "data-expect-locked", "data-offline-copy"],
    },
  ],
  [
    "plan 6: signed out, a save goes to sign-in",
    () =>
      request(SAVE_PLAN, {
        method: "POST",
        form: [
          ["site", planSiteId],
          ["night", planNight],
          ["targets", "M31"],
        ],
      }),
    { status: 302, location: "/auth/signin", exact: true },
  ],
  [
    // The island route is not gated, so a leaked URL is the case: with no session it loads and reads nothing.
    "plan 7: signed out, a leaked Session plan island URL renders no plan",
    () => replayPlanIsland(),
    {
      status: 200,
      bodyExcludes: ["data-session-plan-state", EDITED, HELD, LOCKED, "data-offline-copy"],
    },
  ],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  ["gear redirects after signout", () => request("/gear"), { status: 302, location: "/auth/signin" }],
  ["tonight redirects after signout", () => request("/tonight"), { status: 302, location: "/auth/signin" }],
  [
    // test-suite-diet D4 (6): a signed-out log POST goes to sign-in and writes nothing, read back as the user below.
    "log: a signed-out POST goes to sign-in",
    () =>
      request("/api/log", {
        method: "POST",
        form: { target: "M31", rating: "3", night: "2019-03-08" },
      }),
    { status: 302, location: "/auth/signin", exact: true },
  ],
  [
    "signin again to read back what the signed-out POST did",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/tonight", exact: true },
  ],
  [
    "log: the signed-out POST wrote nothing for the user",
    () => request("/log", { body: true }),
    { status: 200, bodyExcludes: ["2019-03-08"] },
  ],
  ["signout again", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
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
  const expectedLocation = typeof expected.location === "function" ? expected.location() : expected.location;
  const includes = [...(expected.bodyIncludes ?? []), ...(expected.bodyIncludesFrom?.(actual) ?? [])];
  const missingIncludes = includes.filter((text) => !actual.body.includes(text));
  const presentExcludes = (expected.bodyExcludes ?? []).filter((text) => actual.body.includes(text));
  const ok =
    actual.status === expected.status &&
    (expectedLocation === undefined ||
      (expected.exact ? actual.location === expectedLocation : actual.location.startsWith(expectedLocation))) &&
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
    console.log(`      expected ${expected.status} ${expectedLocation ?? ""}`);
    if (expected.absent !== undefined) console.log(`      and no "${expected.absent}" in the location`);
    for (const text of missingIncludes) console.log(`      and the body to include ${text}`);
    for (const text of presentExcludes) console.log(`      and the body not to include ${text}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
