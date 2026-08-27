import { describe, expect, it } from "vitest";

import { autoToBuyQuantity, shouldCreateAutoToBuyEntry } from "@/lib/inventory/auto-to-buy";

describe("shouldCreateAutoToBuyEntry", () => {
  it("returns false for LOW priority items", () => {
    expect(
      shouldCreateAutoToBuyEntry({ priority_tag: "LOW", quantity: 0, min_threshold: 5 })
    ).toBe(false);
  });

  it("returns true for MEDIUM priority at zero quantity", () => {
    expect(
      shouldCreateAutoToBuyEntry({ priority_tag: "MEDIUM", quantity: 0, min_threshold: 5 })
    ).toBe(true);
  });

  it("returns true for HIGH priority below min threshold", () => {
    expect(
      shouldCreateAutoToBuyEntry({ priority_tag: "HIGH", quantity: 2, min_threshold: 5 })
    ).toBe(true);
  });

  it("returns false when stock is above min threshold", () => {
    expect(
      shouldCreateAutoToBuyEntry({ priority_tag: "HIGH", quantity: 5, min_threshold: 3 })
    ).toBe(false);
  });
});

describe("autoToBuyQuantity", () => {
  it("requests enough quantity to reach the minimum threshold", () => {
    expect(autoToBuyQuantity({ quantity: 2, min_threshold: 5 })).toBe(3);
  });

  it("requests at least one unit when already at zero", () => {
    expect(autoToBuyQuantity({ quantity: 0, min_threshold: 0 })).toBe(1);
  });
});
