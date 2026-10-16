#!/usr/bin/env node
/**
 * Regenerates the star designation inputs of `npm run stars:build`. A manual, network-using command: the star build
 * itself stays offline and deterministic because it reads only the committed files this script writes.
 *
 *   npm run stars:designations                      live: Hipparcos pin, Wikidata, WGSN page
 *   npm run stars:designations -- --save-raw <dir>  live, and keep the raw responses in <dir> (new or empty)
 *   npm run stars:designations -- --from-raw <dir>  rebuild from a saved <dir>, no network (determinism check)
 *
 * Output (scripts/data/, or $DESIGNATIONS_OUT_DIR):
 *   star-designations.json  { meta, stars: { "<hip>": [bayer|null, flamsteed|null] } }  generated, never edited
 *   iau-star-names.json     { meta, names: { "<hip>": "<name>" } }                       generated, never edited
 * Input that is edited by hand and read here (never written):
 *   star-designation-overrides.json  { "<hip>": { bayer?, flamsteed?, omit?, source } }
 *
 * Sources: Wikidata (CC0 1.0; property P528 "catalog code" with catalogue qualifier P972: Q537199 Hipparcos,
 * Q105616 Bayer, Q111116 Flamsteed; plus the items' English labels where P528 gives a kind nothing), and the IAU
 * Working Group on Star Names list (public domain names; https://exopla.net/star-names/modern-iau-star-names/).
 * Positions, and with them each star's constellation (astronomy-engine `Constellation`), come from the verified
 * Hipparcos reader (scripts/lib/hipparcos.mjs), never from Wikidata, three of whose items carry invalid coordinates.
 * This script never reads HYG.
 *
 * The clock is read once, for `meta.fetchedAt`, in a live run. A `--from-raw` run takes that date from the saved
 * `meta.json`, so two such runs over the same directory write byte-identical files.
 */
import { Constellation } from "astronomy-engine";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDesignationTables } from "./lib/designations.mjs";
import { HIPPARCOS_PIN, readHipparcos } from "./lib/hipparcos.mjs";

/** The project URL as the contact, never a person's address. */
const USER_AGENT = "Sidereus (+https://github.com/RafalSkwara/Sidereus)";
const SPARQL_URL = "https://query.wikidata.org/sparql";
const WGSN_URL = "https://exopla.net/star-names/modern-iau-star-names/";
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 180_000;
/** Pause between the two Wikidata queries and before the WGSN request; the service is shared. */
const POLITE_PAUSE_MS = 2_000;

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "data");
const OUT_DIR =
  process.env.DESIGNATIONS_OUT_DIR === undefined ? DATA_DIR : path.resolve(process.env.DESIGNATIONS_OUT_DIR);
const OVERRIDES_FILE = path.join(DATA_DIR, "star-designation-overrides.json");

/** Query 1: every Bayer and Flamsteed catalogue code of an item that also has a Hipparcos code. */
const DESIGNATIONS_QUERY = `SELECT ?hip ?value ?catalog WHERE {
  VALUES ?catalog { wd:Q105616 wd:Q111116 }
  ?s p:P528 ?hs . ?hs ps:P528 ?hip ; pq:P972 wd:Q537199 .
  ?s p:P528 ?ds . ?ds ps:P528 ?value ; pq:P972 ?catalog .
}`;

/** Query 2: the English labels of Hipparcos items that read like a designation ("Beta2 Capricorni", "30 Sagittarii"). */
const LABELS_QUERY = `SELECT ?hip ?label WHERE {
  ?s p:P528 ?hs . ?hs ps:P528 ?hip ; pq:P972 wd:Q537199 .
  ?s rdfs:label ?label . FILTER(LANG(?label) = "en")
  FILTER(REGEX(?label, "^((Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Omicron|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega)[0-9]?|[0-9]+) [A-Z][A-Za-zëö]+( [A-Z][a-z]+)?$"))
}`;

