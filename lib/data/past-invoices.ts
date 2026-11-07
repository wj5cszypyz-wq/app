// Optional: past QuickBooks invoices as read-only order history for customers in this store.
// Keyed by the QuickBooks invoice id (unique per store), so bringing them in again adds nothing twice.
import { db } from "../db";
import { listInvoicesSince } from "../qbo";
import type { StoreCtx } from "../scope";
import { DataError } from "./errors";
import { asBuyer, asManager } from "./guard";

type Line = { name: string; qty: number; amountCents: number; qboItemId: string | null };

export async function importPastInvoices(ctx: StoreCtx, since: string) {
  const { storeId } = asManager(ctx);
  const sinceDate = /^\d{4}-\d{2}-\d{2}$/.test(since) ? new Date(`${since}T00:00:00Z`) : null;
  const fiveYearsAgo = Date.now() - 5 * 366 * 86_400_000;
  if (!sinceDate || Number.isNaN(sinceDate.getTime()) || sinceDate.getTime() > Date.now() || sinceDate.getTime() < fiveYearsAgo) {
    throw new DataError("Pick a start date within the last 5 years.");
  }
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  if (!store.qboRealmId) throw new DataError("Connect QuickBooks first.", 409);
  const customers = await db.customer.findMany({ where: { storeId, qboCustomerId: { not: null } }, select: { id: true, qboCustomerId: true } });
  if (customers.length === 0) throw new DataError("Bring in or link customers first; past invoices are matched to them.");

  const ours = new Set(
    (await db.order.findMany({ where: { storeId, qboInvoiceId: { not: null } }, select: { qboInvoiceId: true } })).map((o) => o.qboInvoiceId),
  );
  const batch = await db.importBatch.create({ data: { storeId, kind: "invoices" } });
  let created = 0;
  for (const c of customers) {
    for (const inv of await listInvoicesSince(store, c.qboCustomerId!, since)) {
      if (ours.has(inv.Id)) continue; // already an order in this store
      const lines: Line[] = (inv.Line ?? [])
        .filter((l) => l.DetailType === "SalesItemLineDetail")
        .map((l) => ({
          name: (l.SalesItemLineDetail?.ItemRef?.name || l.Description || "Item").slice(0, 200),
          qty: Number(l.SalesItemLineDetail?.Qty ?? 1),
          amountCents: Math.round(Number(l.Amount ?? 0) * 100),
          qboItemId: l.SalesItemLineDetail?.ItemRef?.value ?? null,
        }));
      const exists = await db.pastInvoice.findUnique({ where: { storeId_qboInvoiceId: { storeId, qboInvoiceId: inv.Id } }, select: { id: true } });
      if (exists) continue;
      await db.pastInvoice
        .create({
          data: {
            storeId,
            customerId: c.id,
            qboInvoiceId: inv.Id,
            docNumber: inv.DocNumber ?? null,
            txnDate: new Date(`${inv.TxnDate}T12:00:00Z`),
            totalCents: Math.round(Number(inv.TotalAmt ?? 0) * 100),
            lines: JSON.stringify(lines),
            batchId: batch.id,
          },
        })
        .then(() => created++)
        .catch((err) => {
          if ((err as { code?: string }).code !== "P2002") throw err; // brought in at the same moment elsewhere
        });
    }
  }
  return { batchId: batch.id, created, linked: 0, updated: 0 };
}

/** The buyer's own past QuickBooks invoices, newest first, with each line matched to a product if possible. */
export async function listPastInvoices(ctx: StoreCtx) {
  const { storeId, customerId } = asBuyer(ctx);
  const rows = await db.pastInvoice.findMany({ where: { storeId, customerId }, orderBy: { txnDate: "desc" }, take: 50 });
  const itemIds = [...new Set(rows.flatMap((r) => (JSON.parse(r.lines) as Line[]).map((l) => l.qboItemId).filter((x): x is string => Boolean(x))))];
  const products = await db.product.findMany({ where: { storeId, active: true, qboItemId: { in: itemIds } }, select: { id: true, qboItemId: true } });
  const byItem = new Map(products.map((p) => [p.qboItemId, p.id]));
  return rows.map((r) => ({
    id: r.id,
    docNumber: r.docNumber,
    txnDate: r.txnDate,
    totalCents: r.totalCents,
    lines: (JSON.parse(r.lines) as Line[]).map((l) => ({ name: l.name, qty: l.qty, amountCents: l.amountCents, productId: (l.qboItemId && byItem.get(l.qboItemId)) || null })),
  }));
}
