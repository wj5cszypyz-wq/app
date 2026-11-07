// Orders, always scoped to the signed-in member's store (and to their customer, for buyers).
import { ORDER_STATUSES, type OrderStatus } from "../catalog";
import { db } from "../db";
import { buildLines, type OrderInput, type PricedProduct } from "../orders";
import type { StoreCtx } from "../scope";
import { DataError } from "./errors";
import { asBuyer, asManager } from "./guard";

export type OrderRow = {
  id: string;
  number: number;
  customer: string;
  status: string;
  subtotalCents: number;
  lineCount: number;
  createdAt: string;
  deliveryDate: string | null;
  qboSyncStatus: string;
  qboDocNumber: string | null;
};

export type BoardStats = {
  todayCount: number;
  todayRevenueCents: number;
  openCount: number;
  syncIssues: number;
};

export type BoardFilter = "open" | "all" | "done";
const OPEN = ["new", "packing", "ready"];
const DONE = ["delivered", "cancelled"];

/** Orders + headline numbers for the seller's live board. */
export async function loadBoard(ctx: StoreCtx, filter: BoardFilter) {
  const { storeId } = asManager(ctx);
  const where =
    filter === "open"
      ? { storeId, status: { in: OPEN } }
      : filter === "done"
        ? { storeId, status: { in: DONE } }
        : { storeId };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [orders, today, openCount, syncIssues] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { customer: { select: { name: true } }, _count: { select: { lines: true } } },
    }),
    db.order.aggregate({
      where: { storeId, createdAt: { gte: startOfDay }, status: { not: "cancelled" } },
      _count: true,
      _sum: { subtotalCents: true },
    }),
    db.order.count({ where: { storeId, status: { in: OPEN } } }),
    db.order.count({ where: { storeId, qboSyncStatus: "failed", status: { not: "cancelled" } } }),
  ]);

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    number: o.number,
    customer: o.customer.name,
    status: o.status,
    subtotalCents: o.subtotalCents,
    lineCount: o._count.lines,
    createdAt: o.createdAt.toISOString(),
    deliveryDate: o.deliveryDate?.toISOString() ?? null,
    qboSyncStatus: o.qboSyncStatus,
    qboDocNumber: o.qboDocNumber,
  }));

  const stats: BoardStats = {
    todayCount: today._count,
    todayRevenueCents: today._sum.subtotalCents ?? 0,
    openCount,
    syncIssues,
  };
  return { orders: rows, stats };
}

/** One order with everything the seller's order page and printouts need; null if not in this store. */
export async function getOrderForStore(ctx: StoreCtx, id: string) {
  const { storeId } = asManager(ctx);
  if (typeof id !== "string") return null;
  return db.order.findFirst({
    where: { id, storeId },
    include: {
      lines: true,
      customer: true,
      store: { select: { name: true, phone: true, email: true, address: true, qboRealmId: true } },
    },
  });
}

/** One of the buyer's own orders; null for anyone else's. */
export async function getOrderForBuyer(ctx: StoreCtx, id: string) {
  const { storeId, customerId } = asBuyer(ctx);
  if (typeof id !== "string") return null;
  return db.order.findFirst({
    where: { id, storeId, customerId },
    include: { lines: true, store: { select: { name: true, phone: true } } },
  });
}

export async function listBuyerOrders(ctx: StoreCtx) {
  const { storeId, customerId } = asBuyer(ctx);
  return db.order.findMany({
    where: { storeId, customerId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { lines: { select: { productId: true, qty: true } } },
  });
}

/** Places an order for the buyer's own customer account, re-pricing every line on the server. */
export async function placeOrder(ctx: StoreCtx, input: OrderInput): Promise<{ id: string; number: number }> {
  const { storeId, customerId } = asBuyer(ctx);
  const ids = input.lines.map((l) => l.productId);
  const [products, overrides] = await Promise.all([
    db.product.findMany({ where: { id: { in: ids }, storeId, active: true } }),
    db.customerPrice.findMany({ where: { customerId, productId: { in: ids } } }),
  ]);
  const custom = new Map(overrides.map((o) => [o.productId, o.priceCents]));
  const priced = new Map<string, PricedProduct>(
    products.map((p) => [p.id, { ...p, priceCents: custom.get(p.id) ?? p.priceCents }]),
  );

  const built = buildLines(input.lines, priced);
  if ("error" in built) throw new DataError(built.error);

  // Two customers ordering at the same instant could grab the same order number; the unique index
  // rejects the second one, so we retry with the next number.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const last = await tx.order.findFirst({ where: { storeId }, orderBy: { number: "desc" }, select: { number: true } });
        return tx.order.create({
          data: {
            storeId,
            customerId,
            number: (last?.number ?? 1000) + 1,
            deliveryDate: input.deliveryDate ? new Date(`${input.deliveryDate}T12:00:00`) : null,
            notes: input.notes,
            subtotalCents: built.subtotalCents,
            lines: { create: built.lines },
          },
          select: { id: true, number: true },
        });
      });
    } catch (err) {
      if ((err as { code?: string }).code !== "P2002" || attempt === 4) throw err;
    }
  }
  throw new DataError("Couldn't place the order. Please try again.", 409);
}

/** Changes an order's status; null if the order isn't in this store. */
export async function setOrderStatus(ctx: StoreCtx, id: string, status: string) {
  const { storeId } = asManager(ctx);
  if (!ORDER_STATUSES.includes(status as OrderStatus)) throw new DataError("Unknown status.");
  const result = await db.order.updateMany({ where: { id, storeId }, data: { status } });
  return result.count === 0 ? null : { status };
}

/** Counts for the QuickBooks settings page. */
export async function syncCounts(ctx: StoreCtx) {
  const { storeId } = asManager(ctx);
  const [synced, waiting] = await Promise.all([
    db.order.count({ where: { storeId, qboSyncStatus: "synced" } }),
    db.order.count({ where: { storeId, qboSyncStatus: { in: ["not_connected", "failed"] }, status: { not: "cancelled" } } }),
  ]);
  return { synced, waiting };
}