const RAW_FILES = {
  designations: "wikidata-designations.json",
  labels: "wikidata-labels.json",
  wgsn: "wgsn-star-names.html",
  hipparcos: "hipparcos-rows.json",
  meta: "meta.json",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function describe(error) {
  const lines = [error instanceof Error ? error.message : String(error)];
  for (let cause = error instanceof Error ? error.cause : undefined; cause !== undefined;) {
    lines.push(`  caused by: ${cause instanceof Error ? cause.message : String(cause)}`);
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  return lines.join("\n");
}

function parseArgs(argv) {
  const options = { saveRaw: null, fromRaw: null };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--save-raw" || flag === "--from-raw") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${flag} needs a directory`);
      }
      options[flag === "--save-raw" ? "saveRaw" : "fromRaw"] = path.resolve(value);
    } else {
      throw new Error(`Unknown argument "${flag}" (use --save-raw <dir> or --from-raw <dir>)`);
    }
  }
  if (options.saveRaw !== null && options.fromRaw !== null) {
    throw new Error("--save-raw and --from-raw cannot be combined");
  }
  return options;
}

/** One polite GET or POST with a timeout; retries 429 and 5xx at most MAX_RETRIES times, honouring Retry-After. */
async function politeFetch(url, init, label) {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      if (attempt >= MAX_RETRIES) {
        throw new Error(`${label}: request failed after ${attempt + 1} attempts`, { cause: error });
      }
      await sleep(5_000 * 2 ** attempt);
      continue;
    } finally {
      clearTimeout(timer);
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= MAX_RETRIES) {
      throw new Error(`${label}: ${url} answered ${response.status} ${response.statusText}`);
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 120) * 1000 : 5_000 * 2 ** attempt;
    console.log(
      `${label}: ${response.status}, retrying in ${Math.round(waitMs / 1000)} s (${attempt + 1}/${MAX_RETRIES})`,
    );
    await sleep(waitMs);
  }
}

async function sparql(query, label) {
  const text = await politeFetch(
    SPARQL_URL,
    {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ query }),
    },
    label,
  );
  parseBindings(text, label);
  return text;
}

