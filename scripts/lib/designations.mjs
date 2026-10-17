/**
 * Pure rules that turn raw Wikidata and IAU WGSN values into the app's designation convention, for
 * scripts/build-star-designations.mjs. Nothing here reads the network, the clock or HYG.
 *
 * The app's convention (src/lib/catalogue/finder-stars.ts): a star's tuple is [bayer, flamsteed, con, proper]; `bayer`
 * is the three-letter Greek abbreviation with a `-n` component suffix ("Alp", "Pi-1", "Psi-10"), `flamsteed` an
 * integer, `con` the IAU constellation abbreviation. A wrong designation is worse than a missing one, so every
 * ambiguity ends in an omission unless a hand-written override cites a source.
 */

/** Greek lower-case letters (including the Greek omicron U+03BF) to the app's three-letter abbreviations. */
export const GREEK_ABBREVIATIONS = Object.freeze({
  α: "Alp",
  β: "Bet",
  γ: "Gam",
  δ: "Del",
  ε: "Eps",
  ζ: "Zet",
  η: "Eta",
  θ: "The",
  ι: "Iot",
  κ: "Kap",
  λ: "Lam",
  μ: "Mu",
  ν: "Nu",
  ξ: "Xi",
  ο: "Omi",
  π: "Pi",
  ρ: "Rho",
  σ: "Sig",
  τ: "Tau",
  υ: "Ups",
  φ: "Phi",
  χ: "Chi",
  ψ: "Psi",
  ω: "Ome",
});

/** English letter names, as Wikidata's item labels spell them ("Beta2 Capricorni"). */
const GREEK_NAMES = Object.freeze({
  Alpha: "Alp",
  Beta: "Bet",
  Gamma: "Gam",
  Delta: "Del",
  Epsilon: "Eps",
  Zeta: "Zet",
  Eta: "Eta",
  Theta: "The",
  Iota: "Iot",
  Kappa: "Kap",
  Lambda: "Lam",
  Mu: "Mu",
  Nu: "Nu",
  Xi: "Xi",
  Omicron: "Omi",
  Pi: "Pi",
  Rho: "Rho",
  Sigma: "Sig",
  Tau: "Tau",
  Upsilon: "Ups",
  Phi: "Phi",
  Chi: "Chi",
  Psi: "Psi",
  Omega: "Ome",
});

const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** The 88 IAU constellations: abbreviation to Latin genitive, for reading Wikidata's English labels. */
export const CONSTELLATION_GENITIVES = Object.freeze({
  And: "Andromedae",
  Ant: "Antliae",
  Aps: "Apodis",
  Aqr: "Aquarii",
  Aql: "Aquilae",
  Ara: "Arae",
  Ari: "Arietis",
  Aur: "Aurigae",
  Boo: "Bootis",
  CMa: "Canis Majoris",
  CMi: "Canis Minoris",
  Cnc: "Cancri",
  CVn: "Canum Venaticorum",
  Cae: "Caeli",
  Cam: "Camelopardalis",
  Cap: "Capricorni",
  Car: "Carinae",
  Cas: "Cassiopeiae",
  Cen: "Centauri",
  Cep: "Cephei",
  Cet: "Ceti",
  Cha: "Chamaeleontis",
  Cir: "Circini",
  Col: "Columbae",
  Com: "Comae Berenices",
  CrA: "Coronae Australis",
  CrB: "Coronae Borealis",
  Crv: "Corvi",
  Crt: "Crateris",
  Cru: "Crucis",
  Cyg: "Cygni",
  Del: "Delphini",
  Dor: "Doradus",
  Dra: "Draconis",
  Equ: "Equulei",
  Eri: "Eridani",
  For: "Fornacis",
  Gem: "Geminorum",
  Gru: "Gruis",
  Her: "Herculis",
  Hor: "Horologii",
  Hya: "Hydrae",
  Hyi: "Hydri",
  Ind: "Indi",
  Lac: "Lacertae",
  Leo: "Leonis",
  LMi: "Leonis Minoris",
  Lep: "Leporis",
  Lib: "Librae",
  Lup: "Lupi",
  Lyn: "Lyncis",
  Lyr: "Lyrae",
  Men: "Mensae",
  Mic: "Microscopii",
  Mon: "Monocerotis",
  Mus: "Muscae",
  Nor: "Normae",
  Oct: "Octantis",
  Oph: "Ophiuchi",
  Ori: "Orionis",
  Pav: "Pavonis",
  Peg: "Pegasi",
  Per: "Persei",
  Phe: "Phoenicis",
  Pic: "Pictoris",
  Psc: "Piscium",
  PsA: "Piscis Austrini",
  Pup: "Puppis",
  Pyx: "Pyxidis",
  Ret: "Reticuli",
  Sge: "Sagittae",
  Sgr: "Sagittarii",
  Sco: "Scorpii",
  Scl: "Sculptoris",
  Sct: "Scuti",
  Ser: "Serpentis",
  Sex: "Sextantis",
  Tau: "Tauri",
  Tel: "Telescopii",
  Tri: "Trianguli",
  TrA: "Trianguli Australis",
  Tuc: "Tucanae",
  UMa: "Ursae Majoris",
  UMi: "Ursae Minoris",
  Vel: "Velorum",
  Vir: "Virginis",
  Vol: "Volantis",
  Vul: "Vulpeculae",
});

