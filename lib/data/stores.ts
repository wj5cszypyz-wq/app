// Store-level reads. The full store row (with encrypted QuickBooks tokens) never leaves the server.
import { db } from "../db";
import type { Role, StoreCtx } from "../scope";
import { asManager } from "./guard";

export async function getStoreForCtx(ctx: StoreCtx) {
  asManager(ctx);
  return db.store.findUniqueOrThrow({ where: { id: ctx.storeId } });
}

/** Header info for seller pages. */
export async function storeHeader(ctx: StoreCtx) {
  asManager(ctx);
  return db.store.findUniqueOrThrow({
    where: { id: ctx.storeId },
    select: { name: true, qboRealmId: true, qboCompanyName: true },
  });
}

/** Every active store this person can use, for the "choose a store" page. */
export async function listMembershipsForUser(userId: string): Promise<{ slug: string; storeName: string; role: Role }[]> {
  const rows = await db.membership.findMany({
    where: { userId, store: { status: "active" } },
    orderBy: { store: { name: "asc" } },
    select: { role: true, store: { select: { slug: true, name: true } } },
  });
  return rows.map((r) => ({ slug: r.store.slug, storeName: r.store.name, role: r.role as Role }));
}
