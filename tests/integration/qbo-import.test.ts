import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "../helpers/request";
import { db } from "../../lib/db";
import type { StoreCtx } from "../../lib/scope";
import { connectStore, installFakeQbo, type FakeQbo } from "../helpers/fake-qbo";
import { makeStore, type StoreFixture } from "../helpers/fixtures";

let fake: FakeQbo;
let a: StoreFixture;
let b: StoreFixture;
let ownerA: StoreCtx;
let ownerB: StoreCtx;

beforeAll(async () => {
  Object.assign(process.env, { QBO_CLIENT_ID: "id", QBO_CLIENT_SECRET: "secret", QBO_REDIRECT_URI: "http://localhost:3000/api/qbo/callback" });
  fake = installFakeQbo();
  a = await makeStore("imp-a");
  b = await makeStore("imp-b");
  await connectStore(a.store.id, fake);
  const c = (f: StoreFixture): StoreCtx => ({ userId: f.owner.id, storeId: f.store.id, slug: f.store.slug, storeName: f.store.name, role: "owner", customerId: null });
  ownerA = c(a);
  ownerB = c(b);
  fake.items.push(
    { Id: "201", Name: "Floor Lamps:Arc Lamp", FullyQualifiedName: "Floor Lamps:Arc Lamp", Sku: "ARC-1", UnitPrice: 180, Type: "NonInventory", Active: true },
    { Id: "202", Name: "Linen Shade", FullyQualifiedName: "Linen Shade", Sku: "SKU-imp-a", UnitPrice: 34, Type: "Inventory", QtyOnHand: 12, Active: true },
    { Id: "203", Name: "Delivery fee", FullyQualifiedName: "Delivery fee", UnitPrice: 15, Type: "Service", Active: true },
    { Id: "204", Name: "Lamp bundle", Type: "Group", Active: true },
  );
  fake.customers.push(
    { Id: "301", DisplayName: "Hotel Marlow", GivenName: "Jon", FamilyName: "Avery", PrimaryEmailAddr: { Address: "Jon@Marlow.test" }, Active: true },
    { Id: "302", DisplayName: a.customerA.name, Active: true },
  );
});
afterAll(() => {
  fake.restore();
  Object.assign(process.env, { QBO_CLIENT_ID: "", QBO_CLIENT_SECRET: "", QBO_REDIRECT_URI: "" });
});

describe("importing items", () => {
  it("preview shows new items, SKU matches and skips bundles", async () => {
    const { previewImport } = await import("../../lib/data/qbo-import");
    const rows = await previewImport(ownerA, "items");
    const byId = Object.fromEntries(rows.map((r) => [r.qboId, r.status]));
    expect(byId).toMatchObject({ "201": "new", "202": "match", "203": "new" });
    expect(byId["204"]).toBeUndefined();
  });

  it("imports selected items, links the SKU match instead of duplicating", async () => {
    const { importFromQbo } = await import("../../lib/data/qbo-import");
    const r = await importFromQbo(ownerA, "items", ["201", "202"]);
    expect(r).toMatchObject({ created: 1, linked: 1 });
    const arc = await db.product.findFirstOrThrow({ where: { storeId: a.store.id, qboItemId: "201" } });
    expect(arc).toMatchObject({ name: "Arc Lamp", category: "Floor Lamps", sku: "ARC-1", priceCents: 18000 });
    expect((await db.product.findUniqueOrThrow({ where: { id: a.product.id } })).qboItemId).toBe("202");
    expect(await db.product.count({ where: { storeId: a.store.id, sku: { startsWith: "SKU-IMP-A" } } })).toBe(1);
  });

  it("re-import: running it again updates, never duplicates", async () => {
    const { importFromQbo } = await import("../../lib/data/qbo-import");
    fake.items.find((i) => i.Id === "201")!.UnitPrice = 199;
    const before = await db.product.count({ where: { storeId: a.store.id } });
    await importFromQbo(ownerA, "items", ["201", "202"]);
    expect(await db.product.count({ where: { storeId: a.store.id } })).toBe(before);
    expect((await db.product.findFirstOrThrow({ where: { storeId: a.store.id, qboItemId: "201" } })).priceCents).toBe(19900);
  });

  it("undo keeps ordered products: archived, not deleted; untouched ones removed; links undone", async () => {
    const { importFromQbo, undoImport } = await import("../../lib/data/qbo-import");
    const r = await importFromQbo(ownerA, "items", ["203"]);
    const fee = await db.product.findFirstOrThrow({ where: { storeId: a.store.id, qboItemId: "203" } });
    await db.order.create({
      data: { storeId: a.store.id, customerId: a.customerA.id, number: 4001, subtotalCents: 1500, lines: { create: [{ productId: fee.id, name: fee.name, sku: fee.sku, unit: "each", qty: 1, unitPriceCents: 1500, lineTotalCents: 1500 }] } },
    });
    expect(await undoImport(ownerA, r.batchId)).toMatchObject({ archived: 1, removed: 0 });
    expect((await db.product.findUniqueOrThrow({ where: { id: fee.id } })).active).toBe(false);
    expect(await undoImport(ownerA, r.batchId)).toBeNull();
  });

  it("another store can't undo this store's import", async () => {
    const { importFromQbo, undoImport } = await import("../../lib/data/qbo-import");
    fake.items.push({ Id: "205", Name: "Brass Desk Lamp", Sku: "BDL-1", UnitPrice: 95, Type: "NonInventory", Active: true });
    const r = await importFromQbo(ownerA, "items", ["205"]);
    expect(await undoImport(ownerB, r.batchId)).toBeNull();
    expect(await db.product.count({ where: { storeId: a.store.id, qboItemId: "205" } })).toBe(1);
  });
});

describe("importing customers", () => {
  it("creates new customers keyed by their QuickBooks id and links same-name ones", async () => {
    const { previewImport, importFromQbo } = await import("../../lib/data/qbo-import");
    const rows = await previewImport(ownerA, "customers");
    expect(Object.fromEntries(rows.map((r) => [r.qboId, r.status]))).toMatchObject({ "301": "new", "302": "match" });
    const r = await importFromQbo(ownerA, "customers", ["301", "302"]);
    expect(r).toMatchObject({ created: 1, linked: 1 });
    expect(await db.customer.findFirstOrThrow({ where: { storeId: a.store.id, qboCustomerId: "301" } })).toMatchObject({ name: "Hotel Marlow", contactName: "Jon Avery", email: "jon@marlow.test" });
    await importFromQbo(ownerA, "customers", ["301"]);
    expect(await db.customer.count({ where: { storeId: a.store.id, qboCustomerId: "301" } })).toBe(1);
  });

  it("a store that isn't connected gets a clear message", async () => {
    const { previewImport } = await import("../../lib/data/qbo-import");
    await expect(previewImport(ownerB, "items")).rejects.toThrow(/Connect QuickBooks/);
  });
});
