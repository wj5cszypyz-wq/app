import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconBack } from "@/components/icons";
import { StatusChip } from "@/components/status";
import { requireSupplier } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney, formatQty } from "@/lib/money";
import { qboConfigured, qboInvoiceUrl } from "@/lib/qbo";
import { OrderControls } from "./order-controls";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSupplier();
  const { id } = await params;
  const order = await db.order.findFirst({
    where: { id, supplierId: s.supplierId },
    include: { lines: true, restaurant: true, supplier: { select: { qboRealmId: true } } },
  });
  if (!order) notFound();

  const placed = order.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const delivery = order.deliveryDate?.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <Link href="/supplier/orders" className="btn btn-ghost btn-sm" style={{ marginBottom: 14, marginLeft: -10 }}>
        <IconBack /> Orders
      </Link>
      <div className="page-head">
        <div>
          <div className="row" style={{ marginBottom: 8 }}>
            <StatusChip status={order.status} />
            <span className="muted" style={{ fontSize: 12.5 }}>Placed {placed}</span>
          </div>
          <h1>
            Order <span className="mono">#{order.number}</span> · {order.restaurant.name}
          </h1>
        </div>
      </div>

      <div className="detail-grid side-first">
        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h2>Items</h2>
              <span className="muted" style={{ fontSize: 12.5 }}>{order.lines.length} lines</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="right">Qty</th>
                    <th className="right hide-sm">Price</th>
                    <th className="right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div style={{ fontWeight: 550 }}>{l.name}</div>
                        <div className="dim mono" style={{ fontSize: 11.5 }}>{l.sku}{l.packSize ? ` · ${l.packSize}` : ""}</div>
                      </td>
                      <td className="right num">{formatQty(l.qty)} <span className="dim">{l.unit}</span></td>
                      <td className="right num hide-sm muted">{formatMoney(l.unitPriceCents)}</td>
                      <td className="right num" style={{ fontWeight: 600 }}>{formatMoney(l.lineTotalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="totals">
              <span className="eyebrow">Subtotal</span>
              <span className="num">{formatMoney(order.subtotalCents)}</span>
            </div>
          </div>

          {order.notes && (
            <div className="panel panel-pad stack" style={{ gap: 10 }}>
              <div className="eyebrow">Note from {order.restaurant.name}</div>
              <div className="note-box">{order.notes}</div>
            </div>
          )}
        </div>

        <div className="stack">
          <OrderControls
            orderId={order.id}
            status={order.status}
            sync={{
              status: order.qboSyncStatus,
              docNumber: order.qboDocNumber,
              invoiceId: order.qboInvoiceId,
              error: order.qboError,
              syncedAt: order.qboSyncedAt?.toISOString() ?? null,
              invoiceUrl: order.qboInvoiceId ? qboInvoiceUrl(order.qboInvoiceId) : null,
            }}
            connected={qboConfigured() && Boolean(order.supplier.qboRealmId)}
          />

          <div className="panel panel-pad stack" style={{ gap: 12 }}>
            <div className="eyebrow">Deliver to</div>
            <div>
              <div style={{ fontWeight: 600 }}>{order.restaurant.name}</div>
              {order.restaurant.address && <div className="muted">{order.restaurant.address}</div>}
            </div>
            <dl className="kv">
              <dt>Delivery</dt><dd>{delivery ?? "Next available"}</dd>
              {order.restaurant.contactName && (<><dt>Contact</dt><dd>{order.restaurant.contactName}</dd></>)}
              {order.restaurant.phone && (<><dt>Phone</dt><dd className="mono">{order.restaurant.phone}</dd></>)}
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
