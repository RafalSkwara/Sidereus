/**
 * Reader for the Hipparcos Catalogue, Version 1 (ESA 1997, VizieR I/239 `hip_main.dat`, CC BY-NC 3.0 IGO).
 *
 * The file is downloaded from a pinned URL (one retry on a mirror), its raw bytes are hashed while they stream, and
 * nothing is returned until the byte count, the row count and the SHA-256 all match the pin. The pin constants change
 * only by a deliberate edit; nothing here updates them. Nothing here reads the clock.
 *
 * Layout (CDS ReadMe, measured on the pinned file): 118,218 records of 450 characters plus LF, pipe-delimited at the
 * same positions in every record. Splitting a record on "|" gives the field indices in HIPPARCOS_FIELDS_USED. Rows are
 * in right ascension order, not HIP order, so the result is sorted by HIP explicitly.
 */
import { createHash } from "node:crypto";

/** The project URL as the contact, never a person's address. */
const USER_AGENT = "Sidereus (+https://github.com/RafalSkwara/Sidereus)";

/** Verified by two independent downloads (CDS and the Harvard VizieR mirror); the server copy dates from 1997. */
export const HIPPARCOS_PIN = Object.freeze({
  url: "https://cdsarc.cds.unistra.fr/ftp/cats/I/239/hip_main.dat",
  mirror: "https://vizier.cfa.harvard.edu/ftp/cats/I/239/hip_main.dat",
  sha256: "58ceabb104d647160d9437ce6e513a02a036bb4ad9f8879a5a22fd52943616e0",
  bytes: 53316318,
  rows: 118218,
  /** Characters per record, without the LF (451 bytes per line). */
  recordLength: 450,
  /** The rows without a Vmag: exactly one, which also has no astrometric solution. */
  blankVmagHips: Object.freeze([120412]),
});

/**
 * The only fields read from the file, by their index after `split("|")`. `parseRecord` reads through this table and
 * nothing else, so reading another field (Hpmag, B-V, ...) means changing this list and its test, which in turn is
 * what the licence request to ESA lists. RAhms and DEdms are read only for stars without RAdeg/DEdeg.
 */
export const HIPPARCOS_FIELDS_USED = Object.freeze([
  Object.freeze({ name: "HIP", index: 1 }),
  Object.freeze({ name: "Vmag", index: 5 }),
  Object.freeze({ name: "RAdeg", index: 8 }),
  Object.freeze({ name: "DEdeg", index: 9 }),
  Object.freeze({ name: "pmRA", index: 12 }),
  Object.freeze({ name: "pmDE", index: 13 }),
  Object.freeze({ name: "RAhms", index: 3, onlyWhen: "RAdeg and DEdeg are blank" }),
  Object.freeze({ name: "DEdms", index: 4, onlyWhen: "RAdeg and DEdeg are blank" }),
]);

/** Positions (0-based) of the pipes that close fields 0-13, the ones the fields above sit between. */
const RECORD_PIPES = Object.freeze([1, 14, 16, 28, 40, 46, 48, 50, 63, 76, 78, 86, 95, 104]);

/** The finder file's depth; stars fainter than this are not kept. */
const DEFAULT_MAX_VMAG = 7.5;
/** Epoch of the catalogue positions (J1991.25) to J2000.0, in Julian years. */
const EPOCH_YEARS = 8.75;
const MAS_PER_DEGREE = 3.6e6;
/** Below this cos(declination) (about 0.13 arcsecond from a pole) right ascension has no meaning to shift. */
const POLE_COS_EPSILON = 1e-6;
/** Abort a download that delivers no byte for this long. */
const DEFAULT_STALL_MS = 60_000;

function fieldValue(cells, name) {
  const field = HIPPARCOS_FIELDS_USED.find((f) => f.name === name);
  if (field === undefined) {
    throw new Error(`"${name}" is not in HIPPARCOS_FIELDS_USED`);
  }
  return cells[field.index];
}

