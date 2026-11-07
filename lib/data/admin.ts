// Platform owner tools: see every store and suspend or reopen one. Deliberately no access to
// any store's orders or customers (the "we never market to your customers" promise).
import { db } from "../db";

export async function listAllStores() {
  const stores = await db.store.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      createdAt: true,
      memberships: { where: { role: "owner" }, take: 1, select: { user: { select: { email: true } } } },
    },
  });
  return stores.map(({ memberships, ...s }) => ({ ...s, ownerEmail: memberships[0]?.user.email ?? null }));
}

/** False if there is no such store. */
export async function setStoreStatus(storeId: string, status: "active" | "suspended"): Promise<boolean> {
  const r = await db.store.updateMany({ where: { id: storeId }, data: { status } });
  return r.count === 1;
}
