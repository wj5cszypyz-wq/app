import { beforeAll, describe, expect, it } from "vitest";
import "../helpers/request";
import { db } from "../../lib/db";
import { parseProductInput } from "../../lib/product-input";
import type { StoreCtx } from "../../lib/scope";
import { makeStore, type StoreFixture } from "../helpers/fixtures";

let a: StoreFixture;
let b: StoreFixture;
let ownerA: StoreCtx;
let ownerB: StoreCtx;

const lamp = {
  sku: "fl-900", name: "Arc Floor Lamp", description: "Brushed brass", category: "Floor lamps", categoryEmoji: "💡",
  unitKind: "count", unit: "each", packCount: null, packAmount: null, packUnit: null, byWeight: false, price: "180",
};

beforeAll(async () => {
  a = await makeStore("cat-a");
  b = await makeStore("cat-b");
  const c = (f: StoreFixture): StoreCtx => ({ userId: f.owner.id, storeId: f.store.id, slug: f.store.slug, storeName: f.store.name, role: "owner", customerId: null });
  ownerA = c(a);
  ownerB = c(b);
});

describe("product input", () => {
  it("accepts any niche with a matching unit", () => {
    const r = parseProductInput(lamp, false);
    expect(r).toMatchObject({ sku: "FL-900", unit: "each", unitKind: "count", priceCents: 18000, category: "Floor lamps" });
  });

  it("rejects a unit that doesn't belong to the kind", () => {
    expect(parseProductInput({ ...lamp, unit: "gallon" }, false)).toEqual({ error: "Pick a unit that fits this kind of item." });
    expect(parseProductInput({ ...lamp, unitKind: "potions" }, false)).toEqual({ error: "Pick what kind of item this is." });
  });

  it("builds pack text from pack contents", () => {
    const r = parseProductInput({ ...lamp, unitKind: "packed", unit: "case", packCount: 24, packAmount: 12, packUnit: "fl oz" }, false);
    expect(r).toMatchObject({ packSize: "24 × 12 fl oz" });
  });
});

describe("categories", () => {
  it("are created on save and kept per store", async () => {
    const { createProduct } = await import("../../lib/data/products");
    const { listCategories } = await import("../../lib/data/categories");
    await createProduct(ownerA, parseProductInput(lamp, false) as never);
    expect((await listCategories(ownerA)).map((c) => [c.name, c.emoji])).toContainEqual(["Floor lamps", "💡"]);
    expect((await listCategories(ownerB)).some((c) => c.name === "Floor lamps")).toBe(false);
  });

  it("edit changes fields, recomputes pack text, and refuses other stores' products", async () => {
    const { updateProduct } = await import("../../lib/data/products");
    const p = await db.product.findFirstOrThrow({ where: { storeId: a.store.id, sku: "FL-900" } });
    const patch = parseProductInput({ unitKind: "packed", unit: "case", packCount: 2, packAmount: null, packUnit: null }, true);
    expect(await updateProduct(ownerA, p.id, patch as never)).not.toBeNull();
    const after = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after).toMatchObject({ unit: "case", unitKind: "packed", packSize: "2 ct", name: "Arc Floor Lamp" });
    expect(await updateProduct(ownerB, p.id, { name: "Hijacked" } as never)).toBeNull();
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).name).toBe("Arc Floor Lamp");
  });

  it("an edit whose unit doesn't fit the kept kind is refused", async () => {
    const { updateProduct } = await import("../../lib/data/products");
    const p = await db.product.findFirstOrThrow({ where: { storeId: a.store.id, sku: "FL-900" } });
    await expect(updateProduct(ownerA, p.id, { unit: "gallon" } as never)).rejects.toThrow("Pick a unit that fits this kind of item.");
  });
});
