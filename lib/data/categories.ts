// A store's own categories (name + emoji), in the order the seller set.
import { db } from "../db";
import type { StoreCtx } from "../scope";
import { asManager } from "./guard";

export async function listCategories(ctx: StoreCtx) {
  return db.category.findMany({ where: { storeId: ctx.storeId }, orderBy: [{ sort: "asc" }, { name: "asc" }] });
}

/** Makes sure a category exists for this store (creating it at the end of the list). */
export async function ensureCategory(ctx: StoreCtx, name: string, emoji?: string | null) {
  const { storeId } = asManager(ctx);
  const existing = await db.category.findUnique({ where: { storeId_name: { storeId, name } } });
  if (existing) {
    if (emoji && emoji !== existing.emoji) await db.category.update({ where: { id: existing.id }, data: { emoji } });
    return;
  }
  const last = await db.category.findFirst({ where: { storeId }, orderBy: { sort: "desc" }, select: { sort: true } });
  await db.category
    .create({ data: { storeId, name, emoji: emoji || "📦", sort: (last?.sort ?? 0) + 1 } })
    .catch((err) => {
      if ((err as { code?: string }).code !== "P2002") throw err; // created at the same moment by another request
    });
}
