import type { Metadata } from "next";
import Link from "next/link";
import { StatusChip } from "@/components/status";
import { listBuyerOrders } from "@/lib/data/orders";
import { listPastInvoices } from "@/lib/data/past-invoices";
import { formatMoney } from "@/lib/money";
import { BUY, requireStorePage } from "@/lib/scope";
import { ReorderButton } from "./reorder-button";

export const metadata: Metadata = { title: "Order history" };

export default async function HistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStorePage((await params).slug, BUY);
  const [orders, past] = await Promise.all([listBuyerOrders(ctx), listPastInvoices(ctx)]);

  return (
    <div className="main" style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div className="page-head">
        <div>
          <h1>Order history</h1>
          <p>Reorder anything in one tap. Prices update to today's.</p>
        </div>
      </div>
      <div className="panel">
        {orders.length === 0 ? (
          <div className="empty"><h3>No orders yet</h3><p><Link href={`/s/${ctx.slug}`} style={{ color: "var(--green)" }}>Place your first order</Link></p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Order</th><th className="hide-sm">Delivery</th><th>Status</th><th className="right">Total</th><th /></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/s/${ctx.slug}/orders/${o.id}`} className="order-no"><span>#</span>{o.number}</Link>
                      <div className="dim" style={{ fontSize: 11.5 }}>
                        {o.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {o.lines.length} items
                      </div>
                    </td>
                    <td className="hide-sm muted">
                      {o.deliveryDate?.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) ?? "—"}
                    </td>
                    <td><StatusChip status={o.status} /></td>
                    <td className="right num" style={{ fontWeight: 600 }}>{formatMoney(o.subtotalCents)}</td>
                    <td className="right"><ReorderButton cartKey={ctx.customerId!} lines={o.lines} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {past.length > 0 && (
        <div className="panel" style={{ marginTop: 18 }}>
          <div className="panel-head"><h2>Earlier orders</h2><span className="muted" style={{ fontSize: 12.5 }}>from the seller&apos;s QuickBooks</span></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Invoice</th><th className="hide-sm">Items</th><th className="right">Total</th><th /></tr></thead>
              <tbody>
                {past.map((p) => {
                  const reorder = p.lines.filter((l) => l.productId).map((l) => ({ productId: l.productId!, qty: l.qty }));
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.docNumber ? `#${p.docNumber}` : "Invoice"}</div>
                        <div className="dim" style={{ fontSize: 11.5 }}>{p.txnDate.toLocaleDateString(undefined, { dateStyle: "medium" })}</div>
                      </td>
                      <td className="hide-sm muted" style={{ overflowWrap: "anywhere" }}>{p.lines.map((l) => l.name).join(", ")}</td>
                      <td className="right num" style={{ fontWeight: 600 }}>{formatMoney(p.totalCents)}</td>
                      <td className="right">{reorder.length > 0 && <ReorderButton cartKey={ctx.customerId!} lines={reorder} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
