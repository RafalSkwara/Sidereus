// Tests for the Hipparcos reader without the network: synthetic 450-character records built here (never copies of
// the catalogue), an injected fetch and a tiny pin. The real file is checked by `node scripts/hipparcos-source-check.mjs`.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  describeError,
  HIPPARCOS_FIELDS_USED,
  HIPPARCOS_PIN,
  parseRecord,
  parseSexagesimalDec,
  parseSexagesimalRa,
  propagateToJ2000,
  readHipparcos,
} from "./hipparcos.mjs";

// Where each field sits in a record (0-based start, width), from the CDS ReadMe's layout.
const LAYOUT = {
  hip: [2, 12],
  hms: [17, 11],
  dms: [29, 11],
  vmag: [41, 5],
  raDeg: [51, 12],
  decDeg: [64, 12],
  pmRa: [87, 8],
  pmDec: [96, 8],
};
const PIPES = [1, 14, 16, 28, 40, 46, 48, 50, 63, 76, 78, 86, 95, 104];

/** A 450-character record with the given text in the named fields; `extra` writes raw text at [start, text]. */
function record(fields = {}, extra = []) {
  const chars = Array.from({ length: 450 }, () => " ");
  chars[0] = "H";
  for (const position of PIPES) {
    chars[position] = "|";
  }
  for (const [key, text] of Object.entries(fields)) {
    const [start, width] = LAYOUT[key];
    const padded = text.padStart(width);
    expect(padded).toHaveLength(width);
    [...padded].forEach((ch, i) => (chars[start + i] = ch));
  }
  for (const [start, text] of extra) {
    [...text].forEach((ch, i) => (chars[start + i] = ch));
  }
  return chars.join("");
}

/** A star with a solution: numbers formatted the way the file writes them. */
function star({ hip, vmag, raDeg, decDeg, pmRa, pmDec }) {
  return record({
    hip: String(hip),
    vmag: vmag.toFixed(2),
    raDeg: raDeg.toFixed(8),
    decDeg: (decDeg < 0 ? "-" : "+") + Math.abs(decDeg).toFixed(8),
    pmRa: pmRa.toFixed(2),
    pmDec: pmDec.toFixed(2),
  });
}

/** Angular separation in arcseconds between two (RA, Dec) positions in degrees. */
function separationArcsec(a, b) {
  const unit = ({ raDeg, decDeg }) => {
    const ra = (raDeg * Math.PI) / 180;
    const dec = (decDeg * Math.PI) / 180;
    return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  };
  const [u, v] = [unit(a), unit(b)];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const cross = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
  return (Math.atan2(cross, dot) * 180 * 3600) / Math.PI;
}

describe("HIPPARCOS_PIN and HIPPARCOS_FIELDS_USED", () => {
  it("carries the verified pin", () => {
    expect(HIPPARCOS_PIN).toMatchObject({
      url: "https://cdsarc.cds.unistra.fr/ftp/cats/I/239/hip_main.dat",
      mirror: "https://vizier.cfa.harvard.edu/ftp/cats/I/239/hip_main.dat",
      sha256: "58ceabb104d647160d9437ce6e513a02a036bb4ad9f8879a5a22fd52943616e0",
      bytes: 53316318,
      rows: 118218,
      recordLength: 450,
    });
    expect(HIPPARCOS_PIN.bytes).toBe(HIPPARCOS_PIN.rows * (HIPPARCOS_PIN.recordLength + 1));
  });

  it("lists exactly the fields the licence request names, with their split indices", () => {
    expect(HIPPARCOS_FIELDS_USED.map((f) => [f.name, f.index])).toEqual([
      ["HIP", 1],
      ["Vmag", 5],
      ["RAdeg", 8],
      ["DEdeg", 9],
      ["pmRA", 12],
      ["pmDE", 13],
      ["RAhms", 3],
      ["DEdms", 4],
    ]);
  });

  it("reads no field outside that table: garbage in every other field changes nothing", () => {
    const fields = {
      hip: "42",
      vmag: "5.50",
      raDeg: "010.50000000",
      decDeg: "+20.25000000",
      pmRa: "100.00",
      pmDec: "-50.00",
    };
    const clean = parseRecord(record(fields), 1);
    // Fields 2, 6, 7, 10 and 11 (the flags, the Hpmag-like columns) and the tail of the record.
    const noisy = record(fields, [
      [15, "Z"],
      [47, "Z"],
      [49, "Z"],
      [77, "Z"],
      [79, "ZZZZZZZ"],
      [120, "ZZZZ|ZZ 9.99 |"],
      [300, "garbage -1e9 NaN"],
    ]);
    expect(parseRecord(noisy, 1)).toEqual(clean);
    expect(clean).toEqual({
      hip: 42,
      vmag: 5.5,
      raDeg: 10.5,
      decDeg: 20.25,
      pmRa: 100,
      pmDec: -50,
      fromSexagesimal: false,
    });
  });
});

