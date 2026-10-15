// Measures nav label widths with the repo's Archivo files in Chromium (ui-tonight-nav research, C2, C3, C5).
// Run from the repo root: node context/changes/ui-tonight-nav/evidence/measure-nav-labels.mjs
import { chromium } from "playwright";
const F = `${process.cwd()}/node_modules/@fontsource-variable/archivo/files`;
const css = `@font-face{font-family:A;src:url(file://${F}/archivo-latin-wdth-normal.woff2) format("woff2");unicode-range:U+0000-00FF;font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:A;src:url(file://${F}/archivo-latin-ext-wdth-normal.woff2) format("woff2");unicode-range:U+0100-02AF;font-weight:100 900;font-stretch:62% 125%}
body{font-family:A} span{white-space:nowrap}`;
const words = {
  en: ["Tonight", "Log", "Progress", "My gear", "Targets", "Plan", "Session plan", "Moon", "The Moon", "Planets", "Nights", "Events", "Sky events"],
  pl: ["Dziś w nocy", "Dziennik", "Postępy", "Mój sprzęt", "Cele", "Plan", "Plan sesji", "Księżyc", "Planety", "Noce", "Zjawiska", "Zjawiska na niebie"],
};
const sizes = [["text-sm", 14], ["text-label", 15], ["text-caption", 12]];
let html = `<style>${css}</style>`;
for (const [k, px] of sizes) for (const l of ["en", "pl"]) for (const t of words[l]) html += `<span data-k="${k}|${l}|${t}" style="font-size:${px}px;font-weight:600">${t}</span><br>`;
html += `<span data-k="logo" style="font-size:22px;font-weight:600;font-variation-settings:'wdth' 125">Sidereus</span>`;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
const rows = await page.$$eval("span", (els) => els.map((e) => `${e.dataset.k} ${e.getBoundingClientRect().width.toFixed(1)}`));
console.log(rows.join("\n"));
await browser.close();
