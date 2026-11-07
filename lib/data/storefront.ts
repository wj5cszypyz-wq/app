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
    description: p.description,
    category: p.category,
    unit: p.unit,
    byWeight: p.byWeight,
    cover: coverId(p.imageIds),
    packSize: p.packSize,
    inStock: p.inStock,
    listPriceCents: p.priceCents,
    priceCents: custom.get(p.id) ?? p.priceCents,
  }));
}

function coverId(imageIds: string | null): string | null {
  try {
    const v = imageIds ? JSON.parse(imageIds) : [];
    return Array.isArray(v) && typeof v[0] === "string" ? v[0] : null;
  } catch {
    return null;
  }
}

/** Category names in the seller's order, with their emoji. */
export async function storefrontCategories(ctx: StoreCtx) {
  const { storeId } = asBuyer(ctx);
  return db.category.findMany({ where: { storeId }, orderBy: [{ sort: "asc" }, { name: "asc" }], select: { name: true, emoji: true } });
}

/** Store details shown at the top of the storefront. */
export async function storefrontIntro(ctx: StoreCtx) {
  const { storeId } = asBuyer(ctx);
  return db.store.findUniqueOrThrow({ where: { id: storeId }, select: { about: true, bannerId: true, fulfillment: true, phone: true } });
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
    select: { name: true, store: { select: { name: true, look: true, accent: true, logoId: true, fulfillment: true } } },
  });
  return { customerName: c.name, storeName: c.store.name, look: c.store.look, accent: c.store.accent, logoId: c.store.logoId, fulfillment: c.store.fulfillment };
}
