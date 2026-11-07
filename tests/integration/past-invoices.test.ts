import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "../helpers/request";
import { db } from "../../lib/db";
import type { StoreCtx } from "../../lib/scope";
import { connectStore, installFakeQbo, type FakeQbo } from "../helpers/fake-qbo";
import { makeStore, type StoreFixture } from "../helpers/fixtures";

let fake: FakeQbo;
let a: StoreFixture;
let ownerA: StoreCtx;
const buyer = (f: StoreFixture, customerId: string, userId: string): StoreCtx => ({ userId, storeId: f.store.id, slug: f.store.slug, storeName: f.store.name, role: "buyer", customerId });

beforeAll(async () => {
  Object.assign(process.env, { QBO_CLIENT_ID: "id", QBO_CLIENT_SECRET: "secret", QBO_REDIRECT_URI: "http://localhost:3000/api/qbo/callback" });
  fake = installFakeQbo();
  a = await makeStore("past-a");
  await connectStore(a.store.id, fake);
  ownerA = { userId: a.owner.id, storeId: a.store.id, slug: a.store.slug, storeName: a.store.name, role: "owner", customerId: null };
  await db.customer.update({ where: { id: a.customerA.id }, data: { qboCustomerId: "501" } });
  await db.customer.update({ where: { id: a.customerB.id }, data: { qboCustomerId: "502" } });
  await db.product.update({ where: { id: a.product.id }, data: { qboItemId: "601" } });
  const line = (amount: number, itemId = "601") => ({ DetailType: "SalesItemLineDetail", Amount: amount, Description: "Thing", SalesItemLineDetail: { ItemRef: { value: itemId, name: "Thing" }, Qty: 2, UnitPrice: amount / 2 } });
  fake.invoices.push(
    { Id: "9001", DocNumber: "1044", TxnDate: "2026-03-02", CustomerRef: { value: "501" }, TotalAmt: 40, Line: [line(40), { DetailType: "SubTotalLineDetail", Amount: 40 }] },
    { Id: "9002", DocNumber: "1045", TxnDate: "2026-05-10", CustomerRef: { value: "502" }, TotalAmt: 10, Line: [line(10, "777")] },
    { Id: "9003", DocNumber: "0900", TxnDate: "2024-01-01", CustomerRef: { value: "501" }, TotalAmt: 5, Line: [line(5)] },
  );
});
afterAll(() => {
  fake.restore();
  Object.assign(process.env, { QBO_CLIENT_ID: "", QBO_CLIENT_SECRET: "", QBO_REDIRECT_URI: "" });
});

describe("past invoices", () => {
  it("brings in invoices since the chosen date for linked customers, without duplicates on re-run", async () => {
    const { importPastInvoices } = await import("../../lib/data/past-invoices");
    const r = await importPastInvoices(ownerA, "2026-01-01");
    expect(r.created).toBe(2);
    expect((await importPastInvoices(ownerA, "2026-01-01")).created).toBe(0);
    expect(await db.pastInvoice.count({ where: { storeId: a.store.id } })).toBe(2);
  });

  it("a buyer sees only their own, with reorder only for lines linked to products", async () => {
    const { listPastInvoices } = await import("../../lib/data/past-invoices");
    const mine = await listPastInvoices(buyer(a, a.customerA.id, a.buyerA.id));
    expect(mine.map((i) => i.docNumber)).toEqual(["1044"]);
    expect(mine[0].lines).toEqual([{ name: "Thing", qty: 2, amountCents: 4000, productId: a.product.id }]);
    const theirs = await listPastInvoices(buyer(a, a.customerB.id, a.buyerB.id));
    expect(theirs[0].lines[0].productId).toBeNull();
  });

  it("refuses a bad or future date", async () => {
    const { importPastInvoices } = await import("../../lib/data/past-invoices");
    await expect(importPastInvoices(ownerA, "yesterday")).rejects.toThrow(/date/);
    await expect(importPastInvoices(ownerA, "2999-01-01")).rejects.toThrow(/date/);
  });

  it("undo removes them", async () => {
    const { undoImport } = await import("../../lib/data/qbo-import");
    const batch = await db.importBatch.findFirstOrThrow({ where: { storeId: a.store.id, kind: "invoices" }, orderBy: { createdAt: "asc" } });
    expect(await undoImport(ownerA, batch.id)).toMatchObject({ removed: 2 });
    expect(await db.pastInvoice.count({ where: { storeId: a.store.id } })).toBe(0);
  });
});
