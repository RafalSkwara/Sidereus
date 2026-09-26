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
const jar = new Map();

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
  return { status: response.status, location: response.headers.get("location") ?? "" };
}

const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  ["tonight redirects anonymous user", () => request("/tonight"), { status: 302, location: "/auth/signin" }],
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
    "signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/tonight", exact: true },
  ],
  ["gear renders", () => request("/gear"), { status: 200 }],
  [
    "create site redirects to gear",
    () => request("/api/gear/sites", { method: "POST", form: site }),
    { status: 302, location: "/gear", exact: true },
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
    { status: 302, location: "/gear", exact: true },
  ],
  [
    "create eyepiece redirects to gear",
    () =>
      request("/api/gear/eyepieces", {
        method: "POST",
        form: { name: "Smoke Plossl", focalLengthMm: "25", afovPreset: "plossl" },
      }),
    { status: 302, location: "/gear", exact: true },
  ],
  // Renders even when the forecast is unreachable: the verdict falls back to "marginal — no weather data".
  ["tonight renders for signed-in user", () => request("/tonight"), { status: 200 }],
  ["dashboard redirects to tonight", () => request("/dashboard"), { status: 302, location: "/tonight", exact: true }],
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  ["gear redirects after signout", () => request("/gear"), { status: 302, location: "/auth/signin" }],
  ["tonight redirects after signout", () => request("/tonight"), { status: 302, location: "/auth/signin" }],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined ||
      (expected.exact ? actual.location === expected.location : actual.location.startsWith(expected.location)));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? ""}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
