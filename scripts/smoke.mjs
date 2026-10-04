// Smoke test: proves the built app, the Cloudflare adapter, the Supabase auth flow, onboarding, the gear routes and /tonight still work
// together. Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs
// It signs up a throwaway user and writes gear rows, so point it at local Supabase only (as CI does), never hosted.

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

async function request(path, { method = "GET", form } = {}) {
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
  };
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
    { status: 302, location: "/onboarding?error=" },
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
    { status: 302, location: "/gear/sites/new?error=" },
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
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  ["gear redirects after signout", () => request("/gear"), { status: 302, location: "/auth/signin" }],
  ["tonight redirects after signout", () => request("/tonight"), { status: 302, location: "/auth/signin" }],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const maxAges = expected.sessionMaxAge === undefined ? [] : authCookieMaxAges(actual.setCookies);
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined ||
      (expected.exact ? actual.location === expected.location : actual.location.startsWith(expected.location))) &&
    (expected.sessionMaxAge === undefined ||
      (maxAges.length > 0 && maxAges.every((maxAge) => maxAge === expected.sessionMaxAge)));
  const cookieNote = expected.sessionMaxAge === undefined ? "" : `  auth cookie max-age ${maxAges.join(",") || "none"}`;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}${cookieNote}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? ""}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
