import { db } from "./db";

export type OrderRow = {
  id: string;
  number: number;
  restaurant: string;
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

/** Orders + headline numbers for the supplier's live board. */
export async function loadBoard(supplierId: string, filter: string) {
  const where =
    filter === "open"
      ? { supplierId, status: { in: ["new", "packing", "ready"] } }
      : filter === "done"
        ? { supplierId, status: { in: ["delivered", "cancelled"] } }
        : { supplierId };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [orders, today, openCount, syncIssues] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { restaurant: { select: { name: true } }, _count: { select: { lines: true } } },
    }),
    db.order.aggregate({
      where: { supplierId, createdAt: { gte: startOfDay }, status: { not: "cancelled" } },
      _count: true,
      _sum: { subtotalCents: true },
    }),
    db.order.count({ where: { supplierId, status: { in: ["new", "packing", "ready"] } } }),
    db.order.count({ where: { supplierId, qboSyncStatus: "failed", status: { not: "cancelled" } } }),
  ]);

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    number: o.number,
    restaurant: o.restaurant.name,
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

/** Catalog with this restaurant's prices applied. */
export async function loadStorefront(supplierId: string, restaurantId: string) {
  const [products, overrides] = await Promise.all([
    db.product.findMany({ where: { supplierId, active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.customerPrice.findMany({ where: { restaurantId } }),
  ]);
  const custom = new Map(overrides.map((o) => [o.productId, o.priceCents]));
  return products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    unit: p.unit,
    packSize: p.packSize,
    inStock: p.inStock,
    listPriceCents: p.priceCents,
    priceCents: custom.get(p.id) ?? p.priceCents,
  }));
}

export type StoreProduct = Awaited<ReturnType<typeof loadStorefront>>[number];