/** Genitive (with "Boötis" folded to "Bootis") to abbreviation. */
const CONSTELLATION_BY_GENITIVE = new Map(
  Object.entries(CONSTELLATION_GENITIVES).map(([abbr, genitive]) => [genitive, abbr]),
);

function superscriptToDigits(text) {
  return [...text]
    .map((ch) => (SUPERSCRIPT_DIGITS.includes(ch) ? String(SUPERSCRIPT_DIGITS.indexOf(ch)) : ch))
    .join("");
}

/**
 * Classifies a Wikidata Bayer value ("β And", "π¹ Ori", "ψ¹⁰ Aur", "τ2 Aqr"). Returns `{ ok: true, bayer, con }` with
 * `bayer` in the app's form ("Bet", "Pi-1", "Psi-10"; the superscript's digits are written one by one) and `con` as
 * the value carries it, or `{ ok: false, reason }`: `latin-letter` (Latin letters such as "d Eri", which the app does
 * not show), `component` (a trailing component letter such as "θ¹ Ori A" or "α Cen A") or `unrecognised`.
 */
export function classifyBayer(value) {
  const text = String(value).trim();
  const match = /^(\p{L})([¹²³⁴⁵⁶⁷⁸⁹⁰0-9]*) ([A-Za-z]{3})(?: ([A-Za-z]))?$/u.exec(text);
  if (match === null) {
    return { ok: false, reason: "unrecognised" };
  }
  const [, letter, superscript, con, componentLetter] = match;
  if (/^[A-Za-z]$/.test(letter)) {
    return { ok: false, reason: "latin-letter" };
  }
  if (componentLetter !== undefined) {
    return { ok: false, reason: "component" };
  }
  const abbreviation = GREEK_ABBREVIATIONS[letter];
  if (abbreviation === undefined) {
    return { ok: false, reason: "unrecognised" };
  }
  const digits = superscriptToDigits(superscript);
  return { ok: true, bayer: digits === "" ? abbreviation : `${abbreviation}-${digits}`, con };
}

/** The app's Bayer form and the constellation abbreviation, or null when the value is not a plain Greek-letter Bayer. */
export function bayerAbbreviation(value) {
  const result = classifyBayer(value);
  return result.ok ? { bayer: result.bayer, con: result.con } : null;
}

/** "43 And" to `{ number: 43, con: "And" }`; null for anything else (a component letter, a letter, no number). */
export function flamsteedNumber(value) {
  const match = /^([1-9]\d{0,2}) ([A-Za-z]{3})$/.exec(String(value).trim());
  return match === null ? null : { number: Number(match[1]), con: match[2] };
}

/**
 * Reads one of Wikidata's English item labels ("Beta2 Capricorni", "30 Sagittarii") into the same shape as the two
 * functions above: `{ kind: "bayer", value: "Bet-2", con }` or `{ kind: "flamsteed", value: 30, con }`. The
 * constellation comes from the label's own Latin genitive; a label with a component letter, an unknown genitive or any
 * other shape gives null.
 */
