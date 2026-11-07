// Fixes from the independent review. Each test reproduces a finding.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { callRoute, signedCookie } from "../helpers/request";
import { db } from "../../lib/db";
import { outbox } from "../../lib/email";
import { SESSION_COOKIE } from "../../lib/cookie-name";
import type { StoreCtx } from "../../lib/scope";
import { connectStore, installFakeQbo, type FakeQbo } from "../helpers/fake-qbo";
import { makeStore, type StoreFixture } from "../helpers/fixtures";
import { base32Decode, totpAt } from "../../lib/totp";

const ctxOf = (f: StoreFixture, role: StoreCtx["role"] = "owner", userId = f.owner.id): StoreCtx => ({
  userId, storeId: f.store.id, slug: f.store.slug, storeName: f.store.name, role, customerId: null,
});

describe("1. sign-up never signs in as an account it didn't just create", () => {
  async function signup(email: string, slug: string) {
    const { POST } = await import("../../app/api/auth/signup/route");
    return callRoute(POST, { method: "POST", url: "/api/auth/signup", body: { name: "X", email, password: "a-long-password-1", storeName: "S", slug } });
  }
  it("re-submitting a new account's email gives no session and the same answer", async () => {
    const first = await signup("victim@takeover.test", "victim-store");
    const firstJson = await first.json();
    const second = await signup("victim@takeover.test", "attacker-store");
    expect(signedCookie(SESSION_COOKIE)).toBeUndefined();
    expect(await second.json()).toEqual(firstJson);
  });
  it("the emailed confirmation link is what signs the new owner in", async () => {
    const token = /token=([A-Za-z0-9_-]+)/.exec(outbox.filter((e) => e.to === "victim@takeover.test").find((e) => e.subject.includes("Confirm"))!.text)![1];
    const { POST } = await import("../../app/api/auth/verify/route");
    const res = await callRoute(POST, { method: "POST", url: "/api/auth/verify", body: { token } });
    expect(res.status).toBe(200);
    expect(signedCookie(SESSION_COOKIE)).toBeDefined();
  });
});

describe("2. two-step codes can't be brute-forced", () => {
  let userId: string;
  let secret: string;
  beforeAll(async () => {
    const { startTwoStep, enableTwoStep } = await import("../../lib/data/two-step");
    userId = (await db.user.create({ data: { email: "brute@test.local", name: "B", passwordHash: "x", emailVerifiedAt: new Date() } })).id;
    secret = (await startTwoStep(userId)).secret;
    await enableTwoStep(userId, totpAt(base32Decode(secret), Date.now() / 1000));
  });
  it("parallel guesses on one ticket stop at 8", async () => {
    const { beginTwoStepLogin, finishTwoStepLogin } = await import("../../lib/data/two-step");
    const ticket = await beginTwoStepLogin(userId);
    await Promise.all(Array.from({ length: 30 }, () => finishTwoStepLogin(ticket, "000000")));
    const row = await db.authToken.findFirstOrThrow({ where: { userId, purpose: "two_step" }, orderBy: { createdAt: "desc" } });
    expect(row.attempts).toBeLessThanOrEqual(8);
  });
  it("too many wrong codes across tickets locks two-step for that person", async () => {
    const { beginTwoStepLogin, finishTwoStepLogin } = await import("../../lib/data/two-step");
    for (let i = 0; i < 3; i++) {
      const t = await beginTwoStepLogin(userId);
      for (let j = 0; j < 8; j++) await finishTwoStepLogin(t, "000000");
    }
    await db.user.update({ where: { id: userId }, data: { totpLastStep: null } });
    const t = await beginTwoStepLogin(userId);
    const good = totpAt(base32Decode(secret), Date.now() / 1000);
    expect((await finishTwoStepLogin(t, good)).ok).toBe(false);
  });
  it("the client can't choose its IP with X-Forwarded-For", async () => {
    const { clientIp } = await import("../../lib/rate-limit");
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.9" } });
    expect(clientIp(req)).toBe("203.0.113.9");
  });
  it("two-step can't be turned on before the email is confirmed", async () => {
    const { startTwoStep } = await import("../../lib/data/two-step");
    const u = await db.user.create({ data: { email: "squat@test.local", name: "S", passwordHash: "x" } });
    await expect(startTwoStep(u.id)).rejects.toThrow(/confirm your email/i);
  });
});

