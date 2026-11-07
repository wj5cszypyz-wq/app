// "Bring in from QuickBooks": preview, import (create / link / update) and undo.
// Products and customers keep their QuickBooks id, which is unique per store, so running an import
// again updates them instead of making copies. Undo never touches QuickBooks.
import { db } from "../db";
import { listAllCustomers, listAllItems, type QboCustomer, type QboItem } from "../qbo";
import type { StoreCtx } from "../scope";
import { ensureCategory } from "./categories";
import { DataError } from "./errors";
import { asManager } from "./guard";

export type ImportKind = "items" | "customers";
export type PreviewRow = {
  qboId: string;
  name: string;
  detail: string;
  status: "new" | "match" | "linked";
};

async function connectedStore(ctx: StoreCtx) {
  asManager(ctx);
  const store = await db.store.findUniqueOrThrow({ where: { id: ctx.storeId } });
  if (!store.qboRealmId) throw new DataError("Connect QuickBooks first.", 409);
  return store;
}

const money = (n: number | undefined) => (typeof n === "number" ? `$${n.toFixed(2)}` : "no price");
const splitName = (i: QboItem) => {
  const full = i.FullyQualifiedName ?? i.Name;
  const parts = full.split(":");
  return { name: parts.at(-1)!.trim().slice(0, 120), category: parts.length > 1 ? parts.at(-2)!.trim().slice(0, 60) : "From QuickBooks" };
};
const contactOf = (c: QboCustomer) => [c.GivenName, c.FamilyName].filter(Boolean).join(" ") || null;
const addressOf = (c: QboCustomer) =>
  [c.BillAddr?.Line1, c.BillAddr?.City, c.BillAddr?.CountrySubDivisionCode, c.BillAddr?.PostalCode].filter(Boolean).join(", ") || null;

export async function previewImport(ctx: StoreCtx, kind: ImportKind): Promise<PreviewRow[]> {
  const store = await connectedStore(ctx);
  if (kind === "items") {
    const [items, products] = await Promise.all([
      listAllItems(store),
      db.product.findMany({ where: { storeId: store.id }, select: { qboItemId: true, sku: true } }),
    ]);
    const linked = new Set(products.map((p) => p.qboItemId).filter(Boolean));
    const unlinkedSkus = new Set(products.filter((p) => !p.qboItemId).map((p) => p.sku));
    return items.map((i) => ({
      qboId: i.Id,
      name: splitName(i).name,
      detail: [i.Sku ? `SKU ${i.Sku}` : null, money(i.UnitPrice), i.Type === "Inventory" && typeof i.QtyOnHand === "number" ? `${i.QtyOnHand} on hand` : null].filter(Boolean).join(" · "),
      status: linked.has(i.Id) ? "linked" : i.Sku && unlinkedSkus.has(i.Sku.toUpperCase()) ? "match" : "new",
    }));
  }
  const [customers, ours] = await Promise.all([
    listAllCustomers(store),
    db.customer.findMany({ where: { storeId: store.id }, select: { qboCustomerId: true, name: true } }),
  ]);
  const linked = new Set(ours.map((c) => c.qboCustomerId).filter(Boolean));
  const unlinkedNames = new Set(ours.filter((c) => !c.qboCustomerId).map((c) => c.name.toLowerCase()));
  return customers.map((c) => ({
    qboId: c.Id,
    name: c.DisplayName,
    detail: [contactOf(c), c.PrimaryEmailAddr?.Address].filter(Boolean).join(" · "),
    status: linked.has(c.Id) ? "linked" : unlinkedNames.has(c.DisplayName.toLowerCase()) ? "match" : "new",
  }));
}

