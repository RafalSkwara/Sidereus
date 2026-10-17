// The milestone badges' art (ui-progress-rewards): the source of the 11 illustrations, as SVG in theme tokens only
// (`var(--…)`). As a script it writes one SVG per badge to `scripts/badge-art/art/` (the reviewable sources) and renders
// comparison sheets through Playwright as PNGs into `scripts/badge-art/out/` (gitignored; `--out <dir>` picks another
// folder). PNGs never go into git. Run from the repo root: `npm run badge-art:render`. The product components come from
// `port.mjs` (`npm run badge-art:port`), never by hand.
// The theme values come from src/styles/global.css at run time, so the sheets show the real tokens.
//
// Round 1 was approved by the owner on 2026-10-17. Three calls were left to the implementer (the change's plan.md, "Owner
// decisions on the art and P8"), applied here as round 1b:
//   (a) red mode: the large full-red areas (the reached Moon's body, the count numerals) carry `red-step`, one value
//       step down in red only (`red:opacity-80` in the product, emulated by the sheet's CSS below);
//   (b) the ahead art's opacity per theme (`ahead-art`: light 0.3, dark 0.4, red 0.6; product classes
//       `opacity-30 dark:opacity-40 red:opacity-60`);
//   (c) weight: dots are written grouped by fill and opacity with one-decimal coordinates (no visible change), and
//       with ART_TRIM=1 (the default) fewer background and globular stars. ART_TRIM=0 renders round 1's counts.
// The module is importable: `ART` is exported and the sheets render only when it runs as a script, so the product
// port (`port.mjs`) writes the exact same art into src/components/progress/badge-art/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(join(process.cwd(), "package.json"));
const HERE = dirname(fileURLToPath(import.meta.url));
/** The SVG sources (committed). */
const ART_DIR = join(HERE, "art");
/** The rendered PNG sheets: `--out <dir>`, else `scripts/badge-art/out/` (gitignored). */
const outIndex = process.argv.indexOf("--out");
const OUT = outIndex > 0 && process.argv[outIndex + 1] ? resolve(process.argv[outIndex + 1]) : join(HERE, "out");
const v = (token) => `var(--${token})`;
const f = (n) => +n.toFixed(2);
const f1 = (n) => +n.toFixed(1);
const TRIM = process.env.ART_TRIM !== "0";
/** A dot count: round 1's when ART_TRIM=0, else the trimmed one. */
const n = (round1, trimmed) => (TRIM ? trimmed : round1);

