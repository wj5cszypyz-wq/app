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
  a = await makeStore("qbo-a");
  await connectStore(a.store.id, fake);
});

afterAll(() => {
  fake.restore();
  Object.assign(process.env, { QBO_CLIENT_ID: "", QBO_CLIENT_SECRET: "", QBO_REDIRECT_URI: "" });
});

const invoiceCalls = () => fake.count((c) => c.method === "POST" && c.path.startsWith("/v3/company/9130350000000001/invoice?"));

describe("sending an order to QuickBooks", () => {
  it("creates the customer, the item and one invoice", async () => {
    const { syncOrderToQuickBooks } = await import("../../lib/sync");
    const order = await syncOrderToQuickBooks(a.orderA.id);
    expect(order).toMatchObject({ qboSyncStatus: "synced", qboDocNumber: "ORD-1001" });
    expect(fake.customers.map((c) => c.DisplayName)).toEqual([a.customerA.name]);
    expect(fake.invoices).toHaveLength(1);
    expect(fake.invoices[0].TotalAmt).toBe(20);
  });

  it("concurrent sync: two Retry clicks at once make one invoice", async () => {
    const { syncOrderToQuickBooks } = await import("../../lib/sync");
    const before = invoiceCalls();
    await Promise.all([syncOrderToQuickBooks(a.orderB.id), syncOrderToQuickBooks(a.orderB.id), syncOrderToQuickBooks(a.orderB.id)]);
    expect(invoiceCalls() - before).toBe(1);
    expect(fake.invoices.filter((i) => i.DocNumber === "ORD-1002")).toHaveLength(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: a.orderB.id } })).qboSyncStatus).toBe("synced");
  });

  it("a QuickBooks failure is recorded, and Retry then succeeds without a duplicate", async () => {
    const { syncOrderToQuickBooks } = await import("../../lib/sync");
    const order = await db.order.create({
      data: { storeId: a.store.id, customerId: a.customerA.id, number: 1003, subtotalCents: 1000, lines: { create: [{ productId: a.product.id, name: "P", sku: a.product.sku, unit: "each", qty: 1, unitPriceCents: 1000, lineTotalCents: 1000 }] } },
    });
    fake.failNext(/\/invoice$/, { status: 503, code: "503", message: "Service unavailable" });
    expect(await syncOrderToQuickBooks(order.id)).toMatchObject({ qboSyncStatus: "failed", qboError: expect.stringContaining("Service unavailable") });
    expect(await syncOrderToQuickBooks(order.id)).toMatchObject({ qboSyncStatus: "synced" });
    expect(fake.invoices.filter((i) => i.DocNumber === "ORD-1003")).toHaveLength(1);
  });

  it("single refresh: an expired token is refreshed once even when two requests need it", async () => {
    const { listAllItems } = await import("../../lib/qbo");
    await connectStore(a.store.id, fake, { expired: true });
    const tokenCalls = () => fake.count((c) => c.path.includes("/oauth2/v1/tokens/bearer"));
    const before = tokenCalls();
    const store1 = await db.store.findUniqueOrThrow({ where: { id: a.store.id } });
    const store2 = await db.store.findUniqueOrThrow({ where: { id: a.store.id } });
    const [x, y] = await Promise.all([listAllItems(store1), listAllItems(store2)]);
    expect(tokenCalls() - before).toBe(1);
    expect(x.length).toBe(y.length);
  });
});
