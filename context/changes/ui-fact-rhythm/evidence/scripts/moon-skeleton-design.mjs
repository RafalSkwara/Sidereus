// The Moon skeleton's `moon` layout against MoonCard with and without a target on /design (ui-fact-rhythm, PR #167),
// at 390 and 1280 px; astro dev on 4331 only. Usage: node moon-skeleton-design.mjs <worktree> <outDir>
const [worktree, outDir] = process.argv.slice(2);
const { chromium } = await import(worktree + "/node_modules/playwright/index.mjs");
const b = await chromium.launch();
for (const [w, dpr] of [
  [390, 2],
  [1280, 1],
]) {
  for (const theme of ["dark", "light"]) {
    const c = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: dpr });
    await c.addCookies([{ name: "sidereus-theme", value: theme, url: "http://localhost:4331" }]);
    const p = await c.newPage();
    await p.goto("http://localhost:4331/design", { waitUntil: "networkidle" });
    await p.addStyleTag({ content: "astro-dev-toolbar,[data-tabbar]{display:none!important}" });
    const sel = {
      skeleton: '[data-moon-measure="skeleton"] [data-skeleton-layout="moon"]',
      target: '[data-moon-measure="card-target"] section#moon',
      none: '[data-moon-measure="card-no-target"] section#moon',
    };
    const out = [];
    for (const [k, s] of Object.entries(sel)) {
      const el = p.locator(s).first();
      const bb = await el.boundingBox();
      out.push(`${k}=${Math.round(bb.height)}`);
      if (theme === "dark" || k !== "none")
        await el.screenshot({ path: `${outDir}/design-moon-${k}-${theme}-${w}.png` });
    }
    if (theme === "dark") console.log(`design ${w}: ${out.join(" ")}`);
    await c.close();
  }
}
await b.close();
