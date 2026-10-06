import { describe, expect, it } from "vitest";
import { z } from "zod";
import { eyepieceInputSchema, telescopeInputSchema } from "../schemas";
import eyepieceData from "./eyepieces.json";
import { eyepieceFill, telescopeFill } from "./fill";
import telescopeData from "./telescopes.json";
import { EYEPIECE_DESIGNS, type EyepieceEntry, type TelescopeEntry } from "./types";

const httpsUrl = z.url({ protocol: /^https$/ });
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const name = z.string().min(1).max(60);

const telescopeSchema = z.strictObject({
  id: slug,
  brand: z.string().min(1),
  model: z.string().min(1),
  name,
  apertureMm: z.number(),
  focalLengthMm: z.number(),
  aliases: z.array(z.string().min(1)).optional(),
  bundledEyepieces: z.array(slug).optional(),
  discontinued: z.literal(true).optional(),
  source: httpsUrl,
});

const eyepieceSchema = z.strictObject({
  id: slug,
  brand: z.string().min(1),
  line: z.string().min(1),
  name,
  focalLengthMm: z.number(),
  afovDeg: z.number().int(),
  design: z.enum(EYEPIECE_DESIGNS).optional(),
  afovEstimated: z.literal(true).optional(),
  zoom: z.strictObject({ minMm: z.number(), maxMm: z.number() }).optional(),
  aliases: z.array(z.string().min(1)).optional(),
  discontinued: z.literal(true).optional(),
  source: httpsUrl,
});

const telescopes = z.array(telescopeSchema).parse(telescopeData) satisfies TelescopeEntry[];
const eyepieces = z.array(eyepieceSchema).parse(eyepieceData) satisfies EyepieceEntry[];

/** The README's typical AFOV for an eyepiece design whose real value is not published. */
const TYPICAL_AFOV = { plossl: 50, kellner: 45, huygens: 40 } as const;

function hasAtMostOneDecimal(value: number): boolean {
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
}

describe("gear catalogue data", () => {
  it("has the seed's size", () => {
    expect(telescopes.length).toBeGreaterThanOrEqual(20);
    expect(eyepieces.length).toBeGreaterThanOrEqual(19);
  });

  it("gives every entry a unique id, and a unique name within its file", () => {
    for (const entries of [telescopes, eyepieces]) {
      expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
      expect(new Set(entries.map((entry) => entry.name)).size).toBe(entries.length);
    }
  });

  it("starts every name with its brand", () => {
    for (const entry of [...telescopes, ...eyepieces]) {
      expect(entry.name.startsWith(entry.brand), entry.id).toBe(true);
    }
  });

  it("fills every telescope into something the telescope schema accepts", () => {
    for (const entry of telescopes) {
      expect(telescopeInputSchema.safeParse(telescopeFill(entry)).success, entry.id).toBe(true);
    }
  });

  it("fills every eyepiece into something the eyepiece schema accepts, keeping its AFOV", () => {
    for (const entry of eyepieces) {
      const parsed = eyepieceInputSchema.safeParse(eyepieceFill(entry));
      expect(parsed.success, entry.id).toBe(true);
      expect(parsed.data?.afovDeg, entry.id).toBe(entry.afovDeg);
    }
  });

  it("points every bundled eyepiece id at an eyepiece", () => {
    const ids = new Set(eyepieces.map((entry) => entry.id));
    for (const entry of telescopes) {
      for (const id of entry.bundledEyepieces ?? []) {
        expect(ids.has(id), `${entry.id} -> ${id}`).toBe(true);
      }
    }
  });

  it("keeps a zoom entry's focal length inside its own range", () => {
    for (const entry of eyepieces) {
      if (entry.zoom) {
        expect(entry.zoom.minMm, entry.id).toBeLessThan(entry.zoom.maxMm);
        expect(entry.focalLengthMm, entry.id).toBeGreaterThanOrEqual(entry.zoom.minMm);
        expect(entry.focalLengthMm, entry.id).toBeLessThanOrEqual(entry.zoom.maxMm);
      }
    }
  });

  it("keeps the focal ratio between f/3 and f/16", () => {
    for (const entry of telescopes) {
      const ratio = entry.focalLengthMm / entry.apertureMm;
      expect(ratio, entry.id).toBeGreaterThanOrEqual(3);
      expect(ratio, entry.id).toBeLessThanOrEqual(16);
    }
  });

  it("stores at most one decimal on every number", () => {
    const numbers = [
      ...telescopes.flatMap((entry) => [entry.apertureMm, entry.focalLengthMm]),
      ...eyepieces.flatMap((entry) => [
        entry.focalLengthMm,
        entry.afovDeg,
        ...(entry.zoom ? [entry.zoom.minMm, entry.zoom.maxMm] : []),
      ]),
    ];
    for (const value of numbers) {
      expect(hasAtMostOneDecimal(value), String(value)).toBe(true);
    }
  });

  it("estimates an AFOV only as the README's typical value for the design, or for a zoom click stop", () => {
    for (const entry of eyepieces) {
      if (!entry.afovEstimated) {
        continue;
      }
      if (entry.zoom) {
        continue;
      }
      const design = entry.design;
      expect(design && design in TYPICAL_AFOV, entry.id).toBe(true);
      if (design && design in TYPICAL_AFOV) {
        expect(entry.afovDeg, entry.id).toBe(TYPICAL_AFOV[design as keyof typeof TYPICAL_AFOV]);
      }
    }
  });

  it("matches exactly one telescope for 'heritage 130'", () => {
    const hits = telescopes.filter((entry) =>
      ["heritage", "130"].every((word) =>
        [entry.name, ...(entry.aliases ?? [])].join(" ").toLowerCase().replace(/[-/.]/g, " ").includes(word),
      ),
    );
    expect(hits.map((entry) => entry.id)).toEqual(["skywatcher-heritage-130p"]);
  });
});
