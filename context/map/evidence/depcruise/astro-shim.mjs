// Run dependency-cruiser over .astro files too (repo map m4 L2, evidence 3b).
//
// dependency-cruiser has no Astro parser: with `extraExtensionsToScan: [".astro"]` an .astro file is a node with no
// outgoing edges. This script builds a mirror of src/ and scripts/ in which every `X.astro` is replaced by
// `X.astro.ts` holding its frontmatter and its <script> blocks (the same extraction the map's TypeScript run used).
// Imports of "./X.astro" still resolve, because the resolver appends ".ts" to the specifier. The repo's own
// .dependency-cruiser.cjs is then run over the mirror and ".astro.ts" is renamed back to ".astro" in the output.
// Template-only usage (a component used without an import) is invisible, as in the map's run.
//
// Usage: node context/map/evidence/depcruise/astro-shim.mjs <mirror-dir> <out.json> [source-root]
// source-root (default: this checkout) may be an extracted `git archive <rev> src scripts`, to cruise an older commit.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "../../../..");
const [mirrorArg, outArg, sourceArg] = process.argv.slice(2);
if (!mirrorArg || !outArg) throw new Error("usage: astro-shim.mjs <mirror-dir> <out.json>");
const mirror = resolve(mirrorArg);
const out = resolve(outArg);
const source = sourceArg ? resolve(sourceArg) : repo;

rmSync(mirror, { recursive: true, force: true });
mkdirSync(mirror, { recursive: true });
for (const dir of ["src", "scripts"]) cpSync(join(source, dir), join(mirror, dir), { recursive: true });
cpSync(join(repo, "package.json"), join(mirror, "package.json"));
symlinkSync(join(repo, "node_modules"), join(mirror, "node_modules"));
writeFileSync(
  join(mirror, "tsconfig.json"),
  JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] }, jsx: "react-jsx", allowJs: true } }),
);

function astroToTs(text) {
  const parts = [];
  const fm = /^\s*---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (fm) parts.push(fm[1]);
  for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=|type="application\/(ld\+)?json"/.test(m[1])) continue;
    parts.push(m[2]);
  }
  return parts.join("\n;\n");
}

let converted = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".astro")) {
      writeFileSync(`${p}.ts`, astroToTs(readFileSync(p, "utf8")));
      unlinkSync(p);
      converted += 1;
    }
  }
}
walk(join(mirror, "src"));

const json = execFileSync(
  join(repo, "node_modules/.bin/depcruise"),
  ["src", "scripts", "--config", join(repo, ".dependency-cruiser.cjs"), "--metrics", "-T", "json"],
  { cwd: mirror, maxBuffer: 1 << 28, encoding: "utf8" },
);
writeFileSync(out, json.replaceAll(".astro.ts", ".astro"));
console.log(`astro files converted: ${converted}; output: ${out}`);
