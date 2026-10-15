// Captures the ui-fact-rhythm evidence matrix: routes × locale (en, pl) × theme (dark, light, red) × viewport (320 px narrow and 390 px
// phone at 2x, 1280 px desktop). Usage:
//   BASE_URL=http://localhost:4331 node capture.mjs <worktree> <outDir> [route-filter-regex] [themes] [locales] [viewports]
// Needs `state-ui-fact.json` (a seeded user with the full plan) and `state-ui-fact-empty.json` (a user without
// eyepieces) in <outDir>/.. (seed.mjs writes them). `/design` is dev only: capture it with MODE=design against
// `npm run dev` (BASE_URL then points at the dev server); the design route takes one full page per theme and viewport.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const [worktree, outDir, filter, themesArg, localesArg, viewportsArg] = process.argv.slice(2);
const { chromium } = await import(join(worktree, "node_modules/playwright/index.mjs"));
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PREVIEW_PORT ?? 4331}`;

// Local stack only (ui-quiet-actions impl review F3): this script signs up real accounts through the server at BASE_URL,
// so it refuses anything but localhost, and the preview must run on local Supabase (never the hosted project).
function assertLocal(name, value) {
  const host = new URL(value).hostname;
  if (host !== "localhost" && host !== "127.0.0.1")
    throw new Error(`${name} must point at the local stack, got ${host}`);
}
assertLocal("BASE_URL", BASE);
const stateDir = dirname(outDir);

const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  narrow: { viewport: { width: 320, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
};
const THEMES = (themesArg || "dark,light,red").split(",");
const LOCALES = (localesArg || "en,pl").split(",");
const VIEWS = (viewportsArg || "phone,desktop").split(",");

// [name, path, state]: "main" is the seeded user, "empty" the user without eyepieces, null signed out.
let ROUTES =
  process.env.MODE === "design"
    ? [["design", "/design", "main"]]
    : [
        ["tonight", "/tonight", "main"],
        ["targets", "/tonight/targets", "main"],
        ["plan", "/tonight/plan", "main"],
        ["moon", "/tonight/moon", "main"],
        ["planets", "/tonight/planets", "main"],
        ["nights", "/tonight/nights", "main"],
        ["events", "/tonight/events", "main"],
        ["finder", "FINDER", "main"],
        ["log", "/log", "main"],
        ["logsky", "/log/sky", "main"],
        ["progress", "/log/progress", "main"],
        ["gear", "/gear", "main"],
        ["gear-empty", "/gear", "empty"],
        ["confirm", "/auth/confirm-email", null],
      ];
if (filter) ROUTES = ROUTES.filter(([name]) => new RegExp(filter).test(name));

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
let finderPath = null;
const states = { main: join(stateDir, "state-ui-fact.json"), empty: join(stateDir, "state-ui-fact-empty.json") };

for (const view of VIEWS) {
  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      for (const [name, route, state] of ROUTES) {
        const context = await browser.newContext({
          ...VIEWPORTS[view],
          ...(state ? { storageState: states[state] } : {}),
          serviceWorkers: "block",
        });
        await context.addCookies([
          { name: "sidereus-theme", value: theme, url: BASE },
          { name: "sidereus-lang", value: locale, url: BASE },
        ]);
        const page = await context.newPage();
        let path = route;
        if (route === "FINDER") {
          if (!finderPath) {
            await page.goto(BASE + "/tonight/targets", { waitUntil: "networkidle" });
            finderPath = await page.locator('a[href*="/tonight/finder?object="]').first().getAttribute("href");
          }
          path = finderPath;
        }
        await page.goto(BASE + path, { waitUntil: "networkidle" });
        await page.waitForTimeout(600);
        // The fixed TabBar would cover content mid-page in a full-page shot.
        await page.addStyleTag({ content: "[data-tabbar] { display: none !important; }" });
        await page.screenshot({ path: join(outDir, `${name}-${view}-${locale}-${theme}.png`), fullPage: true });
        if (name === "tonight" || name === "targets") {
          await page.screenshot({ path: join(outDir, `${name}-${view}-${locale}-${theme}-fold.png`) });
        }
        console.log(name, view, locale, theme);
        await context.close();
      }
    }
  }
}
await browser.close();
