import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconBack } from "@/components/icons";
import { StatusChip } from "@/components/status";
import { getOrderForStore } from "@/lib/data/orders";
import { formatMoney, formatQty } from "@/lib/money";
import { qboConfigured, qboInvoiceUrl } from "@/lib/qbo";
import { MANAGE, requireStorePage } from "@/lib/scope";
import { OrderControls } from "./order-controls";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requireStorePage(slug, MANAGE);
  const order = await getOrderForStore(ctx, id);
  if (!order) notFound();

  const placed = order.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const delivery = order.deliveryDate?.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <Link href={`/s/${ctx.slug}/manage/orders`} className="btn btn-ghost btn-sm" style={{ marginBottom: 14, marginLeft: -10 }}>
        <IconBack /> Orders
      </Link>
      <div className="page-head">
        <div>
          <div className="row" style={{ marginBottom: 8 }}>
            <StatusChip status={order.status} />
            <span className="muted" style={{ fontSize: 12.5 }}>Placed {placed}</span>
          </div>
          <h1>
            Order <span className="mono">#{order.number}</span> · {order.customer.name}
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
              <div className="eyebrow">Note from {order.customer.name}</div>
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
            connected={qboConfigured() && Boolean(order.store.qboRealmId)}
          />

          <div className="panel panel-pad stack" style={{ gap: 12 }}>
            <div className="eyebrow">Deliver to</div>
            <div>
              <div style={{ fontWeight: 600 }}>{order.customer.name}</div>
              {order.customer.address && <div className="muted">{order.customer.address}</div>}
            </div>
            <dl className="kv">
              <dt>Delivery</dt><dd>{delivery ?? "Next available"}</dd>
              {order.customer.contactName && (<><dt>Contact</dt><dd>{order.customer.contactName}</dd></>)}
              {order.customer.phone && (<><dt>Phone</dt><dd className="mono">{order.customer.phone}</dd></>)}
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
