// Turns an order into a QuickBooks invoice. Never throws: the result is recorded on the order
// so the supplier can see exactly what happened and retry.
import { db } from "./db";
import { buildInvoicePayload } from "./invoice";
import { isoDate } from "./orders";
import { createInvoice, ensureCustomer, ensureIncomeAccount, ensureItem, qboConfigured } from "./qbo";

export async function syncOrderToQuickBooks(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: true } }, restaurant: true, supplier: true },
  });
  if (!order) return null;
  if (order.qboInvoiceId) return order;

  if (!qboConfigured() || !order.supplier.qboRealmId) {
    return db.order.update({ where: { id: orderId }, data: { qboSyncStatus: "not_connected", qboError: null } });
  }

  try {
    const supplier = order.supplier;
    const incomeAccountId = await ensureIncomeAccount(supplier);
    const customerId = await ensureCustomer(supplier, order.restaurant);

    const itemIds = new Map<string, string>();
    for (const line of order.lines) {
      if (!itemIds.has(line.productId)) {
        itemIds.set(line.productId, await ensureItem(supplier, line.product, incomeAccountId));
      }
    }

    const payload = buildInvoicePayload({
      orderNumber: order.number,
      customerId,
      txnDate: isoDate(order.createdAt),
      dueDate: order.deliveryDate ? isoDate(order.deliveryDate) : null,
      notes: order.notes,
      lines: order.lines.map((l) => ({
        itemId: itemIds.get(l.productId)!,
        description: [l.name, l.packSize, `per ${l.unit}`].filter(Boolean).join(" · "),
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
        lineTotalCents: l.lineTotalCents,
      })),
    });

    const invoice = await createInvoice(supplier, payload, `order-${order.id}`);
    return db.order.update({
      where: { id: orderId },
      data: {
        qboSyncStatus: "synced",
        qboInvoiceId: invoice.Id,
        qboDocNumber: invoice.DocNumber ?? null,
        qboSyncedAt: new Date(),
        qboError: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[qbo] order ${order.number} failed:`, message);
    return db.order.update({
      where: { id: orderId },
      data: { qboSyncStatus: "failed", qboError: message.slice(0, 500) },
    });
  }
}