describe("parseRecord", () => {
  const solved = {
    hip: "7",
    vmag: "4.40",
    raDeg: "100.00000000",
    decDeg: "-45.00000000",
    pmRa: "10.00",
    pmDec: "-20.00",
  };

  it("parses a negative declination and keeps the magnitude as written", () => {
    expect(parseRecord(record(solved), 1)).toMatchObject({
      hip: 7,
      vmag: 4.4,
      raDeg: 100,
      decDeg: -45,
      pmRa: 10,
      pmDec: -20,
    });
  });

  it("positions a star without RAdeg/DEdeg from RAhms/DEdms, unpropagated and flagged", () => {
    const row = parseRecord(record({ hip: "55203", vmag: "3.79", hms: "11 18 11.24", dms: "+31 31 50.8" }), 5);
    expect(row.fromSexagesimal).toBe(true);
    expect(row.hip).toBe(55203);
    expect(row.raDeg).toBeCloseTo((11 + 18 / 60 + 11.24 / 3600) * 15, 9);
    expect(row.decDeg).toBeCloseTo(31 + 31 / 60 + 50.8 / 3600, 9);
    expect(row.pmRa).toBeNull();
    expect(row.pmDec).toBeNull();
    // Nothing moves it: no proper motion exists to propagate with.
    expect(propagateToJ2000(row)).toBe(row);
  });

  it("gives the sign of DEdms to the whole value, including a degree field of zero", () => {
    expect(parseSexagesimalDec("-00 30 00.0", 1)).toBe(-0.5);
    expect(parseSexagesimalDec("+00 30 00.0", 1)).toBe(0.5);
    expect(parseSexagesimalDec("-60 55 29.0", 1)).toBeCloseTo(-(60 + 55 / 60 + 29 / 3600), 9);
    const row = parseRecord(record({ hip: "9", vmag: "6.00", hms: "00 00 00.00", dms: "-00 30 00.0" }), 1);
    expect(row.raDeg).toBe(0);
    expect(row.decDeg).toBe(-0.5);
  });

  it("rejects a malformed or out-of-range sexagesimal field with the line number", () => {
    expect(() => parseSexagesimalRa("11 18 11.2", 12)).toThrow(/Line 12: RAhms/);
    expect(() => parseSexagesimalRa("24 00 00.00", 12)).toThrow(/Line 12: RAhms .* out of range/);
    expect(() => parseSexagesimalRa("11 60 00.00", 12)).toThrow(/out of range/);
    expect(() => parseSexagesimalDec("31 31 50.8", 13)).toThrow(/Line 13: DEdms/);
    expect(() => parseSexagesimalDec("+91 00 00.0", 13)).toThrow(/Line 13: DEdms .* out of range/);
    const bad = record({ hip: "55203", vmag: "3.79", hms: "11 18 11.2x", dms: "+31 31 50.8" });
    expect(() => parseRecord(bad, 77)).toThrow(/Line 77: RAhms/);
  });

  it("throws when a star within the cut has no position at all, but not for a faint one", () => {
    const blank = { hip: "31", vmag: "6.00" };
    expect(() => parseRecord(record(blank), 3)).toThrow(/Line 3: RAhms/);
    expect(parseRecord(record({ hip: "31", vmag: "9.50" }), 3)).toMatchObject({ hip: 31, vmag: 9.5, raDeg: null });
  });

  it("returns a row without Vmag as vmag null, so the reader can skip it", () => {
    const row = parseRecord(record({ hip: "120412", hms: "05 23 33.71", dms: "-60 55 29.0" }), 9);
    expect(row).toMatchObject({ hip: 120412, vmag: null, raDeg: null });
  });

  it("throws with the line number for a blank HIP, a malformed number, a half-blank position or a bad layout", () => {
    expect(() => parseRecord(record({ ...solved, hip: "" }), 4)).toThrow(/Line 4: HIP/);
    expect(() => parseRecord(record({ ...solved, raDeg: "10.5.2" }), 8)).toThrow(/Line 8: non-numeric RAdeg/);
    expect(() => parseRecord(record({ ...solved, pmRa: "n/a" }), 8)).toThrow(/Line 8: non-numeric pmRA/);
    expect(() => parseRecord(record({ ...solved, decDeg: "" }), 8)).toThrow(/Line 8: non-numeric DEdeg/);
    expect(() => parseRecord(record({ ...solved, raDeg: "360.00000000" }), 8)).toThrow(/Line 8: .* out of range/);
    expect(() => parseRecord(record(solved).slice(1), 6)).toThrow(/Line 6: 449 characters, expected 450/);
    expect(() => parseRecord(record(solved, [[46, "x"]]), 6)).toThrow(/Line 6: no "\|" at position 46/);
  });
});