/** Dots grouped by fill and opacity (one `<g>` per pair), so each circle carries only its geometry. */
function dots(list) {
  const groups = new Map();
  for (const d of list) {
    const key = `${d.fill}|${d.o ?? 1}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(`<circle cx="${f1(d.x)}" cy="${f1(d.y)}" r="${f(d.r)}"/>`);
  }
  return [...groups]
    .map(([key, circles]) => {
      const [fill, o] = key.split("|");
      return `<g fill="${fill}"${o === "1" ? "" : ` opacity="${o}"`}>${circles.join("")}</g>`;
    })
    .join("");
}

/** Deterministic random numbers, so the art is the same on every run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A faint field of stars inside the disc, avoiding a central keep-out radius. */
function starField(seed, count, keepOut = 0, accent = 0.25) {
  const r = rng(seed);
  const list = [];
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const d = keepOut + r() * (50 - keepOut);
    const size = 0.35 + r() * 0.7;
    const fill = r() < accent ? v("star-accent") : v("star");
    list.push({ x: 60 + d * Math.cos(a), y: 60 + d * Math.sin(a), r: size, fill });
  }
  return dots(list);
}

/** A four-point glint, for bright stars. */
function glint(x, y, s, fill = v("moon-lit"), opacity = 1) {
  const w = s * 0.22;
  return `<path d="M${x} ${y - s}Q${x + w} ${y - w} ${x + s} ${y}Q${x + w} ${y + w} ${x} ${y + s}Q${x - w} ${y + w} ${x - s} ${y}Q${x - w} ${y - w} ${x} ${y - s}Z" fill="${fill}" opacity="${opacity}"/>`;
}

/** A smooth closed blob through `n` points around (cx, cy) with radii jittered by `jitter`. */
function blob(seed, cx, cy, rx, ry, n, jitter, rot = 0) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - jitter + r() * jitter * 2;
    const x0 = Math.cos(a) * rx * k;
    const y0 = Math.sin(a) * ry * k;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    pts.push([cx + x0 * c - y0 * s, cy + x0 * s + y0 * c]);
  }
  // Catmull-Rom to cubic Bézier, closed.
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return `${d}Z`;
}

// ---------------------------------------------------------------- the art, each in the 120-unit badge space

function moon(_id) {
  const craters = [
    [70, 63, 5.2],
    [49, 80, 3.6],
    [40, 50, 3],
    [64, 33, 2.6],
    [55, 44, 2],
    [44, 66, 2.4],
    [72, 79, 2.6],
    [58, 88, 2],
  ];
  return `
    ${starField(11, n(16, 10), 37)}
    <g class="red-step">
    <circle cx="60" cy="60" r="35" fill="${v("moon-lit")}" opacity="0.12"/>
    <circle cx="60" cy="60" r="33" fill="${v("moon-lit")}"/>
    <path d="${blob(3, 50, 49, 10, 7.5, 7, 0.25, 0.3)}" fill="${v("moon-mare")}" opacity="0.6"/>
    <path d="${blob(4, 63, 45, 7, 5, 6, 0.25, -0.2)}" fill="${v("moon-mare")}" opacity="0.55"/>
    <path d="${blob(5, 46, 66, 8, 6, 7, 0.3, 0.5)}" fill="${v("moon-mare")}" opacity="0.5"/>
    <path d="${blob(6, 60, 72, 6, 4, 6, 0.3, 0)}" fill="${v("moon-mare")}" opacity="0.45"/>
    <g fill="${v("moon-dark")}" opacity="0.2">
      <path d="${blob(3, 50, 49, 10, 7.5, 7, 0.25, 0.3)}"/><path d="${blob(4, 63, 45, 7, 5, 6, 0.25, -0.2)}"/>
      <path d="${blob(5, 46, 66, 8, 6, 7, 0.3, 0.5)}"/><path d="${blob(6, 60, 72, 6, 4, 6, 0.3, 0)}"/>
    </g>
    ${craters
      .map(
        ([x, y, r]) =>
          `<circle cx="${x}" cy="${y}" r="${r}" fill="${v("moon-mare")}" opacity="0.55"/>` +
          `<path d="M${f(x - r * 0.8)} ${f(y - r * 0.55)}A${r} ${r} 0 0 1 ${f(x + r * 0.55)} ${f(y - r * 0.8)}" fill="none" stroke="${v("moon-dark")}" stroke-width="1.1" opacity="0.7"/>` +
          `<path d="M${f(x + r * 0.85)} ${f(y + r * 0.4)}A${r} ${r} 0 0 1 ${f(x - r * 0.3)} ${f(y + r * 0.9)}" fill="none" stroke="${v("moon-lit")}" stroke-width="0.9"/>`,
      )
      .join("")}
    ${[0, 0.7, 1.5, 2.3, 3.2, 4.1, 5.0]
      .map(
        (a) =>
          `<path d="M${f(49 + 4 * Math.cos(a))} ${f(80 + 4 * Math.sin(a))}L${f(49 + 13 * Math.cos(a))} ${f(80 + 13 * Math.sin(a))}" stroke="${v("moon-lit")}" stroke-width="0.7" opacity="0.8"/>`,
      )
      .join("")}
    <path d="M60 27A33 33 0 0 1 60 93A23 33 0 0 0 60 27Z" fill="${v("moon-dark")}" opacity="0.35"/>
    <path d="M60 27A33 33 0 0 1 60 93A15 33 0 0 0 60 27Z" fill="${v("moon-dark")}" opacity="0.88"/>
    <circle cx="60" cy="60" r="33" fill="none" stroke="${v("moon-limb")}" stroke-width="1"/>
    </g>`;
}

function ringedPlanet(id) {
  const ring = (rx, ry, w, color, opacity, half) =>
    `<path d="M${60 - rx} 60A${rx} ${ry} 0 0 ${half === "back" ? 1 : 0} ${60 + rx} 60" fill="none" stroke="${v(color)}" stroke-width="${w}" opacity="${opacity}"/>`;
  const rings = (half) =>
    ring(45, 12.5, 2.6, "moon-lit", 0.75, half) +
    ring(39.5, 11, 5.5, "moon-lit", 0.95, half) +
    ring(33.5, 9.3, 2.4, "moon-mare", 0.7, half) +
    ring(29.5, 8.2, 1.2, "moon-mare", 0.4, half);
  const bands = [
    [36, 6, "moon-lit", 0.95],
    [42, 3, "moon-mare", 0.9],
    [45, 4, "moon-lit", 0.85],
    [49, 2.5, "primary-strong", 0.7],
    [51.5, 5, "moon-lit", 0.9],
    [56.5, 2, "moon-mare", 0.8],
    [58.5, 6, "moon-lit", 0.95],
    [64.5, 3, "moon-mare", 0.85],
    [67.5, 4, "moon-lit", 0.8],
    [71.5, 3, "primary-strong", 0.6],
    [74.5, 10, "moon-mare", 0.85],
  ];
  return `
    ${starField(21, n(18, 12), 0)}
    <defs><clipPath id="${id}-planet"><circle cx="60" cy="60" r="21"/></clipPath></defs>
    <circle cx="101" cy="34" r="1.6" fill="${v("moon-lit")}"/>
    <circle cx="22" cy="84" r="1.1" fill="${v("moon-mare")}"/>
    <g transform="rotate(-22 60 60)">
      ${rings("back")}
      <g clip-path="url(#${id}-planet)">
        <rect x="35" y="36" width="50" height="50" fill="${v("moon-mare")}"/>
        ${bands.map(([y, h, c, o]) => `<rect x="35" y="${y}" width="50" height="${h}" fill="${v(c)}" opacity="${o}"/>`).join("")}
        <ellipse cx="60" cy="55" rx="3.2" ry="1.8" fill="${v("moon-dark")}" opacity="0.35"/>
        <path d="M39 64A39.5 11 0 0 0 81 64" fill="none" stroke="${v("moon-dark")}" stroke-width="3" opacity="0.55"/>
        <circle cx="68" cy="66" r="21" fill="${v("moon-dark")}" opacity="0.5"/>
      </g>
      <circle cx="60" cy="60" r="21" fill="none" stroke="${v("moon-limb")}" stroke-width="0.8"/>
      ${rings("front")}
    </g>`;
}

function allPlanets(id) {
  // The seven planets in order on a curved ecliptic from the Sun's glow (lower left) to Neptune (upper right),
  // each lit from the Sun's side.
  // Laid out along a gently bowed line through the disc, each planet's room from its radius (Saturn's ring included).
  const spec = [
    { r: 2.64, fill: "moon-mare", o: 1 },
    { r: 3.96, fill: "moon-lit", o: 0.95 },
    { r: 3.3, fill: "primary-strong", o: 0.95 },
    { r: 11, fill: "moon-lit", o: 1, bands: true },
    { r: 7.7, fill: "moon-lit", o: 0.92, ring: true },
    { r: 5.06, fill: "primary-strong", o: 0.8 },
    { r: 4.84, fill: "primary-strong", o: 0.6 },
  ];
  const room = (p) => p.r + (p.ring ? 4.4 : 0);
  let along = 0;
  const offsets = spec.map((p, i) => (i === 0 ? 0 : (along += room(spec[i - 1]) + room(p) + 1.3)));
  const total = offsets[offsets.length - 1];
  const planets = spec.map((p, i) => {
    const t = offsets[i] / total;
    const bow = Math.sin(Math.PI * t) * 4;
    return { ...p, x: f(22 + offsets[i] * 0.85 + bow * 0.53), y: f(79 - offsets[i] * 0.53 + bow * 0.85) };
  });
  const lightFrom = [2, 116];
  return `
    ${starField(31, n(24, 14), 0)}
    <defs>
      ${planets.map((p, i) => `<clipPath id="${id}-p${i}"><circle cx="${p.x}" cy="${p.y}" r="${p.r}"/></clipPath>`).join("")}
      <radialGradient id="${id}-sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${v("moon-lit")}"/><stop offset="0.45" stop-color="${v("moon-lit")}" stop-opacity="0.9"/><stop offset="0.6" stop-color="${v("primary-strong")}" stop-opacity="0.35"/><stop offset="1" stop-color="${v("primary-strong")}" stop-opacity="0"/></radialGradient>
    </defs>
    <circle cx="2" cy="116" r="40" fill="url(#${id}-sun)"/>
    <path d="M10 98Q62 70 110 26" fill="none" stroke="${v("primary-strong")}" stroke-width="0.8" stroke-dasharray="1.5 2.5" opacity="0.6"/>
    ${planets
      .map((p, i) => {
        const dx = p.x - lightFrom[0];
        const dy = p.y - lightFrom[1];
        const len = Math.hypot(dx, dy);
        const sx = p.x + (dx / len) * p.r * 0.8;
        const sy = p.y + (dy / len) * p.r * 0.8;
        let g = `<g clip-path="url(#${id}-p${i})"><circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${v(p.fill)}" opacity="${p.o}"/>`;
        if (p.bands) {
          g += [-6.2, -2.8, 1, 4.6, 7.4]
            .map(
              (o, k) =>
                `<rect x="${p.x - p.r}" y="${f(p.y + o)}" width="${p.r * 2}" height="${k % 2 ? 2 : 1.3}" fill="${v(k === 2 ? "primary-strong" : "moon-mare")}" opacity="0.9"/>`,
            )
            .join("");
          g += `<ellipse cx="${p.x + 3}" cy="${p.y + 3.4}" rx="2" ry="1.2" fill="${v("moon-dark")}" opacity="0.55"/>`;
        }
        g += `<circle cx="${f(sx)}" cy="${f(sy)}" r="${p.r}" fill="${v("moon-dark")}" opacity="0.62"/></g>`;
        g += `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="none" stroke="${v("moon-limb")}" stroke-width="0.5"/>`;
        if (p.ring) {
          const t = `transform="rotate(-25 ${p.x} ${p.y})"`;
          g = `<path d="M${p.x - p.r * 2} ${p.y}A${p.r * 2} ${p.r * 0.55} 0 0 1 ${p.x + p.r * 2} ${p.y}" ${t} fill="none" stroke="${v("moon-lit")}" stroke-width="1.6" opacity="0.8"/>${g}<path d="M${p.x - p.r * 2} ${p.y}A${p.r * 2} ${p.r * 0.55} 0 0 0 ${p.x + p.r * 2} ${p.y}" ${t} fill="none" stroke="${v("moon-lit")}" stroke-width="1.6"/>`;
        }
        return g;
      })
      .join("")}`;
}

function spiralPath(arm, from, to, offset = 0) {
  const pts = [];
  for (let t = from; t <= to; t += 0.16) {
    const r = 4.2 * Math.exp(0.26 * t);
    const a = t + arm * Math.PI + offset;
    pts.push(`${f1(r * Math.cos(a))} ${f1(r * Math.sin(a))}`);
  }
  return `M${pts.join("L")}`;
}

function galaxy(id, { scale = 1, cx = 60, cy = 60, field = true, seed = 41 } = {}) {
  const r = rng(seed);
  const knotList = [];
  for (const arm of [0, 1]) {
    for (let t = 1.6; t < 9.4; t += 0.55) {
      const rr = 4.2 * Math.exp(0.26 * t) + (r() - 0.5) * 3;
      const a = t + arm * Math.PI + (r() - 0.5) * 0.25;
      knotList.push({
        x: rr * Math.cos(a),
        y: rr * Math.sin(a),
        r: 0.6 + r() * 0.8,
        fill: v("moon-lit"),
        o: f1(0.6 + r() * 0.4),
      });
    }
  }
  const knots = dots(knotList);
  return `
    ${field ? starField(seed + 1, n(18, 12), 0) : ""}
    <defs>
      <radialGradient id="${id}-halo"><stop offset="0" stop-color="${v("primary-strong")}" stop-opacity="0.55"/><stop offset="1" stop-color="${v("primary-strong")}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}-core"><stop offset="0" stop-color="${v("moon-lit")}"/><stop offset="0.35" stop-color="${v("moon-lit")}" stop-opacity="0.9"/><stop offset="1" stop-color="${v("primary-strong")}" stop-opacity="0"/></radialGradient>
    </defs>
    <g transform="translate(${cx} ${cy}) rotate(-28) scale(${scale} ${f(scale * 0.6)})">
      <circle r="44" fill="url(#${id}-halo)"/>
      ${[0, 1].map((arm) => `<path d="${spiralPath(arm, 0.6, 9.6)}" fill="none" stroke="${v("primary-strong")}" stroke-width="10" stroke-linecap="round" opacity="0.22"/>`).join("")}
      ${[0, 1].map((arm) => `<path d="${spiralPath(arm, 0.6, 9.2)}" fill="none" stroke="${v("moon-lit")}" stroke-width="4.2" stroke-linecap="round" opacity="0.5"/>`).join("")}
      ${[0, 1].map((arm) => `<path d="${spiralPath(arm, 0.8, 8.4)}" fill="none" stroke="${v("moon-lit")}" stroke-width="1.5" stroke-linecap="round" opacity="0.95"/>`).join("")}
      ${[0, 1].map((arm) => `<path d="${spiralPath(arm, 1.4, 8.6, -0.32)}" fill="none" stroke="${v("moon-dark")}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>`).join("")}
      ${knots}
      <circle r="13" fill="url(#${id}-core)"/>
      <circle r="3.4" fill="${v("moon-lit")}"/>
    </g>`;
}

function globular(id, { cx = 60, cy = 60, radius = 46, count = n(210, 150), field = true, seed = 51 } = {}) {
  const r = rng(seed);
  const list = [];
  for (let i = 0; i < count; i++) {
    const u = r();
    const d = Math.min(radius, (radius / 6.5) * Math.tan(u * 1.38));
    const a = r() * Math.PI * 2;
    const x = cx + d * Math.cos(a);
    const y = cy + d * Math.sin(a);
    const inner = d < radius * 0.3;
    const size = (inner ? 0.55 : 0.45) + r() * (inner ? 0.6 : 0.85) * (1 - (d / radius) * 0.4);
    const fill = inner ? "moon-lit" : r() < 0.25 ? "star-accent" : r() < 0.55 ? "primary-strong" : "moon-lit";
    const o = inner ? 0.9 : f1(0.5 + r() * 0.5);
    list.push({ x, y, r: size, fill: v(fill), o });
  }
  const giants = [
    [cx - radius * 0.42, cy - radius * 0.3, radius * 0.12],
    [cx + radius * 0.5, cy + radius * 0.22, radius * 0.1],
    [cx + radius * 0.12, cy - radius * 0.62, radius * 0.08],
  ];
  return `
    ${field ? starField(seed + 1, n(14, 10), radius * 0.9) : ""}
    <defs><radialGradient id="${id}-glow"><stop offset="0" stop-color="${v("moon-lit")}" stop-opacity="0.85"/><stop offset="0.3" stop-color="${v("primary-strong")}" stop-opacity="0.45"/><stop offset="1" stop-color="${v("primary-strong")}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="${cx}" cy="${cy}" r="${radius * 0.75}" fill="url(#${id}-glow)"/>
    ${dots(list)}
    ${giants.map(([x, y, s]) => glint(f(x), f(y), f(s))).join("")}
    <circle cx="${cx}" cy="${cy}" r="${f(radius * 0.09)}" fill="${v("moon-lit")}"/>`;
}

function nebula(id) {
  // An emission nebula: a soft glow, layered wisps flowing one way, a tapered dark lane and a young cluster.
  const wisps = [
    [70, 52, 30, 7, -0.55, "moon-lit", 0.16],
    [52, 66, 32, 6, -0.45, "moon-lit", 0.14],
    [62, 44, 24, 5, -0.7, "primary-strong", 0.35],
    [46, 52, 22, 5.5, -0.3, "primary-strong", 0.3],
    [74, 70, 26, 5, -0.6, "primary-strong", 0.28],
    [60, 58, 16, 9, -0.5, "moon-lit", 0.3],
    [64, 55, 8, 5, -0.5, "moon-lit", 0.45],
    [38, 72, 16, 4, -0.2, "moon-lit", 0.12],
    [84, 42, 14, 3.5, -0.8, "moon-lit", 0.14],
  ];
  return `
    ${starField(61, n(30, 18), 0, 0.35)}
    <defs>
      <radialGradient id="${id}-glow" cx="55%" cy="50%" r="55%"><stop offset="0" stop-color="${v("primary-strong")}" stop-opacity="0.45"/><stop offset="1" stop-color="${v("primary-strong")}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}-dusk" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${v("dusk-glow")}" stop-opacity="1"/><stop offset="1" stop-color="${v("dusk-glow")}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}-warm" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${v("dusk-glow-horizon")}" stop-opacity="0.9"/><stop offset="1" stop-color="${v("dusk-glow-horizon")}" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="60" cy="58" rx="50" ry="40" transform="rotate(-28 60 58)" fill="url(#${id}-dusk)"/>
    <ellipse cx="52" cy="66" rx="26" ry="18" transform="rotate(-20 52 66)" fill="url(#${id}-warm)"/>
    <ellipse cx="62" cy="56" rx="44" ry="30" transform="rotate(-28 62 56)" fill="url(#${id}-glow)"/>
    ${wisps.map(([x, y, rx, ry, rot, c, o], k) => `<path d="${blob(66 + k, x, y, rx, ry, 9, 0.28, rot)}" fill="${v(c)}" opacity="${o}"/>`).join("")}
    ${[
      "M20 58C32 50 46 52 58 44S80 34 96 36",
      "M24 84C38 78 52 80 66 72S88 64 104 58",
      "M34 40C44 36 52 38 62 32",
      "M44 92C56 88 66 90 78 84",
    ]
      .map(
        (d, i) =>
          `<path d="${d}" fill="none" stroke="${v(i % 2 ? "primary-strong" : "moon-lit")}" stroke-width="${i < 2 ? 1.1 : 0.8}" stroke-linecap="round" opacity="${i < 2 ? 0.5 : 0.35}"/>`,
      )
      .join("")}
    <path d="M30 76C40 70 47 71 55 64C62 58 66 60 74 55C80 51 88 49 96 44C88 52 80 56 74 60C66 65 62 63 56 69C48 76 40 76 30 76Z" fill="${v("moon-dark")}" opacity="0.6"/>
    ${glint(64, 55, 6.5)}
    ${glint(60, 60, 2.6, v("moon-lit"), 0.95)}
    ${glint(68, 61, 2.2, v("moon-lit"), 0.9)}
    ${glint(80, 44, 3, v("moon-lit"), 0.8)}
    ${glint(42, 70, 2.8, v("moon-lit"), 0.75)}
    <circle cx="56" cy="50" r="0.9" fill="${v("moon-lit")}"/>`;
}

/** A laurel branch on a circle of radius `r` from angle a0 to a1 (degrees, screen y down), leaves alternating. */
function laurel(a0, a1, r, mirror) {
  let out = "";
  const steps = 9;
  const path = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    const x = 60 + r * Math.cos(a);
    const y = 60 + r * Math.sin(a);
    path.push(`${f(x)} ${f(y)}`);
    if (i === 0) continue;
    const tangent = (Math.atan2(Math.cos(a), -Math.sin(a)) * 180) / Math.PI + (mirror ? 180 : 0);
    for (const side of [-1, 1]) {
      const lx = x + Math.cos(a) * side * 3.2;
      const ly = y + Math.sin(a) * side * 3.2;
      const tilt = tangent + side * (mirror ? -35 : 35);
      const size = 4.6 - (i / steps) * 1.2;
      out += `<ellipse cx="${f(lx)}" cy="${f(ly)}" rx="${f(size)}" ry="${f(size * 0.42)}" transform="rotate(${f(tilt)} ${f(lx)} ${f(ly)})" fill="${v("primary-strong")}" opacity="${side > 0 ? 0.95 : 0.7}"/>`;
    }
  }
  return `<path d="M${path.join("L")}" fill="none" stroke="${v("primary-strong")}" stroke-width="1" opacity="0.8"/>${out}`;
}

function numberArt(id, label, { size, motif, pips = 0, wreath = false, seed }) {
  const y = wreath ? 72 : 76;
  const pipRow = Array.from({ length: pips }, (_, i) =>
    glint(60 + (i - (pips - 1) / 2) * 11, 94, 3.6, v("moon-lit")),
  ).join("");
  return `
    ${starField(seed, n(22, 14), 0)}
    ${wreath ? laurel(160, 255, 40, false) + laurel(20, -75, 40, true) : ""}
    ${motif}
    <text class="red-step" x="60" y="${y}" text-anchor="middle" style="font-family:'Archivo Variable',Archivo,sans-serif;font-stretch:125%;font-weight:700;font-size:${size}px;letter-spacing:-0.5px" fill="${v("moon-lit")}" stroke="${v("zenith")}" stroke-width="3" paint-order="stroke">${label}</text>
    ${pipRow}`;
}

function openCluster(cx, cy, s, seed) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < 9; i++) {
    const x = cx + (r() - 0.5) * 30 * s;
    const y = cy + (r() - 0.5) * 16 * s;
    const big = i < 4;
    out += big
      ? glint(f(x), f(y), f((2.2 + r() * 1.8) * s))
      : `<circle cx="${f(x)}" cy="${f(y)}" r="${f((0.6 + r() * 0.5) * s)}" fill="${v("moon-lit")}"/>`;
  }
  return out;
}

function planetaryMotif(cx, cy) {
  return `
    <ellipse cx="${cx}" cy="${cy}" rx="11" ry="8.5" fill="${v("dusk-glow")}" opacity="0.9"/>
    <ellipse cx="${cx}" cy="${cy}" rx="9.5" ry="7" fill="none" stroke="${v("primary-strong")}" stroke-width="3" opacity="0.85"/>
    <ellipse cx="${cx}" cy="${cy}" rx="13" ry="10.5" fill="none" stroke="${v("moon-lit")}" stroke-width="0.6" stroke-dasharray="1 2" opacity="0.7"/>
    <circle cx="${cx}" cy="${cy}" r="1.4" fill="${v("moon-lit")}"/>`;
}

export const ART = {
  "first-moon": moon,
  "first-planet": ringedPlanet,
  "all-planets": allPlanets,
  "first-galaxy": (id) => galaxy(id),
  "first-globular": (id) => globular(id),
  "first-nebula": nebula,
  "messier-10": (id) =>
    numberArt(id, "10", {
      size: 36,
      pips: 1,
      seed: 71,
      motif: galaxy(`${id}-m`, { scale: 0.34, cx: 60, cy: 34, field: false, seed: 72 }),
    }),
  "messier-25": (id) => numberArt(id, "25", { size: 36, pips: 2, seed: 73, motif: openCluster(60, 34, 1, 74) }),
  "messier-50": (id) =>
    numberArt(id, "50", {
      size: 36,
      pips: 3,
      seed: 75,
      motif: globular(`${id}-m`, { cx: 60, cy: 33, radius: 12, count: n(70, 50), field: false, seed: 76 }),
    }),
  "messier-110": (id) =>
    numberArt(id, "110", {
      size: 27,
      wreath: true,
      seed: 77,
      motif: `${glint(60, 34, 9)}${glint(48, 40, 3.2, v("moon-lit"), 0.85)}${glint(72, 40, 3.2, v("moon-lit"), 0.85)}`,
    }),
  "caldwell-all": (id) => numberArt(id, "61", { size: 34, wreath: true, seed: 79, motif: planetaryMotif(60, 35) }),
};

const NAMES = {
  "first-moon": "Pierwszy Księżyc",
  "first-planet": "Pierwsza planeta",
  "all-planets": "Wszystkie planety",
  "first-galaxy": "Pierwsza galaktyka",
  "first-globular": "Pierwsza gromada kulista",
  "first-nebula": "Pierwsza mgławica",
  "messier-10": "10 obiektów Messiera",
  "messier-25": "25 obiektów Messiera",
  "messier-50": "50 obiektów Messiera",
  "messier-110": "Wszystkie 110 obiektów Messiera",
  "caldwell-all": "Wszystkie 61 obiektów Caldwella",
};
const AHEAD = {
  "all-planets": [4, 7],
  "messier-10": [7, 10],
  "messier-25": [18, 25],
  "messier-50": [37, 50],
  "messier-110": [37, 110],
  "caldwell-all": [5, 61],
};
const DATES = [
  "14 sie 2026",
  "10 sie 2026",
  "3 wrz 2026",
  "17 cze 2026",
  "23 cze 2026",
  "1 cze 2026",
  "26 cze 2026",
  "16 sie 2026",
  "2 wrz 2026",
  "9 paź 2026",
  "12 paź 2026",
];
const KEYS = Object.keys(ART);

// ---------------------------------------------------------------- the badge frame (the component's job)

function badge(key, reached, px, uid) {
  const id = `${key}-${uid}`;
  const progress = AHEAD[key];
  const pct = progress ? (progress[0] / progress[1]) * 100 : 0;
  return `<svg class="night-sky badge" viewBox="0 0 120 120" width="${px}" height="${px}" aria-hidden="true">
    <defs>
      <radialGradient id="${id}-sky" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${v("horizon")}"/><stop offset="1" stop-color="${v("zenith")}"/></radialGradient>
      <clipPath id="${id}-clip"><circle cx="60" cy="60" r="51.5"/></clipPath>
    </defs>
    <circle cx="60" cy="60" r="58" fill="${reached ? `url(#${id}-sky)` : v("surface")}"/>
    <g clip-path="url(#${id}-clip)"${reached ? "" : ` class="ahead-art"`}>${ART[key](id)}</g>
    ${
      reached
        ? `<circle cx="60" cy="60" r="54" fill="none" stroke="${v("action-border")}" stroke-width="4.5"/>
           <circle cx="60" cy="60" r="50.6" fill="none" stroke="${v("primary-strong")}" stroke-width="0.8" opacity="0.35"/>
           <circle cx="99" cy="99" r="12.5" fill="${v("primary")}" stroke="${v("zenith")}" stroke-width="3"/>
           <path d="M93.5 99.2l3.8 3.8 7.2-7.6" fill="none" stroke="${v("primary-foreground")}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<circle cx="60" cy="60" r="54" fill="none" stroke="${v("control-border")}" stroke-width="2.4" stroke-dasharray="5 4.4"/>
           ${pct > 0 ? `<circle cx="60" cy="60" r="54" fill="none" stroke="${v("primary-strong")}" stroke-width="6.5" stroke-linecap="round" pathLength="100" stroke-dasharray="${f(pct)} 100" transform="rotate(-90 60 60)"/>` : ""}`
    }
  </svg>`;
}

// ---------------------------------------------------------------- sheets (only when run as a script)

/** Round 1b: the ahead art's opacity per theme, and red mode's one value step (ROUND1=1 renders round 1's values). */
const ROUND1 = process.env.ROUND1 === "1";
const AHEAD_OPACITY = ROUND1 ? { light: 0.4, dark: 0.4, red: 0.4 } : { light: 0.3, dark: 0.4, red: 0.6 };
const RED_STEP = ROUND1 ? 1 : 0.8;
const SUFFIX = process.env.SHEET_SUFFIX ?? "";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // ---------------------------------------------------------------- sources: one SVG per badge (art only)

  for (const key of KEYS) {
    const svg = `<!-- ui-progress-rewards badge art, round 1: ${key}. The illustration only, in the 120-unit badge space; the
     ring, disc, arc and check pip belong to MilestoneBadge. Colours are theme tokens (var(--…)) read inside a
     .night-sky scope; detail is by shape, line and value so the red theme (one hue) still reads. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs><clipPath id="${key}-src-clip"><circle cx="60" cy="60" r="51.5"/></clipPath></defs>
  <g clip-path="url(#${key}-src-clip)">${ART[key](`${key}-src`)}</g>
</svg>
`;
    if (!SUFFIX) writeFileSync(join(ART_DIR, `${key}.svg`), svg);
  }

  // ---------------------------------------------------------------- the theme tokens, straight from global.css

  const css = readFileSync(join(process.cwd(), "src/styles/global.css"), "utf8");
  const tokenBlocks = [];
  {
    let depth = 0;
    let start = 0;
    let selector = "";
    for (let i = 0; i < css.length; i++) {
      const ch = css[i];
      if (ch === "{") {
        if (depth === 0) {
          selector = css
            .slice(start, i)
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .split(";")
            .pop()
            .trim();
          start = i + 1;
        }
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const body = css.slice(start, i);
          if (/^(:root|\[data-theme|\.night-sky)/.test(selector) && !selector.startsWith("@")) {
            const decls = body.replace(/\/\*[\s\S]*?\*\//g, "").match(/--[\w-]+\s*:[^;]+;/g);
            if (decls) tokenBlocks.push(`${selector} { ${decls.join(" ")} }`);
          }
          start = i + 1;
        }
      }
    }
  }
  const font = readFileSync(
    require.resolve("@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2"),
  ).toString("base64");
  const head = `<meta charset="utf-8"><style>
@font-face{font-family:'Archivo Variable';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900;font-stretch:62% 125%}
${tokenBlocks.join("\n")}
*{box-sizing:border-box;margin:0}
body{font-family:'Archivo Variable',sans-serif}
.page{background:var(--background);color:var(--foreground);padding:24px 16px}
.title{font-stretch:125%;font-weight:700;font-size:22px;color:var(--heading)}
.sub{font-size:13px;color:var(--muted-foreground);margin-top:4px}
.section{font-size:13px;font-weight:600;letter-spacing:.04em;color:var(--muted-foreground);margin:24px 0 12px}
.grid{display:grid;gap:24px 16px}
.item{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0}
.name{margin-top:8px;font-size:15px;line-height:20px;overflow-wrap:anywhere}
.reached .name{font-weight:600;color:var(--heading)}
.ahead .name{color:var(--muted-foreground)}
.status{font-size:12px;line-height:16px;color:var(--muted-foreground)}
.strip{display:flex;gap:8px;justify-content:center}
.strip .k{font-size:10px;color:var(--muted-foreground);text-align:center;margin-top:2px}
/* Round 1b's per-theme classes, as the product's Tailwind variants write them. */
.ahead-art{opacity:${AHEAD_OPACITY.light}}
[data-theme="dark"] .ahead-art{opacity:${AHEAD_OPACITY.dark}}
[data-theme="red"] .ahead-art{opacity:${AHEAD_OPACITY.red}}
[data-theme="red"] .red-step{opacity:${RED_STEP}}
</style>`;

  const THEMES = { dark: "Ciemny", light: "Jasny", red: "Czerwony" };
  const item = (
    key,
    i,
    reached,
    px,
    uid,
  ) => `<div class="item ${reached ? "reached" : "ahead"}">${badge(key, reached, px, uid)}
  <div class="name">${NAMES[key]}</div>
  <div class="status">${reached ? `Osiągnięto: ${DATES[i]}` : AHEAD[key] ? `${AHEAD[key][0]} / ${AHEAD[key][1]}` : "Jeszcze nie"}</div></div>`;

  function pageHtml(theme, cols, width) {
    return `<!doctype html><html data-theme="${theme}"><head>${head}</head><body><div class="page" data-theme="${theme}" style="width:${width}px">
  <div style="max-width:768px;margin:0 auto">
  <div class="title">Kamienie milowe · runda 1</div><div class="sub">Motyw: ${THEMES[theme]} · odznaka 112 px · ${cols === 2 ? "telefon 390 px, 2 w rzędzie" : "desktop 1280 px, 4 w rzędzie"}</div>
  <div class="section">ZDOBYTE</div>
  <div class="grid" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${KEYS.map((k, i) => item(k, i, true, 112, `r${i}`)).join("")}</div>
  <div class="section">PRZED TOBĄ</div>
  <div class="grid" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${KEYS.map((k, i) => item(k, i, false, 112, `a${i}`)).join("")}</div>
  </div></div></body></html>`;
  }

  function sheetHtml() {
    const row = (theme, reached) =>
      `<div class="strip">${KEYS.map((k, i) => `<div>${badge(k, reached, 104, `${theme}${reached ? "r" : "a"}${i}`)}<div class="k">${k}</div></div>`).join("")}</div>`;
    return `<!doctype html><html><head>${head}</head><body>${Object.keys(THEMES)
      .map(
        (t) => `<div class="page" data-theme="${t}" style="width:1280px;padding:16px 20px">
      <div class="sub" style="margin:0 0 8px">${THEMES[t]} · zdobyte (góra) i przed tobą (dół: 4/7, 7/10, 18/25, 37/50, 37/110, 5/61, pierwsze bez łuku)</div>
      ${row(t, true)}<div style="height:12px"></div>${row(t, false)}</div>`,
      )
      .join("")}</body></html>`;
  }

  mkdirSync(OUT, { recursive: true });
  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch();
  async function shoot(html, width, file, scale = 2) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: scale });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate("document.fonts.ready");
    await page.screenshot({ path: join(OUT, file), fullPage: true });
    await page.close();
    console.log(file);
  }
  await shoot(sheetHtml(), 1280, `badge-art-sheet${SUFFIX}.png`);
  if (!SUFFIX)
    for (const theme of Object.keys(THEMES)) {
      await shoot(pageHtml(theme, 2, 390), 390, `badge-art-phone-${theme}.png`);
      await shoot(pageHtml(theme, 4, 1280), 1280, `badge-art-desktop-${theme}.png`, 1);
    }
  await browser.close();
}
