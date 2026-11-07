import { beforeAll, describe, expect, it } from "vitest";
import "../helpers/request"; // mocks next/headers cookies()
import { db } from "../../lib/db";
import { makeStore, type StoreFixture } from "../helpers/fixtures";
import { callRoute } from "../helpers/request";

let a: StoreFixture;
let b: StoreFixture;

beforeAll(async () => {
  a = await makeStore("scope-a");
  b = await makeStore("scope-b");
});

describe("resolveMembership", () => {
  it("resolves owner of a", async () => {
    const { resolveMembership } = await import("../../lib/scope");
    const ctx = await resolveMembership(a.owner.id, "scope-a");
    expect(ctx).toMatchObject({ role: "owner", storeId: a.store.id, slug: "scope-a", customerId: null });
  });

  it("owner of a gets null for b", async () => {
    const { resolveMembership } = await import("../../lib/scope");
    expect(await resolveMembership(a.owner.id, "scope-b")).toBeNull();
  });

  it("buyer gets their customer id", async () => {
    const { resolveMembership } = await import("../../lib/scope");
    const ctx = await resolveMembership(a.buyerA.id, "scope-a");
    expect(ctx).toMatchObject({ role: "buyer", customerId: a.customerA.id });
  });

  it("multi-membership: same user is owner at a and buyer at b", async () => {
    const { resolveMembership } = await import("../../lib/scope");
    const m = await db.membership.create({
      data: { userId: a.owner.id, storeId: b.store.id, role: "buyer", customerId: b.customerA.id },
    });
    try {
      expect((await resolveMembership(a.owner.id, "scope-a"))?.role).toBe("owner");
      const atB = await resolveMembership(a.owner.id, "scope-b");
      expect(atB).toMatchObject({ role: "buyer", storeId: b.store.id, customerId: b.customerA.id });
    } finally {
      await db.membership.delete({ where: { id: m.id } });
    }
  });

  it("buyer membership pointing at another store's customer is rejected", async () => {
    const { resolveMembership } = await import("../../lib/scope");
    const m = await db.membership.create({
      data: { userId: a.owner.id, storeId: b.store.id, role: "buyer", customerId: a.customerA.id },
    });
    try {
      expect(await resolveMembership(a.owner.id, "scope-b")).toBeNull();
    } finally {
      await db.membership.delete({ where: { id: m.id } });
    }
  });

  it("slug normalization", async () => {
    const { resolveMembership, normalizeSlug } = await import("../../lib/scope");
    expect((await resolveMembership(a.owner.id, "Scope-A"))?.storeId).toBe(a.store.id);
    for (const bad of ["scope-a/../scope-b", "-scope-a", "", "a".repeat(60), "scope_a", "scope a", "scope-a-"]) {
      expect(normalizeSlug(bad)).toBeNull();
      expect(await resolveMembership(a.owner.id, bad)).toBeNull();
    }
  });

  it("suspended store", async () => {
    const { resolveMembership } = await import("../../lib/scope");
    await db.store.update({ where: { id: a.store.id }, data: { status: "suspended" } });
    try {
      for (const u of [a.owner, a.staff, a.buyerA]) expect(await resolveMembership(u.id, "scope-a")).toBeNull();
    } finally {
      await db.store.update({ where: { id: a.store.id }, data: { status: "active" } });
    }
  });

  it("removed membership", async () => {
    const { resolveMembership } = await import("../../lib/scope");
    const extra = await makeStore("scope-c");
    await db.membership.deleteMany({ where: { userId: extra.staff.id, storeId: extra.store.id } });
    expect(await resolveMembership(extra.staff.id, "scope-c")).toBeNull();
  });
});

describe("storeApi", () => {
  async function probe(slug: string, token: string | undefined, roles: ("owner" | "staff" | "buyer")[]) {
    const { storeApi } = await import("../../lib/scope");
    const handler = async () => {
      const ctx = await storeApi(slug, roles);
      return ctx instanceof Response ? ctx : Response.json(ctx);
    };
    return callRoute(handler, { method: "GET", url: "/x", token });
  }

  it("without session → 401", async () => {
    expect((await probe("scope-a", undefined, ["owner"])).status).toBe(401);
  });

  it("other store's owner → 404", async () => {
    expect((await probe("scope-b", a.tokens.owner, ["owner", "staff"])).status).toBe(404);
  });

  it("wrong role in own store → 404", async () => {
    expect((await probe("scope-a", a.tokens.buyerA, ["owner", "staff"])).status).toBe(404);
    expect((await probe("scope-a", a.tokens.staff, ["owner"])).status).toBe(404);
  });

  it("right role → context for that store", async () => {
    const res = await probe("scope-a", a.tokens.staff, ["owner", "staff"]);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ storeId: a.store.id, role: "staff" });
  });
});

describe("homeFor", () => {
  it("sends sellers to manage and buyers to the storefront", async () => {
    const { homeFor } = await import("../../lib/scope");
    const base = { userId: "u", storeId: "s", slug: "x", storeName: "X", customerId: null };
    expect(homeFor({ ...base, role: "owner" })).toBe("/s/x/manage");
    expect(homeFor({ ...base, role: "staff" })).toBe("/s/x/manage");
    expect(homeFor({ ...base, role: "buyer", customerId: "c" })).toBe("/s/x");
  });
});
