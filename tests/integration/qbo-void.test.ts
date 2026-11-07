import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "../helpers/request";
import { db } from "../../lib/db";
import type { StoreCtx } from "../../lib/scope";
import { connectStore, installFakeQbo, type FakeQbo } from "../helpers/fake-qbo";
import { makeStore, type StoreFixture } from "../helpers/fixtures";

let fake: FakeQbo;
let a: StoreFixture;
let ownerA: StoreCtx;

beforeAll(async () => {
  Object.assign(process.env, { QBO_CLIENT_ID: "id", QBO_CLIENT_SECRET: "secret", QBO_REDIRECT_URI: "http://localhost:3000/api/qbo/callback" });
  fake = installFakeQbo();
  a = await makeStore("void-a");
  await connectStore(a.store.id, fake);
  ownerA = { userId: a.owner.id, storeId: a.store.id, slug: a.store.slug, storeName: a.store.name, role: "owner", customerId: null };
});
afterAll(() => {
  fake.restore();
  Object.assign(process.env, { QBO_CLIENT_ID: "", QBO_CLIENT_SECRET: "", QBO_REDIRECT_URI: "" });
});

describe("cancel and reopen an invoiced order", () => {
  it("cancel voids the invoice in QuickBooks once", async () => {
    const { syncOrderToQuickBooks } = await import("../../lib/sync");
    const { setOrderStatus } = await import("../../lib/data/orders");
    await syncOrderToQuickBooks(a.orderA.id);
    const invoiceId = (await db.order.findUniqueOrThrow({ where: { id: a.orderA.id } })).qboInvoiceId!;
    await setOrderStatus(ownerA, a.orderA.id, "cancelled");
    const o = await db.order.findUniqueOrThrow({ where: { id: a.orderA.id } });
    expect(o).toMatchObject({ status: "cancelled", qboSyncStatus: "voided" });
    expect(fake.invoices.find((i) => i.Id === invoiceId)?.Voided).toBe(true);
    expect(fake.count((c) => c.path.includes("operation=void"))).toBe(1);
  });

  it("reopen makes a fresh invoice with a new number, never reusing the voided one", async () => {
    const { syncOrderToQuickBooks } = await import("../../lib/sync");
    const { setOrderStatus } = await import("../../lib/data/orders");
    await setOrderStatus(ownerA, a.orderA.id, "new");
    const reopened = await db.order.findUniqueOrThrow({ where: { id: a.orderA.id } });
    expect(reopened).toMatchObject({ qboInvoiceId: null, qboAttempt: 1, qboSyncStatus: "pending" });
    const synced = await syncOrderToQuickBooks(a.orderA.id);
    expect(synced).toMatchObject({ qboSyncStatus: "synced", qboDocNumber: "ORD-1001-2" });
    expect(fake.invoices.filter((i) => String(i.DocNumber).startsWith("ORD-1001"))).toHaveLength(2);
  });

  it("if QuickBooks can't void, the order is still cancelled and the seller is told", async () => {
    const { syncOrderToQuickBooks } = await import("../../lib/sync");
    const { setOrderStatus } = await import("../../lib/data/orders");
    await syncOrderToQuickBooks(a.orderB.id);
    fake.failNext(/\/invoice$/, { status: 503, code: "503", message: "Service unavailable" });
    await setOrderStatus(ownerA, a.orderB.id, "cancelled");
    const o = await db.order.findUniqueOrThrow({ where: { id: a.orderB.id } });
    expect(o).toMatchObject({ status: "cancelled", qboSyncStatus: "void_failed" });
    expect(o.qboError).toMatch(/void it in QuickBooks/i);
  });
});
