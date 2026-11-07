// Break-in matrix: every store API route, called as every kind of outsider, must fail and change nothing.
import { beforeAll, describe, expect, it } from "vitest";
import { callRoute, type RouteHandler } from "../helpers/request";
import { db } from "../../lib/db";
import type { Role } from "../../lib/scope";
import { ROUTES, type Ids, type RouteCase } from "../helpers/route-manifest";
import { makeStore, type StoreFixture } from "../helpers/fixtures";

let a: StoreFixture;
let b: StoreFixture;

beforeAll(async () => {
  a = await makeStore("routes-a");
  b = await makeStore("routes-b");
});

const idsOf = (f: StoreFixture): Ids => ({ order: f.orderA.id, product: f.product.id, customer: f.customerA.id, staffUser: f.staff.id, request: f.accountRequest.id });

async function load(file: string): Promise<Record<string, RouteHandler>> {
  return import(`../../app/api/s/[slug]/${file}`);
}

/** Everything in store a that a write could touch. */
async function snapshot(storeId: string) {
  const [store, orders, products, customers, prices, memberships] = await Promise.all([
    db.store.findUnique({ where: { id: storeId } }),
    db.order.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
    db.product.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
    db.customer.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
    db.customerPrice.findMany({ where: { customer: { storeId } }, orderBy: { id: "asc" } }),
    db.membership.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
  ]);
  return JSON.stringify({ store, orders, products, customers, prices, memberships });
}

async function call(rc: RouteCase, slug: string, ids: Ids, token: string | undefined, bodyFrom: StoreFixture) {
  const mod = await load(rc.file);
  const handler = mod[rc.method];
  return callRoute(handler, {
    method: rc.method,
    url: `/api/s/${slug}/${rc.path(ids)}`,
    token,
    params: { slug, ...rc.params(ids) },
    body: rc.body?.(bodyFrom),
    form: rc.form?.(),
  });
}

describe.each(ROUTES)("$method $file", (rc) => {
  it("signed out → 401, nothing changes", async () => {
    const before = await snapshot(a.store.id);
    const res = await call(rc, "routes-a", idsOf(a), undefined, a);
    expect(res.status).toBe(401);
    expect(await snapshot(a.store.id)).toBe(before);
  });

  it("every member of another store → 404, nothing changes", async () => {
    for (const token of Object.values(b.tokens)) {
      const before = await snapshot(a.store.id);
      const res = await call(rc, "routes-a", idsOf(a), token, a);
      expect(res.status, `token of store b`).toBe(404);
      expect(await snapshot(a.store.id)).toBe(before);
    }
  });

  it("members of a with the wrong role → 404, nothing changes", async () => {
    const roleTokens: [Role, string][] = [["owner", a.tokens.owner], ["staff", a.tokens.staff], ["buyer", a.tokens.buyerA]];
    for (const [role, token] of roleTokens.filter(([r]) => !rc.roles.includes(r))) {
      const before = await snapshot(a.store.id);
      const res = await call(rc, "routes-a", idsOf(a), token, a);
      expect(res.status, `role ${role}`).toBe(404);
      expect(await snapshot(a.store.id)).toBe(before);
    }
  });

  it("allowed member of a using b's ids → never touches b", async () => {
    const token = rc.roles.includes("owner") ? a.tokens.owner : a.tokens.buyerA;
    const before = await snapshot(b.store.id);
    const res = await call(rc, "routes-a", idsOf(b), token, b);
    expect(await snapshot(b.store.id)).toBe(before);
    if (rc.file.includes("[id]") || rc.file.includes("[userId]")) expect(res.status).toBe(404);
  });

  it("allowed role of a → succeeds", async () => {
    const token = rc.roles.includes("owner") ? a.tokens.owner : a.tokens.buyerA;
    const res = await call(rc, "routes-a", idsOf(a), token, a);
    expect(rc.okStatus, `status ${res.status}: ${await res.clone().text()}`).toContain(res.status);
  });
});
