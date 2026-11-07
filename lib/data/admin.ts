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

/**
 * Suspends or reopens a store. False if there is no such store. Reopening never skips the
 * email-confirmation step: a store whose owner hasn't confirmed goes back to "unverified".
 */
export async function setStoreStatus(storeId: string, status: "active" | "suspended"): Promise<boolean> {
  let next: string = status;
  if (status === "active") {
    const owner = await db.membership.findFirst({ where: { storeId, role: "owner" }, select: { user: { select: { emailVerifiedAt: true } } } });
    if (!owner?.user.emailVerifiedAt) next = "unverified";
  }
  const r = await db.store.updateMany({ where: { id: storeId }, data: { status: next } });
  return r.count === 1;
}
