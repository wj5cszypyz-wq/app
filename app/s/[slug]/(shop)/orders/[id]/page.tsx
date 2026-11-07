import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconBack, IconCheck } from "@/components/icons";
import { StatusChip } from "@/components/status";
import { getOrderForBuyer } from "@/lib/data/orders";
import { formatMoney, formatQty } from "@/lib/money";
import { BUY, requireStorePage } from "@/lib/scope";
import { ReorderButton } from "../reorder-button";

export const metadata: Metadata = { title: "Order" };

export default async function BuyerOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const { slug, id } = await params;
  const ctx = await requireStorePage(slug, BUY);
  const { placed } = await searchParams;
  const order = await getOrderForBuyer(ctx, id);
  if (!order) notFound();

  return (
    <div className="main" style={{ maxWidth: 860, margin: "0 auto" }}>
      <Link href={`/s/${ctx.slug}/orders`} className="btn btn-ghost btn-sm" style={{ marginBottom: 14, marginLeft: -10 }}>
        <IconBack /> History
      </Link>

      {placed && (
        <div className="panel confirm-hero">
          <span className="confirm-ring"><IconCheck /></span>
          <div>
            <h2 style={{ fontSize: 20 }}>Order #{order.number} sent to {order.store.name}</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              They can see it right now. You'll get the invoice with your delivery.
            </p>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Order <span className="mono">#{order.number}</span></h2>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Placed {order.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              {order.deliveryDate && ` · Delivery ${order.deliveryDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`}
            </div>
          </div>
          <StatusChip status={order.status} />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Item</th><th className="right">Qty</th><th className="right hide-sm">Price</th><th className="right">Amount</th></tr></thead>
            <tbody>
              {order.lines.map((l) => (
                <tr key={l.id}>
                  <td><div style={{ fontWeight: 550 }}>{l.name}</div><div className="dim mono" style={{ fontSize: 11.5 }}>{l.sku}{l.packSize ? ` · ${l.packSize}` : ""}</div></td>
                  <td className="right num">{formatQty(l.qty)} <span className="dim">{l.unit}</span></td>
                  <td className="right num hide-sm muted">{formatMoney(l.unitPriceCents)}</td>
                  <td className="right num" style={{ fontWeight: 600 }}>{formatMoney(l.lineTotalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="totals">
          <ReorderButton cartKey={ctx.customerId!} lines={order.lines.map((l) => ({ productId: l.productId, qty: l.qty }))} />
          <span className="grow" />
          <span className="eyebrow">Total</span>
          <span className="num">{formatMoney(order.subtotalCents)}</span>
        </div>
      </div>
      {order.notes && <div className="note-box" style={{ marginTop: 14 }}>{order.notes}</div>}
      {order.store.phone && <p className="muted" style={{ fontSize: 12.5, marginTop: 16 }}>Questions? Call {order.store.name} at {order.store.phone}.</p>}
    </div>
  );
}