function parseDecimal(text, name, lineNo) {
  const trimmed = text.trim();
  if (!/^[+-]?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Line ${lineNo}: non-numeric ${name} "${trimmed}"`);
  }
  return Number(trimmed);
}

/** Right ascension "hh mm ss.ss" (H3) to degrees. */
export function parseSexagesimalRa(text, lineNo) {
  const match = /^(\d{2}) (\d{2}) (\d{2}\.\d{2})$/.exec(text.trim());
  if (match === null) {
    throw new Error(`Line ${lineNo}: RAhms "${text.trim()}" is not "hh mm ss.ss"`);
  }
  const [hours, minutes, seconds] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (hours > 23 || minutes > 59 || seconds >= 60) {
    throw new Error(`Line ${lineNo}: RAhms "${text.trim()}" is out of range`);
  }
  return (hours + minutes / 60 + seconds / 3600) * 15;
}

/** Declination "±dd mm ss.s" (H4) to degrees; the sign applies to the whole value, so "-00 30 00.0" is -0.5. */
export function parseSexagesimalDec(text, lineNo) {
  const match = /^([+-])(\d{2}) (\d{2}) (\d{2}\.\d)$/.exec(text.trim());
  if (match === null) {
    throw new Error(`Line ${lineNo}: DEdms "${text.trim()}" is not "±dd mm ss.s"`);
  }
  const [degrees, minutes, seconds] = [Number(match[2]), Number(match[3]), Number(match[4])];
  const magnitude = degrees + minutes / 60 + seconds / 3600;
  if (minutes > 59 || seconds >= 60 || magnitude > 90) {
    throw new Error(`Line ${lineNo}: DEdms "${text.trim()}" is out of range`);
  }
  return match[1] === "-" ? -magnitude : magnitude;
}

/**
 * One record to a row `{ hip, vmag, raDeg, decDeg, pmRa, pmDec, fromSexagesimal }` (J1991.25, ICRS; proper motions in
 * mas/yr, pmRa already times cos(dec)). A blank Vmag gives `vmag: null` and no position. A star fainter than
 * `maxVmag` is not needed, so its position is not read (`raDeg`, `decDeg`, `pmRa`, `pmDec` null). A star at or below
 * it without RAdeg/DEdeg takes its position from RAhms/DEdms (no proper motion, `fromSexagesimal: true`), and throws
 * when those do not parse. Any other malformed field throws with the line number.
 */
export function parseRecord(line, lineNo, { maxVmag = DEFAULT_MAX_VMAG } = {}) {
  if (line.length !== HIPPARCOS_PIN.recordLength) {
    throw new Error(`Line ${lineNo}: ${line.length} characters, expected ${HIPPARCOS_PIN.recordLength}`);
  }
  for (const position of RECORD_PIPES) {
    if (line[position] !== "|") {
      throw new Error(`Line ${lineNo}: no "|" at position ${position}`);
    }
  }
  const cells = line.split("|");

  const hipText = fieldValue(cells, "HIP").trim();
  if (!/^\d+$/.test(hipText)) {
    throw new Error(`Line ${lineNo}: HIP "${hipText}" is not a positive integer`);
  }
  const hip = Number(hipText);

  const vmagText = fieldValue(cells, "Vmag");
  if (vmagText.trim() === "") {
    return { hip, vmag: null, raDeg: null, decDeg: null, pmRa: null, pmDec: null, fromSexagesimal: false };
  }
  const vmag = parseDecimal(vmagText, "Vmag", lineNo);
  if (vmag > maxVmag) {
    return { hip, vmag, raDeg: null, decDeg: null, pmRa: null, pmDec: null, fromSexagesimal: false };
  }

  const raText = fieldValue(cells, "RAdeg");
  const decText = fieldValue(cells, "DEdeg");
  if (raText.trim() === "" && decText.trim() === "") {
    const raDeg = parseSexagesimalRa(fieldValue(cells, "RAhms"), lineNo);
    const decDeg = parseSexagesimalDec(fieldValue(cells, "DEdms"), lineNo);
    return { hip, vmag, raDeg, decDeg, pmRa: null, pmDec: null, fromSexagesimal: true };
  }
  const raDeg = parseDecimal(raText, "RAdeg", lineNo);
  const decDeg = parseDecimal(decText, "DEdeg", lineNo);
  if (raDeg < 0 || raDeg >= 360 || decDeg < -90 || decDeg > 90) {
    throw new Error(`Line ${lineNo}: RAdeg ${raDeg} / DEdeg ${decDeg} out of range`);
  }
  const pmRa = parseDecimal(fieldValue(cells, "pmRA"), "pmRA", lineNo);
  const pmDec = parseDecimal(fieldValue(cells, "pmDE"), "pmDE", lineNo);
  return { hip, vmag, raDeg, decDeg, pmRa, pmDec, fromSexagesimal: false };
}

/**
 * The row with its position moved from J1991.25 to J2000.0 by linear proper motion:
 * `ra += pmRA * 8.75 / cos(dec) / 3.6e6`, `dec += pmDE * 8.75 / 3.6e6`, right ascension wrapped into [0, 360).
 * A star positioned from RAhms/DEdms has no proper motion and comes back unchanged. At a pole (cos(dec) under
 * 1e-6) right ascension is left alone and the declination is held within [-90, 90], so nothing blows up.
 */
export function propagateToJ2000(row) {
  if (row.fromSexagesimal) {
    return row;
  }
  const cosDec = Math.cos((row.decDeg * Math.PI) / 180);
  let raDeg = row.raDeg;
  if (cosDec >= POLE_COS_EPSILON) {
    raDeg += (row.pmRa * EPOCH_YEARS) / cosDec / MAS_PER_DEGREE;
    raDeg = ((raDeg % 360) + 360) % 360;
  }
  const decDeg = Math.min(90, Math.max(-90, row.decDeg + (row.pmDec * EPOCH_YEARS) / MAS_PER_DEGREE));
  return { ...row, raDeg, decDeg };
}

/**
 * An error and everything it carries, one line each: the message, the cause chain ("caused by: ...") and, for an
 * AggregateError, each of its errors with its own chain. Scripts print this instead of `error.message`, so a failure
 * is never reported as a bare "fetch failed".
 */
export function describeError(error, indent = "") {
  if (!(error instanceof Error)) {
    return `${indent}${String(error)}`;
  }
  const lines = [`${indent}${error.message}`];
  if (error instanceof AggregateError) {
    for (const inner of error.errors) {
      lines.push(describeError(inner, `${indent}  - `));
    }
  }
  if (error.cause !== undefined) {
    lines.push(describeError(error.cause, `${indent}  caused by: `));
  }
  return lines.join("\n");
}

function describeHeaders(res) {
  return `Last-Modified ${res.headers.get("last-modified") ?? "none"}, ETag ${res.headers.get("etag") ?? "none"}`;
}

function mismatchError(url, pin, actual, res) {
  return new Error(
    `Hipparcos pin mismatch for ${url}: expected sha256 ${pin.sha256}, ${pin.bytes} bytes, ${pin.rows} rows; ` +
      `got sha256 ${actual.sha256}, ${actual.bytes} bytes, ${actual.rows} rows (${describeHeaders(res)})`,
  );
}

/** One download of `url`, verified against the pin; throws on any failure and returns nothing unverified. */
async function downloadVerified(url, { pin, fetchImpl, maxVmag, stallMs }) {
  const controller = new AbortController();
  let stalled = false;
  let timer;
  const armStallTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      stalled = true;
      controller.abort();
    }, stallMs);
  };

  try {
    armStallTimer();
    const res = await fetchImpl(url, {
      headers: { "Accept-Encoding": "identity", "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok || res.body === null) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    const encoding = res.headers.get("content-encoding");
    if (encoding !== null) {
      await res.body.cancel();
      throw new Error(`${url} answered with Content-Encoding "${encoding}"; the pin is of the raw bytes`);
    }
    const declared = res.headers.get("content-length");
    if (declared !== null && Number(declared) !== pin.bytes) {
      await res.body.cancel();
      throw new Error(
        `${url} declares Content-Length ${declared}, the pin is ${pin.bytes} bytes (${describeHeaders(res)})`,
      );
    }

    const hash = createHash("sha256");
    const reader = res.body.getReader();
    const rows = [];
    const skipped = [];
    let bytes = 0;
    let lineNo = 0;
    let pending = "";
    // A record that does not parse is reported only after the hash: a corrupt or HTML answer is then reported as the
    // pin mismatch it is, with the file's size, hash and headers, not as "Line N: ...".
    let parseError = null;

    const handleLine = (line) => {
      lineNo++;
      if (parseError !== null) {
        return;
      }
      let row;
      try {
        row = parseRecord(line, lineNo, { maxVmag });
      } catch (error) {
        parseError = error;
        return;
      }
      if (row.vmag === null) {
        skipped.push({ hip: row.hip, lineNo });
      } else if (row.vmag <= maxVmag) {
        rows.push(row);
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      armStallTimer();
      bytes += value.byteLength;
      if (bytes > pin.bytes) {
        await reader.cancel();
        throw mismatchError(url, pin, { sha256: "(not computed)", bytes: `more than ${pin.bytes}`, rows: lineNo }, res);
      }
      hash.update(value);
      // The file is ASCII (451 bytes per 450-character record), so latin1 keeps characters and bytes one to one.
      pending += Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("latin1");
      let start = 0;
      for (let newline = pending.indexOf("\n", start); newline !== -1; newline = pending.indexOf("\n", start)) {
        handleLine(pending.slice(start, newline));
        start = newline + 1;
      }
      pending = pending.slice(start);
    }
    if (pending !== "") {
      handleLine(pending);
    }

    const actual = { sha256: hash.digest("hex"), bytes, rows: lineNo };
    if (actual.sha256 !== pin.sha256 || actual.bytes !== pin.bytes || actual.rows !== pin.rows) {
      throw mismatchError(url, pin, actual, res);
    }
    if (parseError !== null) {
      throw new Error(`${url} matches the pin but a record does not parse: ${parseError.message}`, {
        cause: parseError,
      });
    }
    return { rows, skipped, stats: { url: res.url || url, ...actual } };
  } catch (error) {
    if (stalled) {
      throw new Error(`Download from ${url} stalled: no data for ${stallMs} ms`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
    // Whatever threw, do not leave the socket open while the mirror is tried.
    controller.abort();
  }
}

/**
 * Downloads, verifies and parses `hip_main.dat`.
 *
 * Returns `{ rows, skipped, stats }`: `rows` are the stars with Vmag <= `maxVmag` (default 7.5), sorted by HIP, each
 * propagated to J2000 or, for a star without RAdeg/DEdeg, positioned from RAhms/DEdms and flagged `fromSexagesimal`;
 * `skipped` lists the rows without a Vmag (`{ hip, lineNo }`), which must be exactly the pin's `blankVmagHips`;
 * `stats` is `{ url, sha256, bytes, rows }` of the file that verified (`url` tells whether the mirror was used).
 *
 * The pinned URL is tried once and, on any failure, the mirror once; the hash alone decides acceptance. When both
 * fail the error's cause is an AggregateError of both failures (`describeError` prints each with its own causes).
 *
 * Options (for tests): `pin`, `fetch`, `maxVmag`, `stallMs`.
 */
export async function readHipparcos({
  pin = HIPPARCOS_PIN,
  fetch: fetchImpl = fetch,
  maxVmag = DEFAULT_MAX_VMAG,
  stallMs = DEFAULT_STALL_MS,
} = {}) {
  const context = { pin, fetchImpl, maxVmag, stallMs };
  let result;
  const failures = [];
  for (const url of [pin.url, pin.mirror]) {
    try {
      result = await downloadVerified(url, context);
      break;
    } catch (error) {
      failures.push(error);
    }
  }
  if (result === undefined) {
    throw new Error(`Hipparcos download failed on the pinned URL and the mirror (${pin.url}, ${pin.mirror})`, {
      cause: new AggregateError(failures, "the pinned URL and the mirror both failed"),
    });
  }

  const { rows, skipped, stats } = result;
  const skippedHips = skipped.map((s) => s.hip);
  if (skippedHips.join(",") !== pin.blankVmagHips.join(",")) {
    throw new Error(
      `Rows without a Vmag: expected HIP ${pin.blankVmagHips.join(", ") || "none"}, got ${skippedHips.join(", ") || "none"}`,
    );
  }
  rows.sort((a, b) => a.hip - b.hip);
  return { rows: rows.map(propagateToJ2000), skipped, stats };
}
