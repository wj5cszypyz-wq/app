import { describe, expect, it } from "vitest";
import { isValidQty } from "../lib/catalog";
import { allowsDecimal, kindOf, packLabel, priceLabel, UNIT_KINDS } from "../lib/units";

describe("unit kinds", () => {
  it("offers the right units for each kind of item", () => {
    expect(UNIT_KINDS.weight.units).toEqual(["oz", "lb", "g", "kg"]);
    expect(UNIT_KINDS.liquid.units).toEqual(["fl oz", "cup", "pint", "quart", "gallon", "mL", "L"]);
    expect(UNIT_KINDS.paper.units).toEqual(["sheet", "ream", "roll", "pack", "carton"]);
    expect(UNIT_KINDS.length.units).toEqual(["inch", "foot", "yard", "meter", "sq ft", "sq m"]);
    expect(UNIT_KINDS.count.units).toEqual(["each", "pair", "set", "dozen"]);
    expect(UNIT_KINDS.packed.units).toEqual(["case", "box", "bag", "bottle", "jar", "pallet"]);
    expect(kindOf("gallon")).toBe("liquid");
    expect(kindOf("nonsense")).toBeNull();
  });

  it("allows decimals only for measured units", () => {
    for (const u of ["lb", "kg", "gallon", "L", "yard", "sq ft"]) expect(allowsDecimal(u), u).toBe(true);
    for (const u of ["each", "case", "ream", "dozen", "box"]) expect(allowsDecimal(u), u).toBe(false);
    expect(isValidQty("lb", 2.5)).toBe(true);
    expect(isValidQty("each", 2.5)).toBe(false);
    expect(isValidQty("case", 3)).toBe(true);
    expect(isValidQty("gallon", 0.25)).toBe(true);
    expect(isValidQty("lb", 2.555)).toBe(false);
  });
});

describe("labels", () => {
  it("describes pack contents", () => {
    expect(packLabel({ count: 24, amount: 12, unit: "fl oz" })).toBe("24 × 12 fl oz");
    expect(packLabel({ count: null, amount: 40, unit: "lb" })).toBe("40 lb");
    expect(packLabel({ count: 1, amount: 500, unit: "sheet" })).toBe("500 sheets");
    expect(packLabel({ count: 6, amount: null, unit: null })).toBe("6 ct");
    expect(packLabel({ count: null, amount: null, unit: null })).toBeNull();
  });

  it("shows price with its unit and pack", () => {
    expect(priceLabel(4200, "case", "24 × 12 fl oz")).toBe("$42.00 per case of 24 × 12 fl oz");
    expect(priceLabel(320, "lb", null)).toBe("$3.20 per lb");
    expect(priceLabel(18000, "each", null)).toBe("$180.00 each");
  });
});
