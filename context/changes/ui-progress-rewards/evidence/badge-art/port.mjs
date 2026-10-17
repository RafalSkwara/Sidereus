// Ports the approved badge art (round 1b, `render.mjs`'s `ART`) into the product: one server-rendered
// `src/components/progress/badge-art/<Key>Art.astro` per milestone, static coordinates only (nothing is computed at
// request time). Ids take the badge's `idBase` prop, so several badges on one page never collide; the sheets' classes
// become Tailwind's (`red-step` → `red:opacity-80`), and the numerals' inline font style becomes the `font-display`
// role plus SVG user-unit attributes. MilestoneBadge.astro picks the component by key in an exhaustive
// `switch` (an .astro component value is untyped for the type-aware lint, so no key → component record). Run from the repo root,
// then format:
//   node context/changes/ui-progress-rewards/evidence/badge-art/port.mjs && npx prettier --write src/components/progress/badge-art
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ART } from "./render.mjs";

const OUT = join(process.cwd(), "src/components/progress/badge-art");
const ID = "@@ID@@";
mkdirSync(OUT, { recursive: true });

const pascal = (key) =>
  key
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");

function toAstro(markup) {
  let out = markup
    .replace(/<g class="red-step">/g, '<g class="red:opacity-80">')
    .replace(
      /<text class="red-step" ([^>]*?)style="font-family:[^;]*;font-stretch:125%;font-weight:700;font-size:([\d.]+)px;letter-spacing:([-\d.]+)px"/g,
      '<text class="font-display font-bold red:opacity-80" $1font-size="$2" letter-spacing="$3"',
    );
  if (out.includes("red-step") || out.includes("style=")) throw new Error("unported class or style left");
  out = out.replace(/(\s[\w:-]+)="([^"]*@@ID@@[^"]*)"/g, (_, name, value) => `${name}={\`${value.replaceAll(ID, "${idBase}")}\`}`);
  if (out.includes(ID)) throw new Error("unported id left");
  return out.replace(/\n\s*/g, "");
}

const keys = Object.keys(ART);
for (const key of keys) {
  const name = `${pascal(key)}Art`;
  const art = ART[key](ID);
  const uses = art.includes(ID);
  const body = toAstro(art);
  writeFileSync(
    join(OUT, `${name}.astro`),
    `---
// The "${key}" badge's illustration (ui-progress-rewards), in the 120-unit badge space; MilestoneBadge clips it and
// draws the disc, ring, arc and pip. Generated from the owner-approved art (round 1b) by
// context/changes/ui-progress-rewards/evidence/badge-art/port.mjs: change the art there and re-run, never by hand.
// Tokens only (var(--…)); value steps by opacity; red mode reads by shape and value.
export interface Props {
  /** Prefix for this badge's gradient and clip ids, unique on the page. */
  idBase: string;
}

${uses ? "const { idBase } = Astro.props;" : "// This art has no gradient or clip ids, so it does not read \`idBase\`."}
---

${body}
`,
  );
  console.log(name);
}