function parseBindings(text, label) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${label}: the response is not JSON`, { cause: error });
  }
  const bindings = parsed?.results?.bindings;
  if (!Array.isArray(bindings)) {
    throw new Error(`${label}: the response has no results.bindings`);
  }
  return bindings;
}

async function ensureEmptyDirectory(dir) {
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir);
  if (entries.length > 0) {
    throw new Error(`${dir} is not empty; --save-raw needs a new or empty directory`);
  }
}

async function liveInputs(saveRawDir) {
  if (saveRawDir !== null) {
    await ensureEmptyDirectory(saveRawDir);
  }
  const hipparcos = await readHipparcos();
  console.log(
    `Hipparcos: ${hipparcos.rows.length} stars at V <= 7.5, verified (${hipparcos.stats.url}, sha256 ${hipparcos.stats.sha256})`,
  );
  const fetchedAt = new Date().toISOString();
  const designations = await sparql(DESIGNATIONS_QUERY, "Wikidata designations");
  await sleep(POLITE_PAUSE_MS);
  const labels = await sparql(LABELS_QUERY, "Wikidata labels");
  await sleep(POLITE_PAUSE_MS);
  const wgsn = await politeFetch(WGSN_URL, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } }, "WGSN page");

  const hipparcosRaw = {
    stats: hipparcos.stats,
    skipped: hipparcos.skipped,
    rows: hipparcos.rows.map(({ hip, vmag, raDeg, decDeg, fromSexagesimal }) => ({
      hip,
      vmag,
      raDeg,
      decDeg,
      fromSexagesimal,
    })),
  };
  const meta = { fetchedAt, userAgent: USER_AGENT, sparqlUrl: SPARQL_URL, wgsnUrl: WGSN_URL };
  if (saveRawDir !== null) {
    await writeFile(path.join(saveRawDir, RAW_FILES.designations), designations);
    await writeFile(path.join(saveRawDir, RAW_FILES.labels), labels);
    await writeFile(path.join(saveRawDir, RAW_FILES.wgsn), wgsn);
    await writeFile(path.join(saveRawDir, RAW_FILES.hipparcos), `${JSON.stringify(hipparcosRaw)}\n`);
    await writeFile(path.join(saveRawDir, RAW_FILES.meta), `${JSON.stringify(meta, null, 2)}\n`);
    console.log(`Raw responses saved to ${saveRawDir}`);
  }
  return { designations, labels, wgsn, hipparcosRaw, meta };
}

async function savedInputs(dir) {
  const read = (name) => readFile(path.join(dir, name), "utf8");
  const [designations, labels, wgsn, hipparcos, meta] = await Promise.all([
    read(RAW_FILES.designations),
    read(RAW_FILES.labels),
    read(RAW_FILES.wgsn),
    read(RAW_FILES.hipparcos),
    read(RAW_FILES.meta),
  ]);
  return { designations, labels, wgsn, hipparcosRaw: JSON.parse(hipparcos), meta: JSON.parse(meta) };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputs = options.fromRaw === null ? await liveInputs(options.saveRaw) : await savedInputs(options.fromRaw);
  const overrides = JSON.parse(await readFile(OVERRIDES_FILE, "utf8"));

  const { starsText, namesText, summary } = buildDesignationTables({
    rows: inputs.hipparcosRaw.rows,
    constellationOf: (raHours, decDeg) => Constellation(raHours, decDeg).symbol,
    designationBindings: parseBindings(inputs.designations, "Wikidata designations"),
    labelBindings: parseBindings(inputs.labels, "Wikidata labels"),
    overrides,
    wgsnHtml: inputs.wgsn,
    hipparcos: inputs.hipparcosRaw.stats,
    inputs: {
      fetchedAt: inputs.meta.fetchedAt,
      queries: {
        designations: DESIGNATIONS_QUERY.replace(/\s+/g, " "),
        labels: LABELS_QUERY.replace(/\s+/g, " "),
      },
      sources: [
        {
          kind: "designations",
          name: "Wikidata",
          url: SPARQL_URL,
          licence: "CC0 1.0 (https://www.wikidata.org/wiki/Wikidata:Licensing)",
          properties:
            "P528 catalog code with qualifier P972 catalog: Q537199 Hipparcos Catalogue, Q105616 Bayer designation, Q111116 Flamsteed designation; English item labels where P528 gives a kind nothing",
        },
        {
          kind: "designations",
          name: "Hipparcos Catalogue V1 positions (constellation filter only)",
          url: HIPPARCOS_PIN.url,
          licence: "CC BY-NC 3.0 IGO",
          note: "Positions give each star's constellation; no Hipparcos value is stored in this table.",
        },
        {
          kind: "names",
          name: "IAU Working Group on Star Names (WGSN)",
          url: WGSN_URL,
          licence:
            "IAU star names are not subject to copyright or intellectual property licensing and belong to the public domain (exopla.net, quoted 2026-10-16); only names and HIP numbers are read, the page's etymology texts and images (CC BY) are not copied",
        },
      ],
    },
  });

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "star-designations.json"), starsText);
  await writeFile(path.join(OUT_DIR, "iau-star-names.json"), namesText);

  const { counts, nameCounts } = summary;
  console.log(
    `designated stars: ${counts.designated} (Bayer ${counts.bayer}, Flamsteed ${counts.flamsteed}, both ${counts.both})`,
  );
  console.log(
    `from the label fallback: Bayer ${counts.fromLabelFallback.bayer}, Flamsteed ${counts.fromLabelFallback.flamsteed}`,
  );
  console.log(`omitted by policy: ${counts.omittedByPolicy}; overrides: ${counts.overrides}`);
  console.log(
    `IAU names: ${nameCounts.hips} HIPs (${nameCounts.withinHipparcosVmag7_5} within the Hipparcos rows at V <= 7.5)`,
  );
  console.log(`fetched ${inputs.meta.fetchedAt}; written to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(describe(error));
  process.exit(1);
});
