// Change history with undo and redo. Each change stores the fields it touched before and after.
// Undo puts "before" back only if nothing has changed those fields since, then records itself as a
// new change, so undoing the undo (redo) works the same way.
import type { Prisma } from "@prisma/client";
import { db } from "../db";

type Client = Prisma.TransactionClient | typeof db;
import type { StoreCtx } from "../scope";
import { asManager } from "./guard";

export type Entity = "product" | "customerPrices" | "store";
type Fields = Record<string, unknown>;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export async function recordChange(
  ctx: StoreCtx,
  e: { entity: Entity; entityId: string; action: "create" | "update" | "undo"; summary: string; before: Fields; after: Fields; undoOfId?: string },
): Promise<string> {
  const user = await db.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
  const row = await db.changeLog.create({
    data: {
      storeId: ctx.storeId,
      userId: ctx.userId,
      userName: user?.name ?? "",
      entity: e.entity,
      entityId: e.entityId,
      action: e.action,
      summary: e.summary.slice(0, 200),
      before: JSON.stringify(e.before),
      after: JSON.stringify(e.after),
      undoOfId: e.undoOfId ?? null,
    },
  });
  return row.id;
}

/** Reads the current values of the given fields (null if the thing no longer exists in this store). */
async function current(tx: Client, entity: Entity, storeId: string, entityId: string, keys: string[]): Promise<Fields | null> {
  if (entity === "product") {
    const p = await tx.product.findFirst({ where: { id: entityId, storeId } });
    return p ? Object.fromEntries(keys.map((k) => [k, (p as Record<string, unknown>)[k]])) : null;
  }
  if (entity === "store") {
    const s = await tx.store.findUnique({ where: { id: storeId } });
    return s && s.id === entityId ? Object.fromEntries(keys.map((k) => [k, (s as Record<string, unknown>)[k]])) : null;
  }
  const customer = await tx.customer.findFirst({ where: { id: entityId, storeId }, select: { id: true } });
  if (!customer) return null;
  const rows = await tx.customerPrice.findMany({ where: { customerId: entityId, productId: { in: keys } } });
  const map = new Map(rows.map((r) => [r.productId, r.priceCents]));
  return Object.fromEntries(keys.map((k) => [k, map.get(k) ?? null]));
}

async function apply(tx: Client, entity: Entity, storeId: string, entityId: string, values: Fields) {
  if (entity === "product") {
    await tx.product.updateMany({ where: { id: entityId, storeId }, data: values });
  } else if (entity === "store") {
    await tx.store.update({ where: { id: storeId }, data: values });
  } else {
    for (const [productId, cents] of Object.entries(values)) {
      if (cents === null) await tx.customerPrice.deleteMany({ where: { customerId: entityId, productId } });
      else
        await tx.customerPrice.upsert({
          where: { customerId_productId: { customerId: entityId, productId } },
          create: { customerId: entityId, productId, priceCents: Number(cents) },
          update: { priceCents: Number(cents) },
        });
    }
  }
}

/** Undo (or redo, when given an undo) one change. Null if it isn't this store's change. */
export async function undoChange(ctx: StoreCtx, changeId: string): Promise<{ ok: true; changeId: string } | { ok: false; error: string } | null> {
  const { storeId } = asManager(ctx);
  if (typeof changeId !== "string") return null;
  const change = await db.changeLog.findFirst({ where: { id: changeId, storeId } });
  if (!change) return null;
  if (change.entity === "store" && ctx.role !== "owner") return { ok: false, error: "Only the store owner can undo changes to store settings." };
  if (change.undoneAt) return { ok: false, error: "That change was already undone." };

  const before = JSON.parse(change.before) as Fields;
  const after = JSON.parse(change.after) as Fields;
  // Check, put back and mark as undone together: if anything fails, nothing changes and it can be retried.
  const outcome = await db.$transaction(async (tx) => {
    const now = await current(tx, change.entity as Entity, storeId, change.entityId, Object.keys(after));
    if (!now) return { ok: false as const, error: "That item no longer exists." };
    if (!Object.keys(after).every((k) => same(now[k], after[k]))) {
      return { ok: false as const, error: "This was changed again after that. Undo the later change first." };
    }
    const claimed = await tx.changeLog.updateMany({ where: { id: change.id, undoneAt: null }, data: { undoneAt: new Date() } });
    if (claimed.count !== 1) return { ok: false as const, error: "That change was already undone." };
    await apply(tx, change.entity as Entity, storeId, change.entityId, before);
    return { ok: true as const };
  });
  if (!outcome.ok) return outcome;

  const id = await recordChange(ctx, {
    entity: change.entity as Entity,
    entityId: change.entityId,
    action: "undo",
    summary: change.action === "undo" ? change.summary.replace(/^Undid: /, "") : `Undid: ${change.summary}`,
    before: after,
    after: before,
    undoOfId: change.id,
  });
  return { ok: true, changeId: id };
}

export async function listHistory(ctx: StoreCtx, limit = 100) {
  const { storeId } = asManager(ctx);
  return db.changeLog.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, summary: true, userName: true, createdAt: true, undoneAt: true, entity: true, action: true },
  });
}
