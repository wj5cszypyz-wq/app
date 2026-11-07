import { beforeAll, describe, expect, it } from "vitest";
import "../helpers/request";
import { db } from "../../lib/db";
import type { StoreCtx } from "../../lib/scope";
import { makeStore, type StoreFixture } from "../helpers/fixtures";

let a: StoreFixture;
let b: StoreFixture;
let ownerA: StoreCtx;
let staffA: StoreCtx;
let ownerB: StoreCtx;

beforeAll(async () => {
  a = await makeStore("hist-a");
  b = await makeStore("hist-b");
  const c = (f: StoreFixture, role: StoreCtx["role"], userId: string): StoreCtx => ({ userId, storeId: f.store.id, slug: f.store.slug, storeName: f.store.name, role, customerId: null });
  ownerA = c(a, "owner", a.owner.id);
  staffA = c(a, "staff", a.staff.id);
  ownerB = c(b, "owner", b.owner.id);
});

const price = async (id: string) => (await db.product.findUniqueOrThrow({ where: { id } })).priceCents;

describe("undo and redo", () => {
  it("a price change can be undone, and the undo redone", async () => {
    const { updateProduct } = await import("../../lib/data/products");
    const { undoChange } = await import("../../lib/data/history");
    const r = await updateProduct(ownerA, a.product.id, { priceCents: 1500 });
    expect(await price(a.product.id)).toBe(1500);
    const undo = await undoChange(staffA, r!.changeId);
    expect(undo).toMatchObject({ ok: true });
    expect(await price(a.product.id)).toBe(1000);
    const redo = await undoChange(staffA, (undo as { changeId: string }).changeId);
    expect(redo).toMatchObject({ ok: true });
    expect(await price(a.product.id)).toBe(1500);
  });

  it("the same change can't be undone twice", async () => {
    const { updateProduct } = await import("../../lib/data/products");
    const { undoChange } = await import("../../lib/data/history");
    const r = await updateProduct(ownerA, a.product.id, { inStock: false });
    expect((await undoChange(ownerA, r!.changeId))!.ok).toBe(true);
    expect(await undoChange(ownerA, r!.changeId)).toEqual({ ok: false, error: "That change was already undone." });
  });

  it("a change that was edited again later can't be undone over the newer edit", async () => {
    const { updateProduct } = await import("../../lib/data/products");
    const { undoChange } = await import("../../lib/data/history");
    const first = await updateProduct(ownerA, a.product.id, { priceCents: 2000 });
    await updateProduct(ownerA, a.product.id, { priceCents: 2100 });
    expect(await undoChange(ownerA, first!.changeId)).toEqual({ ok: false, error: "This was changed again after that. Undo the later change first." });
    expect(await price(a.product.id)).toBe(2100);
  });

  it("removing a product can be undone (restored)", async () => {
    const { createProduct, updateProduct } = await import("../../lib/data/products");
    const { undoChange } = await import("../../lib/data/history");
    const p = await createProduct(ownerA, { sku: "UNDO-1", name: "Undo Lamp", category: "Lamps", unitKind: "count", unit: "each", priceCents: 900 });
    const removed = await updateProduct(ownerA, p.id, { active: false });
    await undoChange(ownerA, removed!.changeId);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).active).toBe(true);
    // Undoing the "add" hides it again (never deletes: orders may point at it).
    const added = await db.changeLog.findFirstOrThrow({ where: { entityId: p.id, action: "create" } });
    expect((await undoChange(ownerA, added.id))!.ok).toBe(true);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).active).toBe(false);
  });

  it("special prices: undo puts the old prices back", async () => {
    const { setCustomerPrices } = await import("../../lib/data/customers");
    const { undoChange } = await import("../../lib/data/history");
    const r = await setCustomerPrices(ownerA, a.customerA.id, [{ productId: a.product.id, priceCents: 777 }], []);
    expect(await db.customerPrice.count({ where: { customerId: a.customerA.id } })).toBe(1);
    expect((await undoChange(ownerA, r!.changeId))!.ok).toBe(true);
    expect(await db.customerPrice.count({ where: { customerId: a.customerA.id } })).toBe(0);
  });

  it("store settings: only the owner can undo them", async () => {
    const { updateProfile } = await import("../../lib/data/store-profile");
    const { undoChange } = await import("../../lib/data/history");
    const r = await updateProfile(ownerA, { look: "classic" });
    expect(await undoChange(staffA, r.changeId)).toEqual({ ok: false, error: "Only the store owner can undo changes to store settings." });
    expect((await undoChange(ownerA, r.changeId))!.ok).toBe(true);
    expect((await db.store.findUniqueOrThrow({ where: { id: a.store.id } })).look).toBe("fresh");
  });

  it("another store can't see or undo this store's history", async () => {
    const { updateProduct } = await import("../../lib/data/products");
    const { undoChange, listHistory } = await import("../../lib/data/history");
    const r = await updateProduct(ownerA, a.product.id, { priceCents: 3333 });
    expect(await undoChange(ownerB, r!.changeId)).toBeNull();
    expect((await listHistory(ownerB)).some((h) => h.id === r!.changeId)).toBe(false);
    expect((await listHistory(ownerA))[0]).toMatchObject({ id: r!.changeId, summary: expect.stringContaining("price") });
  });
});
