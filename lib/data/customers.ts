// The store's customers (businesses or people who buy) and their logins and special prices.
import { db } from "../db";
import type { StoreCtx } from "../scope";
import { DataError } from "./errors";
import { asManager } from "./guard";
import { recordChange } from "./history";
import { inviteCustomerLogin } from "./invites";

export async function listCustomers(ctx: StoreCtx) {
  const { storeId } = asManager(ctx);
  const [customers, totals] = await Promise.all([
    db.customer.findMany({
      where: { storeId },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { orders: true, prices: true } },
        orders: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        memberships: { select: { id: true }, take: 1 },
      },
    }),
    db.order.groupBy({
      by: ["customerId"],
      where: { storeId, status: { not: "cancelled" } },
      _sum: { subtotalCents: true },
    }),
  ]);
  const spend = new Map(totals.map((t) => [t.customerId, t._sum.subtotalCents ?? 0]));
  return customers.map(({ memberships, ...c }) => ({ ...c, hasLogin: memberships.length > 0, spendCents: spend.get(c.id) ?? 0 }));
}

/** One customer of this store with their special prices; null otherwise. */
export async function getCustomer(ctx: StoreCtx, id: string) {
  const { storeId } = asManager(ctx);
  if (typeof id !== "string") return null;
  return db.customer.findFirst({ where: { id, storeId }, include: { prices: true } });
}

export type NewCustomer = {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
};

/** Adds a customer and emails their contact an invite to sign in to this store. */
export async function createCustomer(ctx: StoreCtx, input: NewCustomer) {
  const { storeId } = asManager(ctx);
  const email = input.email.trim().toLowerCase();
  const taken = await db.membership.findFirst({ where: { storeId, user: { email } }, select: { id: true } });
  const pending = await db.customer.findFirst({ where: { storeId, email }, select: { id: true } });
  if (taken || pending) throw new DataError("This email already has access to this store.");

  const customer = await db.customer.create({
    data: {
      storeId,
      name: input.name,
      contactName: input.contactName,
      email,
      phone: input.phone || null,
      address: input.address || null,
    },
  });
  await inviteCustomerLogin(ctx, customer.id);
  return { id: customer.id };
}

/**
 * Saves a customer's special prices. Returns null if the customer isn't in this store.
 * Throws if any product isn't in this store.
 */
export async function setCustomerPrices(
  ctx: StoreCtx,
  customerId: string,
  upserts: { productId: string; priceCents: number }[],
  removals: string[],
) {
  const { storeId } = asManager(ctx);
  const customer = await db.customer.findFirst({ where: { id: customerId, storeId }, select: { id: true, name: true } });
  if (!customer) return null;

  const wanted = [...new Set([...upserts.map((u) => u.productId), ...removals])];
  const own = await db.product.count({ where: { storeId, id: { in: wanted } } });
  if (own !== wanted.length) throw new DataError("Unknown product.");

  const old = await db.customerPrice.findMany({ where: { customerId, productId: { in: wanted } } });
  const oldMap = new Map(old.map((o) => [o.productId, o.priceCents]));
  const before = Object.fromEntries(wanted.map((id) => [id, oldMap.get(id) ?? null]));
  const after = Object.fromEntries([...removals.map((id) => [id, null] as const), ...upserts.map((u) => [u.productId, u.priceCents] as const)]);
  await db.$transaction([
    db.customerPrice.deleteMany({ where: { customerId, productId: { in: removals } } }),
    ...upserts.map((u) =>
      db.customerPrice.upsert({
        where: { customerId_productId: { customerId, productId: u.productId } },
        create: { customerId, ...u },
        update: { priceCents: u.priceCents },
      }),
    ),
  ]);
  const changeId = await recordChange(ctx, {
    entity: "customerPrices", entityId: customerId, action: "update", summary: `Changed special prices for ${customer.name}`, before, after,
  });
  return { saved: upserts.length, cleared: removals.length, changeId };
}
