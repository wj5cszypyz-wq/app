import { beforeAll, describe, expect, it } from "vitest";
import "../helpers/request";
import { db } from "../../lib/db";
import { outbox } from "../../lib/email";
import type { StoreCtx } from "../../lib/scope";
import { makeStore, type StoreFixture } from "../helpers/fixtures";

let a: StoreFixture;
let ownerA: StoreCtx;
let staffA: StoreCtx;
const tokenIn = (text: string) => /token=([A-Za-z0-9_-]+)/.exec(text)![1];

beforeAll(async () => {
  a = await makeStore("inv-a");
  const base = { storeId: a.store.id, slug: a.store.slug, storeName: a.store.name, customerId: null };
  ownerA = { ...base, userId: a.owner.id, role: "owner" };
  staffA = { ...base, userId: a.staff.id, role: "staff" };
});

describe("customer invites", () => {
  it("adding a customer emails an invite instead of setting a password", async () => {
    const { createCustomer } = await import("../../lib/data/customers");
    await createCustomer(ownerA, { name: "Lamp Loft", contactName: "Kim", email: "kim@loft.test", phone: "", address: "" });
    expect(outbox.at(-1)).toMatchObject({ to: "kim@loft.test" });
    expect(outbox.at(-1)!.text).toContain("/invite?token=");
    expect(await db.user.findUnique({ where: { email: "kim@loft.test" } })).toBeNull();
  });

  it("accepting as a new person creates the login and membership once", async () => {
    const { acceptInvite } = await import("../../lib/data/invites");
    const token = tokenIn(outbox.at(-1)!.text);
    const r = await acceptInvite(token, { sessionUserId: null, name: "Kim Park", password: "kims-password-1" });
    expect(r).toMatchObject({ ok: true, home: "/s/inv-a" });
    const user = await db.user.findUniqueOrThrow({ where: { email: "kim@loft.test" }, include: { memberships: true } });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.memberships).toHaveLength(1);
    expect(user.memberships[0]).toMatchObject({ role: "buyer", storeId: a.store.id });
    expect((await acceptInvite(token, { sessionUserId: null, name: "X", password: "kims-password-2" })).ok).toBe(false);
  });

  it("invite for another email while signed in changes nothing", async () => {
    const { createCustomer } = await import("../../lib/data/customers");
    const { acceptInvite } = await import("../../lib/data/invites");
    await createCustomer(ownerA, { name: "Desk Co", contactName: "Lee", email: "lee@desk.test", phone: "", address: "" });
    const token = tokenIn(outbox.at(-1)!.text);
    const r = await acceptInvite(token, { sessionUserId: a.owner.id });
    expect(r).toEqual({ ok: false, error: "This invite is for lee@desk.test. Sign out, then open the link again." });
    expect(await db.membership.count({ where: { userId: a.owner.id } })).toBe(1);
    // The link still works for the right person afterwards.
    expect((await acceptInvite(token, { sessionUserId: null, name: "Lee", password: "lees-password-1" })).ok).toBe(true);
  });

  it("an existing account must sign in to accept, then joins with its own password", async () => {
    const { createCustomer } = await import("../../lib/data/customers");
    const { acceptInvite } = await import("../../lib/data/invites");
    const other = await makeStore("inv-b");
    await createCustomer(ownerA, { name: "B buyer", contactName: "Bea", email: other.buyerA.email, phone: "", address: "" });
    const token = tokenIn(outbox.at(-1)!.text);
    expect(await acceptInvite(token, { sessionUserId: null, name: "x", password: "whatever-pass-1" })).toEqual({ ok: false, error: "sign_in_required" });
    const r = await acceptInvite(token, { sessionUserId: other.buyerA.id });
    expect(r).toMatchObject({ ok: true });
    expect(await db.membership.count({ where: { userId: other.buyerA.id } })).toBe(2);
  });

  it("the same email can't be added twice to one store", async () => {
    const { createCustomer } = await import("../../lib/data/customers");
    await expect(createCustomer(ownerA, { name: "Again", contactName: "Kim", email: "kim@loft.test", phone: "", address: "" })).rejects.toThrow(
      "This email already has access to this store.",
    );
  });
});

describe("staff invites", () => {
  it("only the owner can invite staff", async () => {
    const { inviteStaff } = await import("../../lib/data/invites");
    await expect(inviteStaff(staffA, "helper@a.test")).rejects.toThrow(/owner/);
    await inviteStaff(ownerA, "helper@a.test");
    expect(outbox.at(-1)).toMatchObject({ to: "helper@a.test" });
  });

  it("accepting a staff invite gives seller access", async () => {
    const { acceptInvite } = await import("../../lib/data/invites");
    const { resolveMembership } = await import("../../lib/scope");
    const r = await acceptInvite(tokenIn(outbox.at(-1)!.text), { sessionUserId: null, name: "Helper", password: "helper-password-1" });
    expect(r).toMatchObject({ ok: true, home: "/s/inv-a/manage" });
    const helper = await db.user.findUniqueOrThrow({ where: { email: "helper@a.test" } });
    expect((await resolveMembership(helper.id, "inv-a"))?.role).toBe("staff");
  });

  it("removing staff takes away access immediately; the owner can't be removed", async () => {
    const { removeStaff } = await import("../../lib/data/invites");
    const { resolveMembership } = await import("../../lib/scope");
    const helper = await db.user.findUniqueOrThrow({ where: { email: "helper@a.test" } });
    expect(await removeStaff(ownerA, helper.id)).toBe(true);
    expect(await resolveMembership(helper.id, "inv-a")).toBeNull();
    expect(await removeStaff(ownerA, a.owner.id)).toBe(false);
  });
});