async function freeSku(storeId: string, wanted: string): Promise<string> {
  const base = wanted.toUpperCase().replace(/[^A-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "QB";
  for (let n = 0; n < 1000; n++) {
    const sku = n ? `${base}-${n + 1}` : base;
    if (!(await db.product.findUnique({ where: { storeId_sku: { storeId, sku } }, select: { id: true } }))) return sku;
  }
  throw new DataError("Couldn't find a free SKU for an imported item.");
}

export async function importFromQbo(ctx: StoreCtx, kind: ImportKind, ids: string[]) {
  const store = await connectedStore(ctx);
  const wanted = new Set(ids.filter((x) => typeof x === "string").slice(0, 5000));
  if (wanted.size === 0) throw new DataError("Pick at least one row to bring in.");
  const created: string[] = [];
  const updated: { id: string; before: Record<string, unknown>; after: Record<string, unknown> }[] = [];
  let linked = 0;

  if (kind === "items") {
    const items = (await listAllItems(store)).filter((i) => wanted.has(i.Id));
    for (const i of items) {
      const { name, category } = splitName(i);
      const priceCents = Math.max(0, Math.round((i.UnitPrice ?? 0) * 100));
      const existing = await db.product.findUnique({ where: { storeId_qboItemId: { storeId: store.id, qboItemId: i.Id } } });
      if (existing) {
        const data = { name, priceCents: priceCents || existing.priceCents, description: i.Description ?? existing.description };
        updated.push({ id: existing.id, before: { name: existing.name, priceCents: existing.priceCents, description: existing.description }, after: data });
        await db.product.update({ where: { id: existing.id }, data });
        continue;
      }
      const skuMatch = i.Sku ? await db.product.findUnique({ where: { storeId_sku: { storeId: store.id, sku: i.Sku.toUpperCase() } } }) : null;
      if (skuMatch && !skuMatch.qboItemId) {
        updated.push({ id: skuMatch.id, before: { qboItemId: null }, after: { qboItemId: i.Id } });
        await db.product.update({ where: { id: skuMatch.id }, data: { qboItemId: i.Id } });
        linked++;
        continue;
      }
      await ensureCategory(ctx, category);
      const p = await db.product.create({
        data: {
          storeId: store.id,
          qboItemId: i.Id,
          sku: await freeSku(store.id, i.Sku || name),
          name,
          description: i.Description?.slice(0, 2000) || null,
          category,
          unit: "each",
          unitKind: "count",
          priceCents,
          inStock: priceCents > 0, // no price in QuickBooks: hidden from ordering until the seller sets one
        },
      });
      created.push(p.id);
    }
  } else {
    const customers = (await listAllCustomers(store)).filter((c) => wanted.has(c.Id));
    for (const c of customers) {
      const existing = await db.customer.findUnique({ where: { storeId_qboCustomerId: { storeId: store.id, qboCustomerId: c.Id } } });
      const data = {
        name: c.DisplayName.slice(0, 120),
        contactName: contactOf(c),
        email: c.PrimaryEmailAddr?.Address?.toLowerCase().slice(0, 254) ?? null,
        phone: c.PrimaryPhone?.FreeFormNumber?.slice(0, 40) ?? null,
        address: addressOf(c)?.slice(0, 300) ?? null,
      };
      if (existing) {
        updated.push({ id: existing.id, before: { name: existing.name, contactName: existing.contactName, email: existing.email, phone: existing.phone, address: existing.address }, after: data });
        await db.customer.update({ where: { id: existing.id }, data });
        continue;
      }
      const sameName = await db.customer.findFirst({ where: { storeId: store.id, qboCustomerId: null, name: c.DisplayName } });
      if (sameName) {
        updated.push({ id: sameName.id, before: { qboCustomerId: null }, after: { qboCustomerId: c.Id } });
        await db.customer.update({ where: { id: sameName.id }, data: { qboCustomerId: c.Id } });
        linked++;
        continue;
      }
      const row = await db.customer.create({ data: { storeId: store.id, qboCustomerId: c.Id, ...data } });
      created.push(row.id);
    }
  }

  const batch = await db.importBatch.create({
    data: { storeId: store.id, kind, created: JSON.stringify(created), updated: JSON.stringify(updated) },
  });
  return { batchId: batch.id, created: created.length, linked, updated: updated.length - linked };
}

/** Undoes an import: removes what it created (archives anything already ordered), restores what it changed. */
export async function undoImport(ctx: StoreCtx, batchId: string) {
  const { storeId } = asManager(ctx);
  const claimed = await db.importBatch.updateMany({ where: { id: batchId, storeId, undoneAt: null }, data: { undoneAt: new Date() } });
  if (claimed.count !== 1) return null;
  const batch = await db.importBatch.findUniqueOrThrow({ where: { id: batchId } });
  const created: string[] = JSON.parse(batch.created);
  const updated: { id: string; before: Record<string, unknown>; after?: Record<string, unknown> }[] = JSON.parse(batch.updated);
  // Only put back fields that still hold what the import set; anything edited since stays as it is.
  const stillImported = (row: Record<string, unknown> | null, u: (typeof updated)[number]) =>
    Object.fromEntries(
      Object.entries(u.before).filter(([k]) => !u.after || JSON.stringify(row?.[k] ?? null) === JSON.stringify(u.after[k] ?? null)),
    );
  let removed = 0;
  let archived = 0;
  let kept = 0;

  if (batch.kind === "items") {
    for (const id of created) {
      const used = await db.orderLine.count({ where: { productId: id } });
      if (used) {
        await db.product.updateMany({ where: { id, storeId }, data: { active: false } });
        archived++;
      } else {
        removed += (await db.product.deleteMany({ where: { id, storeId } })).count;
      }
    }
    for (const u of updated) {
      const row = await db.product.findFirst({ where: { id: u.id, storeId } });
      const data = stillImported(row as Record<string, unknown> | null, u);
      if (Object.keys(data).length) await db.product.updateMany({ where: { id: u.id, storeId }, data });
    }
  } else if (batch.kind === "customers") {
    for (const id of created) {
      const busy = (await db.order.count({ where: { customerId: id } })) + (await db.membership.count({ where: { customerId: id } }));
      if (busy) kept++;
      else removed += (await db.customer.deleteMany({ where: { id, storeId } })).count;
    }
    for (const u of updated) {
      const row = await db.customer.findFirst({ where: { id: u.id, storeId } });
      const data = stillImported(row as Record<string, unknown> | null, u);
      if (Object.keys(data).length) await db.customer.updateMany({ where: { id: u.id, storeId }, data });
    }
  } else if (batch.kind === "invoices") {
    removed = (await db.pastInvoice.deleteMany({ where: { batchId, storeId } })).count;
  }
  return { removed, archived, kept, restored: updated.length };
}

export async function recentImports(ctx: StoreCtx) {
  const { storeId } = asManager(ctx);
  const rows = await db.importBatch.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 10 });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    createdAt: r.createdAt.toISOString(),
    undone: Boolean(r.undoneAt),
    created: (JSON.parse(r.created) as string[]).length,
    updated: (JSON.parse(r.updated) as unknown[]).length,
  }));
}
