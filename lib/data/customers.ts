// The store's customers (businesses or people who buy) and their logins and special prices.
import bcrypt from "bcryptjs";
import { db } from "../db";
import type { StoreCtx } from "../scope";
import { DataError } from "./errors";
import { asManager } from "./guard";

export async function listCustomers(ctx: StoreCtx) {
  const { storeId } = asManager(ctx);
  const [customers, totals] = await Promise.all([
    db.customer.findMany({
      where: { storeId },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { orders: true, prices: true } },
        orders: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
    db.order.groupBy({
      by: ["customerId"],
      where: { storeId, status: { not: "cancelled" } },
      _sum: { subtotalCents: true },
    }),
  ]);
  const spend = new Map(totals.map((t) => [t.customerId, t._sum.subtotalCents ?? 0]));
  return customers.map((c) => ({ ...c, spendCents: spend.get(c.id) ?? 0 }));
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
  password: string;
};

/**
 * Adds a customer and gives their contact a login for this store.
 * If the email already has a login (e.g. they buy from another store too), that person simply gains
 * access to this store and keeps their own password; the temporary password is not applied.
 */
export async function createCustomerWithLogin(ctx: StoreCtx, input: NewCustomer) {
  const { storeId } = asManager(ctx);
  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({
    where: { email },
    include: { memberships: { where: { storeId }, select: { id: true } } },
  });
  if (existing && existing.memberships.length > 0) throw new DataError("This email already has access to this store.");

  return db.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        storeId,
        name: input.name,
        contactName: input.contactName,
        email,
        phone: input.phone || null,
        address: input.address || null,
      },
    });
    const userId =
      existing?.id ??
      (
        await tx.user.create({
          data: { email, name: input.contactName, passwordHash: await bcrypt.hash(input.password, 10) },
        })
      ).id;
    await tx.membership.create({ data: { userId, storeId, role: "buyer", customerId: customer.id } });
    return { id: customer.id, existingLogin: Boolean(existing) };
  });
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
  const customer = await db.customer.findFirst({ where: { id: customerId, storeId }, select: { id: true } });
  if (!customer) return null;

  const wanted = [...new Set([...upserts.map((u) => u.productId), ...removals])];
  const own = await db.product.count({ where: { storeId, id: { in: wanted } } });
  if (own !== wanted.length) throw new DataError("Unknown product.");

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
  return { saved: upserts.length, cleared: removals.length };
}
