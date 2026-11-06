import { describe, expect, it } from "vitest";
import { isValidQty, nextStatus } from "../lib/catalog";
import { formatMoney, parseMoney } from "../lib/money";
import { buildLines, lineTotal, parseOrderInput, type PricedProduct } from "../lib/orders";

const TODAY = "2026-11-05";

const products = new Map<string, PricedProduct>([
  ["romaine", { id: "romaine", name: "Romaine Hearts", sku: "PR-101", unit: "case", packSize: "24 ct", priceCents: 3500, inStock: true }],
  ["chicken", { id: "chicken", name: "Chicken Thighs", sku: "MT-301", unit: "lb", packSize: null, priceCents: 315, inStock: true }],
  ["shrimp", { id: "shrimp", name: "Shrimp 16/20", sku: "SF-402", unit: "case", packSize: null, priceCents: 8200, inStock: false }],
]);

describe("parseOrderInput", () => {
  it("rejects an empty cart", () => {
    expect(parseOrderInput({ lines: [] }, TODAY)).toEqual({ error: "Your cart is empty." });
  });

  it("merges duplicate lines for the same product", () => {
    const r = parseOrderInput({ lines: [{ productId: "romaine", qty: 1 }, { productId: "romaine", qty: 2 }] }, TODAY);
    expect(r).toMatchObject({ lines: [{ productId: "romaine", qty: 3 }] });
  });

  it("rejects delivery dates in the past", () => {
    const r = parseOrderInput({ lines: [{ productId: "romaine", qty: 1 }], deliveryDate: "2026-11-04" }, TODAY);
    expect(r).toEqual({ error: "Delivery date can't be in the past." });
  });

  it("rejects malformed lines", () => {
    expect(parseOrderInput({ lines: [{ productId: "romaine", qty: "2" }] }, TODAY)).toEqual({ error: "Invalid line item." });
  });

  it("trims and caps notes", () => {
    const r = parseOrderInput({ lines: [{ productId: "romaine", qty: 1 }], notes: `  ${"x".repeat(2000)}  ` }, TODAY);
    expect("notes" in r && r.notes?.length).toBe(1000);
  });
});

describe("buildLines", () => {
  it("prices from the server catalog and totals in cents", () => {
    const r = buildLines([{ productId: "romaine", qty: 3 }, { productId: "chicken", qty: 12.35 }], products);
    if ("error" in r) throw new Error(r.error);
    expect(r.lines.map((l) => l.lineTotalCents)).toEqual([10500, 3890]); // 12.35 lb × $3.15 = $38.90 (rounded)
    expect(r.subtotalCents).toBe(14390);
  });

  it("blocks out-of-stock items", () => {
    expect(buildLines([{ productId: "shrimp", qty: 1 }], products)).toEqual({
      error: "Shrimp 16/20 is out of stock. Remove it to continue.",
    });
  });

  it("blocks unknown products", () => {
    expect("error" in buildLines([{ productId: "nope", qty: 1 }], products)).toBe(true);
  });

  it("rejects fractional cases", () => {
    expect(buildLines([{ productId: "romaine", qty: 1.5 }], products)).toEqual({ error: "Invalid quantity for Romaine Hearts." });
  });
});

describe("quantities and money", () => {
  it("allows hundredths of a pound but whole cases", () => {
    expect(isValidQty("lb", 2.25)).toBe(true);
    expect(isValidQty("lb", 2.255)).toBe(false);
    expect(isValidQty("case", 2)).toBe(true);
    expect(isValidQty("case", 0)).toBe(false);
  });

  it("rounds line totals to the cent", () => {
    expect(lineTotal(3, 333)).toBe(999);
    expect(lineTotal(0.33, 1000)).toBe(330);
  });

  it("parses and formats money", () => {
    expect(parseMoney("$1,234.56")).toBe(123456);
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("-1")).toBeNull();
    expect(formatMoney(123456)).toBe("$1,234.56");
  });

  it("walks the fulfillment pipeline", () => {
    expect(nextStatus("new")).toBe("packing");
    expect(nextStatus("ready")).toBe("delivered");
    expect(nextStatus("delivered")).toBeNull();
    expect(nextStatus("cancelled")).toBeNull();
  });
});
