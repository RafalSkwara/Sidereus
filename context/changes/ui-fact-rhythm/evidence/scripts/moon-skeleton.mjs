// Moon skeleton vs the real Moon page (ui-fact-rhythm, PR #167): the band's top and height and the page height, with
// the island aborted (skeleton) and loaded (real), at 390x844 and 1280x900; local preview on 4331 only.
// Usage: node moon-skeleton.mjs <worktree> <state-ui-fact.json> <outDir>
const [worktree, stateFile, outDir] = process.argv.slice(2);
const { chromium } = await import(worktree + "/node_modules/playwright/index.mjs");
const BASE = "http://localhost:4331";
const b = await chromium.launch();
for (const [w, h, dpr] of [
  [390, 844, 2],
  [1280, 900, 1],
]) {
  for (const mode of ["skeleton", "real"]) {
    const c = await b.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: dpr,
      storageState: stateFile,
      serviceWorkers: "block",
    });
    const p = await c.newPage();
    if (mode === "skeleton") await p.route("**/_server-islands/**", (r) => r.abort());
    await p.goto(BASE + "/tonight/moon", { waitUntil: "networkidle" });
    if (mode === "real") await p.locator("section#moon").waitFor();
    else await p.locator('[data-skeleton-layout="moon"]').waitFor();
    await p.waitForTimeout(500);
    const m = await p.evaluate((mode) => {
      const el = document.querySelector(mode === "real" ? "section#moon" : '[data-skeleton-layout="moon"]');
      const r = el.getBoundingClientRect();
      return {
        page: document.documentElement.scrollHeight,
        top: Math.round(r.top + scrollY),
        height: Math.round(r.height),
      };
    }, mode);
    console.log(`moon ${w} ${mode} page=${m.page} bandTop=${m.top} bandHeight=${m.height}`);
    await p.addStyleTag({ content: "[data-tabbar]{display:none!important}" });
    await p.screenshot({ path: `${outDir}/moon-${mode}-${w}.png`, fullPage: true });
    await c.close();
  }
}
await b.close();
