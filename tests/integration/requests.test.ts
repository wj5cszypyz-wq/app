import { beforeAll, describe, expect, it } from "vitest";
import "../helpers/request";
import { db } from "../../lib/db";
import { outbox } from "../../lib/email";
import type { StoreCtx } from "../../lib/scope";
import { makeStore, type StoreFixture } from "../helpers/fixtures";

let a: StoreFixture;
let ownerA: StoreCtx;
let staffA: StoreCtx;
const req = { businessName: "Corner Cafe", contactName: "Mo", email: "Mo@Corner.test", phone: "", message: "We'd like to order weekly." };

beforeAll(async () => {
  a = await makeStore("req-a");
  const base = { storeId: a.store.id, slug: a.store.slug, storeName: a.store.name, customerId: null };
  ownerA = { ...base, userId: a.owner.id, role: "owner" };
  staffA = { ...base, userId: a.staff.id, role: "staff" };
});

describe("account requests", () => {
  it("requests off → 404", async () => {
    const { joinPageInfo, submitAccountRequest } = await import("../../lib/data/requests");
    expect(await joinPageInfo("req-a")).toBeNull();
    expect(await submitAccountRequest("req-a", req)).toEqual({ ok: false, notFound: true });
    expect(await db.accountRequest.count({ where: { email: "mo@corner.test" } })).toBe(0);
  });

  it("only the owner can turn requests on", async () => {
    const { setAllowAccountRequests } = await import("../../lib/data/requests");
    await expect(setAllowAccountRequests(staffA, true)).rejects.toThrow(/owner/);
    await setAllowAccountRequests(ownerA, true);
    expect((await db.store.findUniqueOrThrow({ where: { id: a.store.id } })).allowAccountRequests).toBe(true);
  });

  it("on → a request is saved as pending and shows only to this store", async () => {
    const { joinPageInfo, submitAccountRequest, listAccountRequests } = await import("../../lib/data/requests");
    expect(await joinPageInfo("REQ-A")).toEqual({ storeName: a.store.name });
    expect(await submitAccountRequest("req-a", req)).toEqual({ ok: true });
    const list = (await listAccountRequests(ownerA)).filter((r) => r.businessName === "Corner Cafe");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ email: "mo@corner.test", status: "pending" });
    const b = await makeStore("req-b");
    const other = await listAccountRequests({ ...ownerA, storeId: b.store.id, slug: "req-b", userId: b.owner.id });
    expect(other.some((r) => r.businessName === "Corner Cafe")).toBe(false);
  });

  it("missing fields are refused", async () => {
    const { submitAccountRequest } = await import("../../lib/data/requests");
    expect(await submitAccountRequest("req-a", { ...req, email: "nope" })).toEqual({ ok: false, error: "Enter a valid email address." });
    expect(await submitAccountRequest("req-a", { ...req, businessName: "" })).toEqual({ ok: false, error: "Add your business or name." });
  });

  it("approve creates the customer and emails an invite; can't approve twice", async () => {
    const { approveRequest, listAccountRequests } = await import("../../lib/data/requests");
    const r = (await listAccountRequests(ownerA)).find((x) => x.email === "mo@corner.test")!;
    expect(await approveRequest(staffA, r.id)).toBe(true);
    expect(await db.customer.findFirst({ where: { storeId: a.store.id, email: "mo@corner.test" } })).not.toBeNull();
    expect(outbox.at(-1)).toMatchObject({ to: "mo@corner.test" });
    expect(await approveRequest(staffA, r.id)).toBe(false);
  });

  it("decline marks it declined; another store's id does nothing", async () => {
    const { submitAccountRequest, declineRequest, listAccountRequests } = await import("../../lib/data/requests");
    await submitAccountRequest("req-a", { ...req, email: "two@corner.test" });
    const r = (await listAccountRequests(ownerA)).find((x) => x.email === "two@corner.test")!;
    const b = await makeStore("req-c");
    expect(await declineRequest({ ...ownerA, storeId: b.store.id, slug: "req-c", userId: b.owner.id }, r.id)).toBe(false);
    expect(await declineRequest(ownerA, r.id)).toBe(true);
    expect((await listAccountRequests(ownerA)).some((x) => x.id === r.id)).toBe(false);
  });
});
