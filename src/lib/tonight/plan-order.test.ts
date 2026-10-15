import { describe, expect, it } from "vitest";

import { orderHints } from "./plan-order";

const row = (bestAt: number, windowEnd: number) => ({ bestAt, windowEnd });

describe("orderHints", () => {
  it("is empty for no rows and never flags the first row", () => {
    expect(orderHints([])).toEqual([]);
    expect(orderHints([row(100, 50)])).toEqual([false]);
  });

  it("flags a row whose window ends before the previous row's best time", () => {
    expect(orderHints([row(300, 400), row(100, 299), row(150, 200)])).toEqual([false, true, false]);
  });

  it("does not flag a window that ends exactly at the previous best time, or later", () => {
    expect(orderHints([row(300, 400), row(100, 300)])).toEqual([false, false]);
    expect(orderHints([row(300, 400), row(100, 301)])).toEqual([false, false]);
  });

  it("compares with the previous row in the list, not the earliest or the latest", () => {
    // The third row ends before the first row's best time (500) but not before the second's (300).
    expect(orderHints([row(500, 600), row(300, 310), row(200, 450)])).toEqual([false, true, false]);
  });

  it("flags nothing in an order by best time", () => {
    const rows = [row(100, 200), row(150, 300), row(150, 150), row(400, 450)];
    expect(orderHints(rows)).toEqual([false, false, false, false]);
  });
});
