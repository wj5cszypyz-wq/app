// The store's catalog. Every read and write is limited to the signed-in seller's own store.
import { db } from "../db";
import type { StoreCtx } from "../scope";
import { DataError } from "./errors";
import type { ProductInput } from "../product-input";
import { isUnitKind, UNIT_KINDS, type UnitKind } from "../units";
import { ensureCategory } from "./categories";
import { assertOwnProductPhotos } from "./uploads";
import { asManager } from "./guard";

export type NewProduct = Required<Pick<ProductInput, "sku" | "name" | "category" | "unitKind" | "unit" | "priceCents">> & ProductInput;

export type ProductPatch = ProductInput;

function dbFields(input: ProductInput) {
  const { categoryEmoji: _emoji, imageIds, ...rest } = input;
  return { ...rest, ...(imageIds ? { imageIds: JSON.stringify(imageIds) } : {}) };
}

export async function listProducts(ctx: StoreCtx) {
  const { storeId } = asManager(ctx);
  return db.product.findMany({
    where: { storeId, active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true, sku: true, name: true, description: true, category: true, unit: true, unitKind: true,
      packCount: true, packAmount: true, packUnit: true, packSize: true, byWeight: true, priceCents: true, inStock: true, imageIds: true,
    },
  });
}

export async function createProduct(ctx: StoreCtx, input: NewProduct) {
  const { storeId } = asManager(ctx);
  const exists = await db.product.findUnique({ where: { storeId_sku: { storeId, sku: input.sku } } });
  if (exists) throw new DataError(`SKU ${input.sku} is already in your catalog.`);
  if (input.imageIds) await assertOwnProductPhotos(storeId, input.imageIds);
  await ensureCategory(ctx, input.category, input.categoryEmoji);
  try {
    return await db.product.create({ data: { storeId, ...dbFields(input) } as never });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new DataError(`SKU ${input.sku} is already in your catalog.`);
    throw err;
  }
}

/** Updates one product; null if it isn't in this store. */
export async function updateProduct(ctx: StoreCtx, id: string, patch: ProductPatch) {
  const { storeId } = asManager(ctx);
  const current = await db.product.findFirst({ where: { id, storeId } });
  if (!current) return null;
  const kind = (patch.unitKind ?? current.unitKind) as UnitKind;
  const unit = patch.unit ?? current.unit;
  if (!isUnitKind(kind) || !UNIT_KINDS[kind].units.includes(unit)) throw new DataError("Pick a unit that fits this kind of item.");
  if (patch.sku && patch.sku !== current.sku) {
    const clash = await db.product.findUnique({ where: { storeId_sku: { storeId, sku: patch.sku } } });
    if (clash) throw new DataError(`SKU ${patch.sku} is already in your catalog.`);
  }
  if (patch.imageIds) await assertOwnProductPhotos(storeId, patch.imageIds);
  if (patch.category) await ensureCategory(ctx, patch.category, patch.categoryEmoji);
  const result = await db.product.updateMany({ where: { id, storeId }, data: dbFields(patch) as never });
  return result.count === 0 ? null : patch;
}
