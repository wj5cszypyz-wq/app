// The store's catalog. Every read and write is limited to the signed-in seller's own store.
import { db } from "../db";
import type { StoreCtx } from "../scope";
import { DataError } from "./errors";
import { asManager } from "./guard";

export type NewProduct = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  packSize: string | null;
  priceCents: number;
};

export type ProductPatch = { priceCents?: number; inStock?: boolean; active?: boolean };

export async function listProducts(ctx: StoreCtx) {
  const { storeId } = asManager(ctx);
  return db.product.findMany({
    where: { storeId, active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, sku: true, name: true, category: true, unit: true, packSize: true, priceCents: true, inStock: true },
  });
}

export async function createProduct(ctx: StoreCtx, input: NewProduct) {
  const { storeId } = asManager(ctx);
  const exists = await db.product.findUnique({ where: { storeId_sku: { storeId, sku: input.sku } } });
  if (exists) throw new DataError(`SKU ${input.sku} is already in your catalog.`);
  try {
    return await db.product.create({ data: { storeId, ...input } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new DataError(`SKU ${input.sku} is already in your catalog.`);
    throw err;
  }
}

/** Updates one product; null if it isn't in this store. */
export async function updateProduct(ctx: StoreCtx, id: string, patch: ProductPatch) {
  const { storeId } = asManager(ctx);
  const result = await db.product.updateMany({ where: { id, storeId }, data: patch });
  return result.count === 0 ? null : patch;
}
