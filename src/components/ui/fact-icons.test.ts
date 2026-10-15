import { Eclipse } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EVENT_KIND_ICONS, FACT_ICONS, FACT_KINDS, factIcon, type FactSubject } from "./fact-icons";

/*
 * The one icon resolver (ui-dashboard-tiles): `factIcon` decides every fact's icon, events included, so a rename or a
 * clash between the two vocabularies fails here and not on a page.
 */

const EVENT_KINDS = Object.keys(EVENT_KIND_ICONS) as (keyof typeof EVENT_KIND_ICONS)[];

describe("factIcon", () => {
  it.each(FACT_KINDS)("resolves the fact kind %s to its FACT_ICONS entry", (kind) => {
    expect(factIcon(kind)).toBe(FACT_ICONS[kind]);
  });

  it("covers the six sky-event kinds, each resolving to its EVENT_KIND_ICONS entry", () => {
    expect(EVENT_KINDS).toHaveLength(6);
    for (const kind of EVENT_KINDS) {
      expect(factIcon(kind), kind).toBe(EVENT_KIND_ICONS[kind]);
    }
  });

  it("keeps the solar eclipse's own Eclipse icon (owner decision D4)", () => {
    expect(factIcon("solar-eclipse")).toBe(Eclipse);
  });

  it("has two disjoint key sets, so a subject names exactly one vocabulary", () => {
    const subjects: FactSubject[] = [...FACT_KINDS, ...EVENT_KINDS];
    expect(new Set(subjects).size).toBe(FACT_KINDS.length + EVENT_KINDS.length);
    for (const kind of EVENT_KINDS) {
      expect(Object.hasOwn(FACT_ICONS, kind), kind).toBe(false);
    }
  });
});
