import { describe, expect, it } from "vitest";

import { edges, scrollLeftFor } from "./subnav";

// A phone row: 390 px wide, 700 px of chips (the padding included).
const ROW = { width: 390, scrollWidth: 700 };

describe("scrollLeftFor", () => {
  it("centres a chip in the middle of the row", () => {
    // The chip's centre (300 + 40) lands on the row's centre (195).
    expect(scrollLeftFor({ left: 300, width: 80 }, ROW)).toBe(145);
  });

  it("stays at the start for a chip that is already in view near the start", () => {
    expect(scrollLeftFor({ left: 16, width: 80 }, ROW)).toBe(0);
  });

  it("stops at the end of the scroll range for the last chip", () => {
    expect(scrollLeftFor({ left: 610, width: 74 }, ROW)).toBe(ROW.scrollWidth - ROW.width);
  });

  it("never scrolls a row whose chips all fit", () => {
    expect(scrollLeftFor({ left: 500, width: 80 }, { width: 768, scrollWidth: 620 })).toBe(0);
  });

  it("returns a whole pixel", () => {
    expect(Number.isInteger(scrollLeftFor({ left: 300.4, width: 79.3 }, ROW))).toBe(true);
  });
});

describe("edges", () => {
  it("has more only at the end at the start of the range", () => {
    expect(edges(0, ROW.width, ROW.scrollWidth)).toEqual({ start: false, end: true });
  });

  it("has more on both sides in the middle", () => {
    expect(edges(150, ROW.width, ROW.scrollWidth)).toEqual({ start: true, end: true });
  });

  it("has more only at the start at the end of the range", () => {
    expect(edges(ROW.scrollWidth - ROW.width, ROW.width, ROW.scrollWidth)).toEqual({ start: true, end: false });
  });

  it("allows 1 px either way for fractional widths", () => {
    expect(edges(1, ROW.width, ROW.scrollWidth)).toEqual({ start: false, end: true });
    expect(edges(ROW.scrollWidth - ROW.width - 0.5, ROW.width, ROW.scrollWidth)).toEqual({ start: true, end: false });
  });

  it("has nothing beyond either edge when the chips fit", () => {
    expect(edges(0, 768, 620)).toEqual({ start: false, end: false });
  });
});