describe("QuickBooks review fixes", () => {
  let fake: FakeQbo;
  let a: StoreFixture;
  beforeAll(async () => {
    Object.assign(process.env, { QBO_CLIENT_ID: "id", QBO_CLIENT_SECRET: "secret", QBO_REDIRECT_URI: "http://localhost:3000/api/qbo/callback" });
    fake = installFakeQbo();
    a = await makeStore("rev-qbo");
    await connectStore(a.store.id, fake);
  });
  afterAll(() => {
    fake.restore();
    Object.assign(process.env, { QBO_CLIENT_ID: "", QBO_CLIENT_SECRET: "", QBO_REDIRECT_URI: "" });
  });

  it("3. after switching QuickBooks company, an old order's invoice is never voided in the new company", async () => {
    const { syncOrderToQuickBooks } = await import("../../lib/sync");
    const { setOrderStatus } = await import("../../lib/data/orders");
    await syncOrderToQuickBooks(a.orderA.id);
    await db.store.update({ where: { id: a.store.id }, data: { qboRealmId: "9130359999999999" } });
    await setOrderStatus(ctxOf(a), a.orderA.id, "cancelled");
    expect(fake.count((c) => c.path.includes("operation=void"))).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: a.orderA.id } })).qboError).toMatch(/different QuickBooks company/);
    await db.store.update({ where: { id: a.store.id }, data: { qboRealmId: "9130350000000001" } });
  });

  it("4. a cancelled order is never sent to QuickBooks", async () => {
    const { syncOrderToQuickBooks } = await import("../../lib/sync");
    await db.order.update({ where: { id: a.orderB.id }, data: { status: "cancelled" } });
    const before = fake.invoices.length;
    await syncOrderToQuickBooks(a.orderB.id);
    expect(fake.invoices.length).toBe(before);
  });

  it("5. undoing an import keeps edits made after the import", async () => {
    const { importFromQbo, undoImport } = await import("../../lib/data/qbo-import");
    fake.items.push({ Id: "801", Name: "Linked Thing", Sku: "SKU-REV-QBO", UnitPrice: 50, Type: "NonInventory", Active: true });
    await db.product.update({ where: { id: a.product.id }, data: { qboItemId: "801" } });
    const r = await importFromQbo(ctxOf(a), "items", ["801"]);
    await db.product.update({ where: { id: a.product.id }, data: { priceCents: 6100 } });
    await undoImport(ctxOf(a), r.batchId);
    expect((await db.product.findUniqueOrThrow({ where: { id: a.product.id } })).priceCents).toBe(6100);
  });
});

describe("6. undo is all-or-nothing", () => {
  it("if putting the old values back fails, the change stays undoable", async () => {
    const f = await makeStore("rev-undo");
    const { createProduct, updateProduct } = await import("../../lib/data/products");
    const { undoChange } = await import("../../lib/data/history");
    const other = await createProduct(ctxOf(f), { sku: "TAKEN", name: "Other", category: "G", unitKind: "count", unit: "each", priceCents: 100 });
    const r = await updateProduct(ctxOf(f), f.product.id, { sku: "NEW-SKU" });
    await db.product.update({ where: { id: other.id }, data: { sku: f.product.sku } }); // old SKU now taken
    await expect(undoChange(ctxOf(f), r!.changeId)).rejects.toThrow();
    expect((await db.changeLog.findUniqueOrThrow({ where: { id: r!.changeId } })).undoneAt).toBeNull();
  });
});

describe("7. accepting one store's invite keeps other stores' invites working", () => {
  it("store B's invite still works after accepting store A's", async () => {
    const a = await makeStore("rev-inv-a");
    const b = await makeStore("rev-inv-b");
    const { createCustomer } = await import("../../lib/data/customers");
    const { acceptInvite } = await import("../../lib/data/invites");
    const input = { name: "Two Stores", contactName: "T", email: "two-stores@test.local", phone: "", address: "" };
    await createCustomer(ctxOf(a), input);
    const tokA = /token=([A-Za-z0-9_-]+)/.exec(outbox.at(-1)!.text)![1];
    await createCustomer(ctxOf(b), input);
    const tokB = /token=([A-Za-z0-9_-]+)/.exec(outbox.at(-1)!.text)![1];
    const first = await acceptInvite(tokA, { sessionUserId: null, name: "T", password: "a-long-password-1" });
    expect(first.ok).toBe(true);
    const userId = (first as { userId: string }).userId;
    expect((await acceptInvite(tokB, { sessionUserId: userId })).ok).toBe(true);
  });
});

describe("8. oversized uploads are refused without trusting Content-Length", () => {
  it("a body over the limit with no Content-Length is refused", async () => {
    const f = await makeStore("rev-up");
    const { POST } = await import("../../app/api/s/[slug]/manage/uploads/route");
    const fd = new FormData();
    fd.set("kind", "product");
    fd.set("file", new File([new Uint8Array(9 * 1024 * 1024)], "big.png", { type: "image/png" }));
    const res = await callRoute(POST, { method: "POST", url: "/api/s/rev-up/manage/uploads", token: f.tokens.owner, params: { slug: "rev-up" }, form: fd });
    expect(res.status).toBe(413);
  });
});

describe("10. reopening a suspended store keeps the email-confirmation rule", () => {
  it("a store whose owner never confirmed goes back to unverified, not open", async () => {
    const f = await makeStore("rev-admin");
    await db.user.update({ where: { id: f.owner.id }, data: { emailVerifiedAt: null } });
    const { setStoreStatus } = await import("../../lib/data/admin");
    await setStoreStatus(f.store.id, "suspended");
    await setStoreStatus(f.store.id, "active");
    expect((await db.store.findUniqueOrThrow({ where: { id: f.store.id } })).status).toBe("unverified");
  });
});

describe("11. invites need a confirmed store", () => {
  it("an unconfirmed store can't email customer invites", async () => {
    const f = await makeStore("rev-unv");
    await db.store.update({ where: { id: f.store.id }, data: { status: "unverified" } });
    const { createCustomer } = await import("../../lib/data/customers");
    await expect(createCustomer(ctxOf(f), { name: "N", contactName: "N", email: "n@rev.test", phone: "", address: "" })).rejects.toThrow(/confirm your email/i);
  });
});