describe("propagateToJ2000", () => {
  const base = { hip: 1, vmag: 5, fromSexagesimal: false, pmRa: 0, pmDec: 0 };

  it("moves a star by its proper motion over 8.75 years", () => {
    const row = { ...base, raDeg: 100, decDeg: 60, pmRa: 1000, pmDec: -500 };
    const moved = propagateToJ2000(row);
    // pmRA is mu_alpha * cos(dec): the right ascension step is divided by cos(60 deg) = 0.5.
    expect(moved.raDeg).toBeCloseTo(100 + (1000 * 8.75) / 0.5 / 3.6e6, 9);
    expect(moved.decDeg).toBeCloseTo(60 - (500 * 8.75) / 3.6e6, 9);
    // The arc on the sky is the vector length of the two motions over 8.75 years: hypot(1000, 500) mas/yr * 8.75 yr.
    expect(separationArcsec(row, moved)).toBeCloseTo((Math.hypot(1000, 500) * 8.75) / 1000, 3);
    expect(moved).toMatchObject({ hip: 1, vmag: 5, pmRa: 1000, pmDec: -500 });
  });

  it("wraps right ascension into [0, 360) in both directions", () => {
    const up = propagateToJ2000({ ...base, raDeg: 359.9999, decDeg: 0, pmRa: 1000 });
    expect(up.raDeg).toBeCloseTo(359.9999 + (1000 * 8.75) / 3.6e6 - 360, 9);
    expect(up.raDeg).toBeGreaterThanOrEqual(0);
    expect(up.raDeg).toBeLessThan(1);
    const down = propagateToJ2000({ ...base, raDeg: 0.0001, decDeg: 0, pmRa: -1000 });
    expect(down.raDeg).toBeCloseTo(0.0001 - (1000 * 8.75) / 3.6e6 + 360, 9);
    expect(down.raDeg).toBeLessThan(360);
    expect(propagateToJ2000({ ...base, raDeg: 12.5, decDeg: 10 }).raDeg).toBe(12.5);
  });

  it("does not blow up at a pole", () => {
    const north = propagateToJ2000({ ...base, raDeg: 10, decDeg: 89.99999999, pmRa: 100000, pmDec: 100000 });
    expect(Number.isFinite(north.raDeg)).toBe(true);
    expect(north.raDeg).toBe(10);
    expect(north.decDeg).toBe(90);
    const south = propagateToJ2000({ ...base, raDeg: 200, decDeg: -90, pmRa: -50000, pmDec: -50000 });
    expect(south).toMatchObject({ raDeg: 200, decDeg: -90 });
    // A star near, not at, a pole still gets the full shift (Polaris: cos(dec) = 0.013).
    const polaris = propagateToJ2000({ ...base, raDeg: 37.95, decDeg: 89.264, pmRa: 44.2, pmDec: -11.7 });
    expect(polaris.raDeg - 37.95).toBeCloseTo((44.2 * 8.75) / Math.cos((89.264 * Math.PI) / 180) / 3.6e6, 6);
    expect(polaris.raDeg - 37.95).toBeGreaterThan(0.005);
  });
});

