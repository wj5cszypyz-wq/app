import { beforeAll, describe, expect, it } from "vitest";
import { callRoute } from "../helpers/request";
import { db } from "../../lib/db";
import { createSession } from "../../lib/session";
import { makeStore, type StoreFixture } from "../helpers/fixtures";

let a: StoreFixture;
let adminToken: string;

beforeAll(async () => {
  a = await makeStore("admin-a");
  const admin = await db.user.create({ data: { email: "boss@platform.test", name: "Boss", passwordHash: "x", isPlatformAdmin: true } });
  adminToken = await createSession(admin.id);
});

async function patch(token: string | undefined, id: string, status: unknown) {
  const { PATCH } = await import("../../app/api/admin/stores/[id]/route");
  return callRoute(PATCH, { method: "PATCH", url: `/api/admin/stores/${id}`, token, params: { id }, body: { status } });
}

describe("platform admin", () => {
  it("non-admin → 404 (store owner included); signed out → 401", async () => {
    expect((await patch(a.tokens.owner, a.store.id, "suspended")).status).toBe(404);
    expect((await patch(undefined, a.store.id, "suspended")).status).toBe(401);
    expect((await db.store.findUniqueOrThrow({ where: { id: a.store.id } })).status).toBe("active");
  });

  it("admin suspends → store members get 404; reactivate restores access", async () => {
    const { resolveMembership } = await import("../../lib/scope");
    expect((await patch(adminToken, a.store.id, "suspended")).status).toBe(200);
    expect(await resolveMembership(a.owner.id, "admin-a")).toBeNull();
    expect((await patch(adminToken, a.store.id, "active")).status).toBe(200);
    expect((await resolveMembership(a.owner.id, "admin-a"))?.role).toBe("owner");
  });

  it("rejects unknown statuses and unknown stores", async () => {
    expect((await patch(adminToken, a.store.id, "deleted")).status).toBe(400);
    expect((await patch(adminToken, "no-such-store", "active")).status).toBe(404);
  });

  it("the store list shows stores but no orders or customers", async () => {
    const { listAllStores } = await import("../../lib/data/admin");
    const rows = await listAllStores();
    const row = rows.find((r) => r.slug === "admin-a")!;
    expect(Object.keys(row).sort()).toEqual(["createdAt", "id", "name", "ownerEmail", "slug", "status"]);
  });
});
