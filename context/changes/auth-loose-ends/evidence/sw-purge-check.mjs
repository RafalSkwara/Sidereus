// Plan row 3.5 (auth-loose-ends): the service worker still purges every stored Tonight copy on `POST /api/auth/signin`
// and `POST /api/auth/signup`, now that those routes redirect with `next`.
//
// Run from the worktree root against a production preview backed by LOCAL Supabase (it signs up real users) with the
// forecast fixture running, real clock (the worker compares a copy's `preparedAt` with its own real clock):
//   BASE_URL=http://localhost:4339 node context/changes/auth-loose-ends/evidence/sw-purge-check.mjs
//
// Why the POSTs are fired from the open page and not from the sign-up page: any page the server renders for nobody
// (`<html data-signed-out>`) asks the worker to purge by itself (`src/lib/offline/page-state.ts`), so opening
// `/auth/signup` after deleting the cookie would purge before the POST and the check could not tell which one did it.
// Here no page is rendered between "stored copies are there" and the POST: the page that holds the worker's control stays
// open, its auth cookie is deleted (copies stay), and a same-origin `fetch` posts the form exactly as the form would.

import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4339";
const PASSWORD = "Purge-Check-Passw0rd!";
const TONIGHT_CACHE = "sidereus-tonight-v1";
const INDEX_KEY = "/__offline/index.json";
const emailA = `purge-check-a-${randomUUID()}@example.com`;
const emailB = `purge-check-b-${randomUUID()}@example.com`;
const onboarding = {
  latitudeDeg: "40.42",
  longitudeDeg: "-3.7",
  bortle: "6",
  telescopeName: "150 mm reflector",
  apertureMm: "150",
  focalLengthMm: "750",
  eyepieces: JSON.stringify([{ name: "25 mm Plössl", focalLengthMm: "25", afovPreset: "plossl" }]),
};

const log = (line, data) => console.log(data === undefined ? line : `${line} ${JSON.stringify(data)}`);
function check(ok, what, data) {
  log(`${ok ? "PASS" : "FAIL"}  ${what}`, data);
  if (!ok) process.exitCode = 1;
}

const storedCopies = (page) =>
  page.evaluate(
    async ({ cacheName, indexKey }) => {
      const index = await (await caches.open(cacheName)).match(indexKey);
      if (!index) return [];
      const { copies } = await index.json();
      return copies.map((copy) => `${copy.page} ${copy.kind}`).sort();
    },
    { cacheName: TONIGHT_CACHE, indexKey: INDEX_KEY },
  );

async function until(page, predicate, what, timeout = 30_000) {
  const stop = Date.now() + timeout;
  let last = [];
  while (Date.now() < stop) {
    last = await storedCopies(page);
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${what}: gave up after ${timeout} ms, last stored copies ${JSON.stringify(last)}`);
}

/** Opens Tonight online under the controlling worker until its copy is stored. */
async function storeTonight(page) {
  await page.goto("/tonight");
  await page.locator("#verdict-heading [data-sky-headline]").waitFor();
  return until(page, (copies) => copies.includes("/tonight tonight"), "Tonight's copy is stored");
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ baseURL: BASE_URL, timezoneId: "Europe/Madrid" });
  await context.addCookies([{ name: "sidereus-lang", value: "en", url: BASE_URL }]);
  const page = await context.newPage();
  const form = (fields) => ({ form: fields, maxRedirects: 0, headers: { Origin: BASE_URL } });

  // User A signs up and sets up (API, so the worker is not involved yet), then the worker controls the page.
  const signUpA = await context.request.post(
    "/api/auth/signup",
    form({ email: emailA, password: PASSWORD, confirmPassword: PASSWORD }),
  );
  check(signUpA.status() === 302 && signUpA.headers().location === "/onboarding", "user A signs up", {
    status: signUpA.status(),
  });
  const setUp = await context.request.post("/api/onboarding", form(onboarding));
  check(setUp.status() === 302 && setUp.headers().location === "/tonight", "user A finishes onboarding", {
    status: setUp.status(),
  });

  await page.goto("/tonight");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (await page.evaluate(() => navigator.serviceWorker.controller === null)) await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  check(true, "the service worker controls the page");

  const authCookies = () =>
    context.cookies().then((all) => all.filter((cookie) => /^sb-.*-auth-token/.test(cookie.name)));
  const dropAuthCookies = async () => {
    await context.clearCookies({ name: /^sb-.*-auth-token/ });
    check((await authCookies()).length === 0, "only the auth cookies are deleted, no page rendered since");
  };

  // Round 1: sign-in with `next`.
  const before1 = await storeTonight(page);
  check(before1.length > 0, "round 1: copies are stored before the sign-in", before1);
  await dropAuthCookies();
  check(
    (await storedCopies(page)).length > 0,
    "round 1: deleting the cookie leaves the copies (no signed-out render purged them)",
  );
  const signIn = await page.evaluate(
    async ({ email, password }) => {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        body: new URLSearchParams({ email, password, next: "/gear" }),
        redirect: "manual",
      });
      return { type: response.type };
    },
    { email: emailA, password: PASSWORD },
  );
  const after1 = await until(
    page,
    (copies) => copies.length === 0,
    "round 1: the sign-in POST purges every copy",
    15_000,
  ).catch(() => storedCopies(page));
  check(after1.length === 0, "round 1: POST /api/auth/signin (with next) purged every stored copy", {
    response: signIn,
    after: after1,
  });
  check((await authCookies()).length > 0, "round 1: the sign-in started a session again");

  // Round 2: sign-up with `next`, from the same still-open page.
  const before2 = await storeTonight(page);
  check(before2.length > 0, "round 2: copies are stored before the sign-up", before2);
  await dropAuthCookies();
  check((await storedCopies(page)).length > 0, "round 2: deleting the cookie leaves the copies");
  const signUp = await page.evaluate(
    async ({ email, password }) => {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        body: new URLSearchParams({ email, password, confirmPassword: password, next: "/log" }),
        redirect: "manual",
      });
      return { type: response.type };
    },
    { email: emailB, password: PASSWORD },
  );
  const after2 = await until(
    page,
    (copies) => copies.length === 0,
    "round 2: the sign-up POST purges every copy",
    15_000,
  ).catch(() => storedCopies(page));
  check(after2.length === 0, "round 2: POST /api/auth/signup (with next) purged every stored copy", {
    response: signUp,
    after: after2,
  });
  check((await authCookies()).length > 0, "round 2: the sign-up started user B's session");
} finally {
  await browser.close();
}
log(process.exitCode ? "RESULT: FAILED" : "RESULT: purge on sign-in and sign-up still works");