export function labelDesignation(label) {
  const text = String(label).normalize("NFC").replace(/ö/g, "o").trim();
  const bayerMatch = /^([A-Z][a-z]+?)([0-9]*) (.+)$/.exec(text);
  if (bayerMatch !== null && GREEK_NAMES[bayerMatch[1]] !== undefined) {
    const con = CONSTELLATION_BY_GENITIVE.get(bayerMatch[3]);
    if (con === undefined) {
      return null;
    }
    const abbreviation = GREEK_NAMES[bayerMatch[1]];
    return { kind: "bayer", value: bayerMatch[2] === "" ? abbreviation : `${abbreviation}-${bayerMatch[2]}`, con };
  }
  const flamsteedMatch = /^([1-9]\d{0,2}) (.+)$/.exec(text);
  if (flamsteedMatch !== null) {
    const con = CONSTELLATION_BY_GENITIVE.get(flamsteedMatch[2]);
    if (con !== undefined) {
      return { kind: "flamsteed", value: Number(flamsteedMatch[1]), con };
    }
  }
  return null;
}

/**
 * Picks the one value a star keeps for one kind of designation, or none.
 *
 * `candidates` is `[{ value, con }]` (the value in the app's form and the constellation the source wrote with it),
 * `computedCon` the constellation computed from the star's Hipparcos position, `override` the hand-written decision
 * for this star and kind (`{ omit: true, source }` or `{ value, source }`), or undefined.
 *
 * Returns `{ value, decision, ... }`, `value` null for an omission. Decisions: `override` (the value, with its
 * `source`), `override-omit`, `clear` (the only candidate, in the computed constellation), `none` (no candidate),
 * `wrong-constellation` (candidates exist but none is in the computed constellation, so none is kept) and
 * `ambiguous` (several different values in the computed constellation, so none is kept; `candidates` lists them).
 * A value is never returned without an override or a single clear candidate.
 */
export function chooseDesignation(candidates, computedCon, override) {
  if (override !== undefined) {
    if (typeof override.source !== "string" || override.source.trim() === "") {
      throw new Error("An override needs a non-empty source");
    }
    if (override.omit === true) {
      return { value: null, decision: "override-omit", source: override.source };
    }
    if (override.value === undefined || override.value === null) {
      throw new Error("An override needs a value or omit: true");
    }
    return { value: override.value, decision: "override", source: override.source };
  }
  if (candidates.length === 0) {
    return { value: null, decision: "none" };
  }
  const inConstellation = [];
  for (const candidate of candidates) {
    if (candidate.con === computedCon && !inConstellation.includes(candidate.value)) {
      inConstellation.push(candidate.value);
    }
  }
  if (inConstellation.length === 0) {
    return { value: null, decision: "wrong-constellation", candidates: candidates.map((c) => `${c.value} ${c.con}`) };
  }
  if (inConstellation.length > 1) {
    return { value: null, decision: "ambiguous", candidates: [...inConstellation] };
  }
  return { value: inConstellation[0], decision: "clear" };
}