describe("readHipparcos", () => {
  const PRIMARY = "https://primary.test/hip_main.dat";
  const MIRROR = "https://mirror.test/hip_main.dat";
  const BLANK_VMAG_HIP = 900;

  // File order is not HIP order, as in the real file: a faint star, the no-Vmag row, a star positioned from
  // sexagesimal fields, then a star with a solution.
  const lines = [
    star({ hip: 50, vmag: 8.0, raDeg: 5, decDeg: 5, pmRa: 0, pmDec: 0 }),
    record({ hip: String(BLANK_VMAG_HIP), hms: "05 23 33.71", dms: "-60 55 29.0" }),
    record({ hip: "70", vmag: "3.79", hms: "11 18 11.24", dms: "+31 31 50.8" }),
    star({ hip: 100, vmag: 6.5, raDeg: 100, decDeg: 60, pmRa: 1000, pmDec: -500 }),
  ];
  const text = lines.map((l) => l + "\n").join("");
  const bytes = Buffer.from(text, "latin1");

  const sha256Of = (buffer) => createHash("sha256").update(buffer).digest("hex");
  const pinFor = (buffer, overrides = {}) => ({
    ...HIPPARCOS_PIN,
    url: PRIMARY,
    mirror: MIRROR,
    sha256: sha256Of(buffer),
    bytes: buffer.length,
    rows: lines.length,
    blankVmagHips: [BLANK_VMAG_HIP],
    ...overrides,
  });
  const goodPin = pinFor(bytes);

  /** An injected fetch: `routes` maps a URL to a function making its Response; every call is recorded. */
  function fakeFetch(routes) {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      const route = routes[url];
      if (route === undefined) {
        throw new Error(`unexpected request for ${url}`);
      }
      return route(init);
    };
    return { fetchImpl, calls };
  }
  const serve =
    (buffer, headers = {}) =>
    () =>
      new Response(buffer, { status: 200, headers });

  it("verifies the pin, keeps stars to the cut sorted by HIP, propagates, and lists the row without Vmag", async () => {
    const { fetchImpl, calls } = fakeFetch({ [PRIMARY]: serve(bytes, { "content-length": String(bytes.length) }) });
    const result = await readHipparcos({ pin: goodPin, fetch: fetchImpl });

    expect(result.rows.map((r) => r.hip)).toEqual([70, 100]);
    expect(result.skipped).toEqual([{ hip: BLANK_VMAG_HIP, lineNo: 2 }]);
    expect(result.stats).toEqual({ url: PRIMARY, sha256: goodPin.sha256, bytes: bytes.length, rows: 4 });

    const [sexagesimal, solved] = result.rows;
    expect(sexagesimal.fromSexagesimal).toBe(true);
    expect(sexagesimal.raDeg).toBeCloseTo((11 + 18 / 60 + 11.24 / 3600) * 15, 9);
    expect(solved.fromSexagesimal).toBe(false);
    expect(solved.raDeg).toBeCloseTo(100 + (1000 * 8.75) / 0.5 / 3.6e6, 7);
    expect(solved.decDeg).toBeCloseTo(60 - (500 * 8.75) / 3.6e6, 7);

    // One request, for the raw bytes, with only the project URL as contact.
    expect(calls).toHaveLength(1);
    expect(calls[0].init.headers).toEqual({
      "Accept-Encoding": "identity",
      "User-Agent": "Sidereus (+https://github.com/RafalSkwara/Sidereus)",
    });
  });

  it("applies the cut to the magnitude it is given", async () => {
    const { fetchImpl } = fakeFetch({ [PRIMARY]: serve(bytes) });
    const result = await readHipparcos({ pin: goodPin, fetch: fetchImpl, maxVmag: 5 });
    expect(result.rows.map((r) => r.hip)).toEqual([70]);
  });

  it("refuses a file whose rows without Vmag are not the pinned ones", async () => {
    const { fetchImpl } = fakeFetch({ [PRIMARY]: serve(bytes) });
    await expect(readHipparcos({ pin: { ...goodPin, blankVmagHips: [] }, fetch: fetchImpl })).rejects.toThrow(
      /Rows without a Vmag: expected HIP none, got 900/,
    );
  });

  it("refuses to return anything unverified: flipped byte, wrong length, wrong row count, Content-Encoding, a stall, with the mirror as the one retry", async () => {
    // A flipped byte in a field nobody reads, so the record still parses and only the hash can tell.
    const flippedAt = lines[0].length + 1 + 300;
    const flipped = Buffer.from(text.slice(0, flippedAt) + "X" + text.slice(flippedAt + 1), "latin1");
    expect(flipped).toHaveLength(bytes.length);
    const provenance = { "last-modified": "Tue, 24 Jun 1997 23:25:15 GMT", etag: '"32d8ade-314b580f04cc0"' };
    const hang = (init) =>
      new Response(
        new ReadableStream({
          start(controller) {
            init.signal.addEventListener("abort", () => controller.error(init.signal.reason), { once: true });
          },
        }),
      );

    const bad = [
      {
        name: "flipped byte",
        pin: goodPin,
        respond: serve(flipped, provenance),
        message: new RegExp(
          `expected sha256 ${goodPin.sha256}, ${bytes.length} bytes, 4 rows; got sha256 ${sha256Of(flipped)}, ${bytes.length} bytes, 4 rows \\(Last-Modified Tue, 24 Jun 1997 23:25:15 GMT, ETag "32d8ade-314b580f04cc0"\\)`,
        ),
      },
      {
        name: "wrong Content-Length",
        pin: goodPin,
        respond: serve(bytes, { "content-length": String(bytes.length + 451) }),
        message: new RegExp(`declares Content-Length ${bytes.length + 451}, the pin is ${bytes.length} bytes`),
      },
      {
        name: "truncated body",
        pin: goodPin,
        respond: serve(bytes.subarray(0, bytes.length - 451)),
        message: /got sha256 [0-9a-f]{64}, \d+ bytes, 3 rows/,
      },
      {
        name: "wrong row count (bytes and hash right)",
        pin: pinFor(bytes, { rows: 5 }),
        respond: serve(bytes),
        message: /expected sha256 [0-9a-f]{64}, \d+ bytes, 5 rows; got sha256 [0-9a-f]{64}, \d+ bytes, 4 rows/,
      },
      {
        name: "Content-Encoding",
        pin: goodPin,
        respond: serve(bytes, { "content-encoding": "gzip" }),
        message: /answered with Content-Encoding "gzip"/,
      },
      {
        name: "stall",
        pin: goodPin,
        respond: hang,
        message: /stalled: no data for 25 ms/,
      },
      {
        name: "more bytes than the pin",
        pin: goodPin,
        respond: serve(Buffer.concat([bytes, Buffer.from(lines[0] + "\n", "latin1")])),
        message: new RegExp(`got sha256 \\(not computed\\), more than ${bytes.length} bytes`),
      },
      {
        name: "an HTML answer is a pin mismatch, not a parse error",
        pin: goodPin,
        respond: serve(Buffer.from("<html><body>503 Service Unavailable</body></html>\n", "latin1")),
        message: /expected sha256 [0-9a-f]{64}, \d+ bytes, 4 rows; got sha256 [0-9a-f]{64}, \d+ bytes, 1 rows/,
      },
      {
        name: "HTTP error",
        pin: goodPin,
        respond: () => new Response("missing", { status: 404, statusText: "Not Found" }),
        message: /404 Not Found/,
      },
    ];

    for (const { name, pin, respond, message } of bad) {
      // Both servers serve the bad answer: one request each, nothing returned, and the report names both reasons.
      const { fetchImpl, calls } = fakeFetch({ [PRIMARY]: respond, [MIRROR]: respond });
      const failure = await readHipparcos({ pin, fetch: fetchImpl, stallMs: 25 }).catch((error) => error);
      expect(failure, name).toBeInstanceOf(Error);
      expect(failure.message, name).toMatch(/failed on the pinned URL and the mirror/);
      expect(failure.message, name).toContain(PRIMARY);
      expect(failure.message, name).toContain(MIRROR);
      // Both failures travel as the cause, so neither reason is lost, and `describeError` prints both.
      expect(failure.cause, name).toBeInstanceOf(AggregateError);
      expect(failure.cause.errors, name).toHaveLength(2);
      for (const inner of failure.cause.errors) {
        expect(inner.message, name).toMatch(message);
      }
      expect(describeError(failure), name).toMatch(message);
      expect(
        calls.map((c) => c.url),
        name,
      ).toEqual([PRIMARY, MIRROR]);

      // The mirror is the retry: a bad primary and a good mirror verify, and the result says which one served it.
      const retry = fakeFetch({ [PRIMARY]: respond, [MIRROR]: serve(bytes) });
      const recovered = await readHipparcos({ pin, fetch: retry.fetchImpl, stallMs: 25 }).catch((error) => error);
      if (name === "wrong row count (bytes and hash right)") {
        // The same file on the mirror fails the same pin: the pin, not the server, is what is wrong.
        expect(recovered, name).toBeInstanceOf(Error);
      } else {
        expect(recovered.stats.url, name).toBe(MIRROR);
        expect(
          recovered.rows.map((r) => r.hip),
          name,
        ).toEqual([70, 100]);
      }
      expect(
        retry.calls.map((c) => c.url),
        name,
      ).toEqual([PRIMARY, MIRROR]);
    }

    // A good primary never touches the mirror.
    const clean = fakeFetch({ [PRIMARY]: serve(bytes), [MIRROR]: serve(flipped) });
    await readHipparcos({ pin: goodPin, fetch: clean.fetchImpl });
    expect(clean.calls.map((c) => c.url)).toEqual([PRIMARY]);
  });
  it("reports a record that does not parse only after the hash matches the pin, and aborts every download it started", async () => {
    const broken = Buffer.from(text.replace(lines[3], "garbage".padEnd(450, " ")), "latin1");
    const { fetchImpl, calls } = fakeFetch({ [PRIMARY]: serve(broken), [MIRROR]: serve(broken) });
    const failure = await readHipparcos({ pin: pinFor(broken), fetch: fetchImpl }).catch((error) => error);
    expect(failure).toBeInstanceOf(Error);
    const printed = describeError(failure);
    expect(printed).toMatch(/matches the pin but a record does not parse: Line 4/);
    expect(printed).toContain(PRIMARY);
    expect(printed).toContain(MIRROR);
    for (const call of calls) {
      expect(call.init.signal.aborted).toBe(true);
    }
  });
});
