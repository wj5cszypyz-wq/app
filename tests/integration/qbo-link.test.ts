import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "../helpers/request";
import { db } from "../../lib/db";
import { connectStore, installFakeQbo, type FakeQbo } from "../helpers/fake-qbo";
import { makeStore, type StoreFixture } from "../helpers/fixtures";

let fake: FakeQbo;
let a: StoreFixture;

beforeAll(async () => {
  Object.assign(process.env, { QBO_CLIENT_ID: "id", QBO_CLIENT_SECRET: "secret", QBO_REDIRECT_URI: "http://localhost:3000/api/qbo/callback" });
  fake = installFakeQbo();
  a = await makeStore("link-a");
  await connectStore(a.store.id, fake);
});
afterAll(() => {
  fake.restore();
  Object.assign(process.env, { QBO_CLIENT_ID: "", QBO_CLIENT_SECRET: "", QBO_REDIRECT_URI: "" });
});

async function newOrder(productId: string, qty: number, unitPriceCents: number, unit = "case", customerId = a.customerA.id) {
  const n = 2000 + Math.floor(Math.random() * 7000);
  const p = await db.product.findUniqueOrThrow({ where: { id: productId } });
  return db.order.create({
    data: {
      storeId: a.store.id, customerId, number: n, subtotalCents: Math.round(qty * unitPriceCents),
      lines: { create: [{ productId, name: p.name, sku: p.sku, unit, qty, unitPriceCents, lineTotalCents: Math.round(qty * unitPriceCents) }] },
    },
  });
}

describe("linking and units", () => {
  it("converts sold cases into the pounds QuickBooks counts in", async () => {
    const { syncOrderToQuickBooks } = await import("../../lib/sync");
    const p = await db.product.create({
      data: { storeId: a.store.id, sku: "CHK-40", name: "Chicken thighs", category: "Meat", unit: "case", unitKind: "packed", packSize: "40 lb", priceCents: 12000, qboUnitFactor: 40, qboUnitLabel: "lb" },
    });
    const order = await newOrder(p.id, 2, 12000);
    expect(await syncOrderToQuickBooks(order.id)).toMatchObject({ qboSyncStatus: "synced" });
    const inv = fake.invoices.at(-1) as unknown as { Line: { Amount: number; Description: string; SalesItemLineDetail: { Qty: number; UnitPrice: number } }[] };
    expect(inv.Line[0].SalesItemLineDetail).toMatchObject({ Qty: 80, UnitPrice: 3 });
    expect(inv.Line[0].Amount).toBe(240);
    expect(inv.Line[0].Description).toContain("2 case (80 lb)");
  });

  it("an inactive QuickBooks item with the same name gets a clear message, not a duplicate", async () => {
    const { syncOrderToQuickBooks } = await import("../../lib/sync");
    fake.items.push({ Id: "900", Name: "Old Lamp (OLD-1)", Type: "NonInventory", Active: false });
    const p = await db.product.create({ data: { storeId: a.store.id, sku: "OLD-1", name: "Old Lamp", category: "Lamps", unit: "each", priceCents: 500 } });
    const order = await newOrder(p.id, 1, 500, "each");
    const r = await syncOrderToQuickBooks(order.id);
    expect(r).toMatchObject({ qboSyncStatus: "failed" });
    expect(r?.qboError).toMatch(/inactive/i);
    expect(fake.items.filter((i) => i.Name === "Old Lamp (OLD-1)")).toHaveLength(1);
  });

  it("a vendor using the customer's name gets a clear message", async () => {
    const { syncOrderToQuickBooks } = await import("../../lib/sync");
    const c = await db.customer.create({ data: { storeId: a.store.id, name: "Acme Supply" } });
    fake.vendors.push({ Id: "700", DisplayName: "Acme Supply", Active: true });
    const order = await newOrder(a.product.id, 1, 1000, "each", c.id);
    const r = await syncOrderToQuickBooks(order.id);
    expect(r?.qboError).toMatch(/vendor/i);
    expect(fake.customers.some((x) => x.DisplayName === "Acme Supply")).toBe(false);
  });

  it("an existing active QuickBooks customer with the same name is linked, not duplicated", async () => {
    const { syncOrderToQuickBooks } = await import("../../lib/sync");
    fake.customers.push({ Id: "650", DisplayName: "Corner Deli", Active: true });
    const c = await db.customer.create({ data: { storeId: a.store.id, name: "Corner Deli" } });
    const order = await newOrder(a.product.id, 1, 1000, "each", c.id);
    expect(await syncOrderToQuickBooks(order.id)).toMatchObject({ qboSyncStatus: "synced" });
    expect(fake.customers.filter((x) => x.DisplayName === "Corner Deli")).toHaveLength(1);
    expect((await db.customer.findUniqueOrThrow({ where: { id: c.id } })).qboCustomerId).toBe("650");
  });
});