const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body) => {
    if (body.startsWith("#x")) {
      return String.fromCodePoint(parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) {
      return String.fromCodePoint(Number(body.slice(1)));
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}

function cellText(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

/** The first columns of the WGSN table as recorded on 2026-10-16; the later ones are not read. */
export const IAU_TABLE_COLUMNS = Object.freeze(["proper names", "NEC+", "Designation", "HIP", "Bayer ID"]);

/**
 * Reads the proper names and HIP numbers out of the WGSN page's HTML table
 * (https://exopla.net/star-names/modern-iau-star-names/). Returns `[{ name, hip, bayerId }]` in page order, `hip` a
 * number or null (names of nebulae and stars without a Hipparcos number). Throws with a clear message when the page is
 * not the table that was recorded: the header's first five columns, a row whose cell count differs from the header's, a
 * HIP cell that is neither empty nor digits, an empty name, fewer than `minRows` rows or fewer than `minWithHip` rows
 * with a HIP (600 and 500 recorded: 640 and 567 on 2026-10-16).
 */
export function parseIauTable(html, { minRows = 600, minWithHip = 500 } = {}) {
  const head = /<thead[^>]*>(.*?)<\/thead>/s.exec(html);
  if (head === null) {
    throw new Error("WGSN table: no <thead> found, the page layout changed");
  }
  const header = [...head[1].matchAll(/<th[^>]*>(.*?)<\/th>/gs)].map((m) => cellText(m[1]));
  IAU_TABLE_COLUMNS.forEach((expected, i) => {
    if (header[i]?.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(
        `WGSN table: column ${i + 1} is "${header[i] ?? "(missing)"}", expected "${expected}" (header: ${header.join(" | ")})`,
      );
    }
  });

  const rows = [];
  for (const rowMatch of html.matchAll(/<tr id="table_\d+_row_(\d+)"[^>]*>(.*?)<\/tr>/gs)) {
    const cells = [...rowMatch[2].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((m) => cellText(m[1]));
    if (cells.length !== header.length) {
      throw new Error(`WGSN table: row ${rowMatch[1]} has ${cells.length} cells, the header has ${header.length}`);
    }
    const [name, , , hipText, bayerId] = cells;
    if (name === "") {
      throw new Error(`WGSN table: row ${rowMatch[1]} has no proper name`);
    }
    if (hipText !== "" && !/^\d+$/.test(hipText)) {
      throw new Error(`WGSN table: row ${rowMatch[1]} has HIP "${hipText}", expected digits or nothing`);
    }
    rows.push({ name: name.normalize("NFC"), hip: hipText === "" ? null : Number(hipText), bayerId });
  }
  const withHip = rows.filter((r) => r.hip !== null).length;
  if (rows.length < minRows || withHip < minWithHip) {
    throw new Error(
      `WGSN table: ${rows.length} rows (${withHip} with a HIP), expected at least ${minRows} (${minWithHip} with a HIP)`,
    );
  }
  return rows;
}

/**
 * One name per HIP from the parsed WGSN rows. A HIP that two rows share (HIP 72105: Izar, epsilon Boo, and Pulcherrima,
 * epsilon Boo B) keeps the name of the row whose Bayer ID carries no component letter, and the other is reported in
 * `dropped`; two rows that cannot be told apart by that rule, or a name used for two HIPs, throw.
 */
export function namesByHip(rows) {
  const byHip = new Map();
  for (const row of rows) {
    if (row.hip === null) {
      continue;
    }
    byHip.set(row.hip, [...(byHip.get(row.hip) ?? []), row]);
  }
  const names = new Map();
  const dropped = [];
  for (const [hip, group] of [...byHip].sort((a, b) => a[0] - b[0])) {
    let kept = group[0];
    if (group.length > 1) {
      const plain = group.filter((row) => !/ [A-Za-z]$/.test(row.bayerId));
      if (plain.length !== 1) {
        throw new Error(`HIP ${hip} has ${group.length} WGSN names and no single one without a component letter`);
      }
      kept = plain[0];
      for (const row of group) {
        if (row !== kept) {
          dropped.push({ hip, name: row.name, bayerId: row.bayerId, keptName: kept.name });
        }
      }
    }
    names.set(hip, kept.name);
  }
  const seen = new Map();
  for (const [hip, name] of names) {
    if (seen.has(name)) {
      throw new Error(`The name "${name}" is used for HIP ${seen.get(name)} and HIP ${hip}`);
    }
    seen.set(name, hip);
  }
  return { names, dropped };
}

/** Validates the hand-edited override file: HIP keys, known fields only, a citable source on every entry. */
export function validateOverrides(overrides) {
  if (overrides === null || typeof overrides !== "object" || Array.isArray(overrides)) {
    throw new Error("The overrides file must be an object keyed by HIP");
  }
  for (const [hip, entry] of Object.entries(overrides)) {
    if (!/^[1-9]\d*$/.test(hip)) {
      throw new Error(`Override key "${hip}" is not a HIP number`);
    }
    for (const key of Object.keys(entry)) {
      if (!["bayer", "flamsteed", "omit", "source"].includes(key)) {
        throw new Error(`Override for HIP ${hip} has an unknown field "${key}"`);
      }
    }
    if (typeof entry.source !== "string" || entry.source.trim() === "") {
      throw new Error(`Override for HIP ${hip} has no source`);
    }
    if (
      entry.bayer !== undefined &&
      (typeof entry.bayer !== "string" || !/^[A-Z][a-z]{1,2}(-\d+)?$/.test(entry.bayer))
    ) {
      throw new Error(`Override for HIP ${hip}: bayer "${entry.bayer}" is not the app's form (Alp, Pi-1)`);
    }
    if (entry.flamsteed !== undefined && !(Number.isInteger(entry.flamsteed) && entry.flamsteed > 0)) {
      throw new Error(`Override for HIP ${hip}: flamsteed must be a positive integer`);
    }
    const omit = entry.omit;
    const validOmit =
      omit === undefined ||
      omit === true ||
      (Array.isArray(omit) && omit.length > 0 && omit.every((kind) => kind === "bayer" || kind === "flamsteed"));
    if (!validOmit) {
      throw new Error(`Override for HIP ${hip}: omit must be true or a list of "bayer" / "flamsteed"`);
    }
    if (omit !== undefined && (entry.bayer !== undefined || entry.flamsteed !== undefined)) {
      const omitted = omit === true ? ["bayer", "flamsteed"] : omit;
      for (const kind of omitted) {
        if (entry[kind] !== undefined) {
          throw new Error(`Override for HIP ${hip}: ${kind} is both given and omitted`);
        }
      }
    }
    if (omit === undefined && entry.bayer === undefined && entry.flamsteed === undefined) {
      throw new Error(`Override for HIP ${hip} changes nothing`);
    }
  }
}

/** The override for one star and kind in the shape `chooseDesignation` takes, or undefined. */
export function overrideFor(entry, kind) {
  if (entry === undefined) {
    return undefined;
  }
  if (entry.omit === true || (Array.isArray(entry.omit) && entry.omit.includes(kind))) {
    return { omit: true, source: entry.source };
  }
  return entry[kind] === undefined ? undefined : { value: entry[kind], source: entry.source };
}

/** A fixed order for label candidates, so `omitted[].candidates` does not follow the SPARQL response's order. */
const byConAndValue = (a, b) => {
  const left = `${a.con} ${a.value}`;
  const right = `${b.con} ${b.value}`;
  return left < right ? -1 : left > right ? 1 : 0;
};

const BAYER_CATALOG_ID = "Q105616";
const FLAMSTEED_CATALOG_ID = "Q111116";

function bindingValue(binding, name) {
  const cell = binding[name];
  return cell === undefined ? undefined : String(cell.value);
}

/**
 * The whole transform from saved raw inputs to the two tables' text. Pure: positions and constellations come from the
 * Hipparcos rows (`rows`, V <= 7.5, J2000) through `constellationOf(raHours, decDeg)`, never from Wikidata.
 *
 * - `designationBindings`: the SPARQL bindings `{ hip: "HIP 5447", value: "β And", catalog: <entity URI> }`.
 * - `labelBindings`: `{ hip, label }`, Wikidata's English labels of the HIP items; used for a kind only where the
 *   item has no P528 value of that kind at all.
 * - `overrides`: the hand-edited file's content; `wgsnHtml`: the WGSN page; `inputs`: the meta's `sources`,
 *   `queries` and `fetchedAt`; `hipparcos`: the verified file's stats.
 * - `iauLimits`: optional `{ minRows, minWithHip }` for `parseIauTable` (tests use small tables).
 *
 * Returns `{ starsText, namesText, summary }`; the texts carry no clock and are identical for identical inputs.
 */
export function buildDesignationTables({
  rows,
  constellationOf,
  designationBindings,
  labelBindings,
  overrides,
  wgsnHtml,
  inputs,
  hipparcos,
  iauLimits,
}) {
  validateOverrides(overrides);
  const rowByHip = new Map(rows.map((row) => [row.hip, row]));
  for (const hip of Object.keys(overrides)) {
    if (!rowByHip.has(Number(hip))) {
      throw new Error(`Override for HIP ${hip}: no such star among the Hipparcos rows at V <= 7.5`);
    }
  }

  const raw = new Map();
  const slot = (hip) => {
    if (!raw.has(hip)) {
      raw.set(hip, { bayer: new Set(), flamsteed: new Set(), labelBayer: [], labelFlamsteed: [] });
    }
    return raw.get(hip);
  };
  let unreadable = 0;
  for (const binding of designationBindings) {
    const hipMatch = /^HIP (\d+)$/.exec(bindingValue(binding, "hip") ?? "");
    const value = bindingValue(binding, "value");
    const catalog = bindingValue(binding, "catalog") ?? "";
    if (hipMatch === null || value === undefined) {
      unreadable++;
      continue;
    }
    if (catalog.endsWith(`/${BAYER_CATALOG_ID}`)) {
      slot(Number(hipMatch[1])).bayer.add(value);
    } else if (catalog.endsWith(`/${FLAMSTEED_CATALOG_ID}`)) {
      slot(Number(hipMatch[1])).flamsteed.add(value);
    } else {
      unreadable++;
    }
  }
  for (const binding of labelBindings) {
    const hipMatch = /^HIP (\d+)$/.exec(bindingValue(binding, "hip") ?? "");
    const parsed = labelDesignation(bindingValue(binding, "label") ?? "");
    if (hipMatch === null || parsed === null) {
      continue;
    }
    const target = slot(Number(hipMatch[1]));
    (parsed.kind === "bayer" ? target.labelBayer : target.labelFlamsteed).push({
      value: parsed.value,
      con: parsed.con,
    });
  }

  const stars = [];
  const omitted = [];
  const overridden = [];
  const rejected = { "latin-letter": 0, component: 0, unrecognised: 0 };
  const counts = {
    hipparcosStars: rows.length,
    wikidataHipsWithP528Designation: [...raw.values()].filter((r) => r.bayer.size > 0 || r.flamsteed.size > 0).length,
    fromLabelFallback: { bayer: 0, flamsteed: 0 },
    unreadableBindings: unreadable,
  };
  const sortedRows = [...rows].sort((a, b) => a.hip - b.hip);
  for (const row of sortedRows) {
    const con = constellationOf(row.raDeg / 15, row.decDeg);
    const entry = overrides[String(row.hip)];
    const sources = raw.get(row.hip) ?? { bayer: new Set(), flamsteed: new Set(), labelBayer: [], labelFlamsteed: [] };

    const bayerCandidates = [];
    for (const value of [...sources.bayer].sort()) {
      const result = classifyBayer(value);
      if (result.ok) {
        bayerCandidates.push({ value: result.bayer, con: result.con });
      } else {
        rejected[result.reason]++;
      }
    }
    let usedLabel = false;
    if (sources.bayer.size === 0 && sources.labelBayer.length > 0) {
      bayerCandidates.push(...[...sources.labelBayer].sort(byConAndValue));
      usedLabel = true;
    }
    const flamsteedCandidates = [];
    for (const value of [...sources.flamsteed].sort()) {
      const result = flamsteedNumber(value);
      if (result === null) {
        rejected.unrecognised++;
      } else {
        flamsteedCandidates.push({ value: result.number, con: result.con });
      }
    }
    let usedFlamsteedLabel = false;
    if (sources.flamsteed.size === 0 && sources.labelFlamsteed.length > 0) {
      flamsteedCandidates.push(...[...sources.labelFlamsteed].sort(byConAndValue));
      usedFlamsteedLabel = true;
    }

    const bayer = chooseDesignation(bayerCandidates, con, overrideFor(entry, "bayer"));
    const flamsteed = chooseDesignation(flamsteedCandidates, con, overrideFor(entry, "flamsteed"));
    for (const [kind, choice, usedFallback] of [
      ["bayer", bayer, usedLabel],
      ["flamsteed", flamsteed, usedFlamsteedLabel],
    ]) {
      if (choice.value !== null && usedFallback && choice.decision === "clear") {
        counts.fromLabelFallback[kind]++;
      }
      if (choice.decision === "ambiguous" || choice.decision === "wrong-constellation") {
        omitted.push({ hip: row.hip, kind, con, decision: choice.decision, candidates: choice.candidates });
      }
      if (choice.decision === "override" || choice.decision === "override-omit") {
        overridden.push({ hip: row.hip, kind, decision: choice.decision, value: choice.value, source: choice.source });
      }
    }
    if (bayer.value !== null || flamsteed.value !== null) {
      stars.push([row.hip, bayer.value, flamsteed.value]);
    }
  }

  const iauRows = parseIauTable(wgsnHtml, iauLimits);
  const { names, dropped } = namesByHip(iauRows);

  counts.designated = stars.length;
  counts.bayer = stars.filter((s) => s[1] !== null).length;
  counts.flamsteed = stars.filter((s) => s[2] !== null).length;
  counts.both = stars.filter((s) => s[1] !== null && s[2] !== null).length;
  counts.rejectedWikidataValues = rejected;
  counts.omittedByPolicy = omitted.length;
  counts.overrides = Object.keys(overrides).length;

  const nameCounts = {
    wgsnRows: iauRows.length,
    wgsnRowsWithHip: iauRows.filter((r) => r.hip !== null).length,
    hips: names.size,
    withinHipparcosVmag7_5: [...names.keys()].filter((hip) => rowByHip.has(hip)).length,
  };

  const starsMeta = {
    description:
      "Bayer and Flamsteed designations by Hipparcos number, for the stars of the finder file (Vmag <= 7.5). Generated by `npm run stars:designations` from the raw responses of the sources below; never edit by hand (scripts/data/star-designation-overrides.json is the hand-edited input).",
    sources: inputs.sources.filter((s) => s.kind === "designations"),
    hipparcos: { file: "I/239/hip_main.dat", sha256: hipparcos.sha256, bytes: hipparcos.bytes, rows: hipparcos.rows },
    queries: inputs.queries,
    fetchedAt: inputs.fetchedAt,
    counts,
    rules: [
      "Values are Greek-letter Bayer (three-letter abbreviation, superscript digits as -n) and Flamsteed numbers; Latin-letter and component-letter values are dropped.",
      "A value is kept only when its constellation suffix equals the constellation computed (astronomy-engine Constellation, J2000) from the star's own Hipparcos position; Wikidata's coordinates are never used.",
      "Several different values in the computed constellation, or none in it, mean the value is omitted rather than guessed, unless an entry in star-designation-overrides.json gives the value or omit: true with a citable source.",
      'English item labels ("Beta2 Capricorni", "30 Sagittarii") are read only for a kind the item has no catalogue-code value of at all, and go through the same rules.',
      "Each tuple is [bayer, flamsteed]; null means none. HYG is never read.",
    ],
    omitted,
    overridesApplied: overridden,
  };
  const namesMeta = {
    description:
      "IAU Working Group on Star Names proper names by Hipparcos number. Generated by `npm run stars:designations`; never edit by hand.",
    sources: inputs.sources.filter((s) => s.kind === "names"),
    fetchedAt: inputs.fetchedAt,
    counts: nameCounts,
    rules: [
      "Only the proper-name, HIP and Bayer ID columns of the WGSN table are read (the Bayer ID only to tell the two rows of HIP 72105 apart); the page's etymology texts and images are not copied.",
      "One name per HIP. HIP 72105 appears twice (Izar, epsilon Boo, and Pulcherrima, epsilon Boo B): the row without a component letter in its Bayer ID is kept, so it is named Izar, and the other is listed in `dropped`.",
      "Every name is used for one HIP only.",
    ],
    dropped,
  };

  return {
    starsText: serialiseTable(
      starsMeta,
      "stars",
      stars.map(([hip, bayer, flamsteed]) => [hip, [bayer, flamsteed]]),
    ),
    namesText: serialiseTable(namesMeta, "names", [...names]),
    summary: { counts, nameCounts, omitted, overridden, stars, names, dropped },
  };
}

/** `{ "meta": {...}, "<key>": { "<hip>": value, ... } }` with the meta indented and one entry per line, keys ascending. */
export function serialiseTable(meta, key, entries) {
  const sorted = [...entries].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i][0] === sorted[i - 1][0]) {
      throw new Error(`Duplicate HIP ${sorted[i][0]} in the ${key} table`);
    }
  }
  const metaText = JSON.stringify(meta, null, 2)
    .split("\n")
    .map((line, i) => (i === 0 ? line : `  ${line}`))
    .join("\n");
  const lines = sorted.map(
    ([hip, value], i) => `    "${hip}": ${JSON.stringify(value)}${i === sorted.length - 1 ? "" : ","}`,
  );
  return `{\n  "meta": ${metaText},\n  "${key}": {\n${lines.join("\n")}\n  }\n}\n`;
}
