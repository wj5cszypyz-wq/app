// What a buyer sees: their store's active catalog with their own prices applied.
import { db } from "../db";
import type { StoreCtx } from "../scope";
import { asBuyer } from "./guard";

export async function loadStorefront(ctx: StoreCtx) {
  const { storeId, customerId } = asBuyer(ctx);
  const [products, overrides] = await Promise.all([
    db.product.findMany({ where: { storeId, active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.customerPrice.findMany({ where: { customerId } }),
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

/** Products this customer ordered recently, newest first ("Order again"). */
export async function orderAgainProductIds(ctx: StoreCtx): Promise<string[]> {
  const { storeId, customerId } = asBuyer(ctx);
  const rows = await db.orderLine.findMany({
    where: { order: { storeId, customerId } },
    select: { productId: true },
    distinct: ["productId"],
    take: 40,
    orderBy: { order: { createdAt: "desc" } },
  });
  return rows.map((r) => r.productId);
}

/** Names shown in the buyer's top bar. */
export async function buyerHeader(ctx: StoreCtx) {
  const { storeId, customerId } = asBuyer(ctx);
  const c = await db.customer.findFirstOrThrow({
    where: { id: customerId, storeId },
    select: { name: true, store: { select: { name: true } } },
  });
  return { customerName: c.name, storeName: c.store.name };
}
