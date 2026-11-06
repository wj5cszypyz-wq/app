import type { Metadata } from "next";
import Link from "next/link";
import { StatusChip } from "@/components/status";
import { requireBuyer } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { ReorderButton } from "./reorder-button";

export const metadata: Metadata = { title: "Order history" };

export default async function HistoryPage() {
  const s = await requireBuyer();
  const orders = await db.order.findMany({
    where: { restaurantId: s.restaurantId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { lines: { select: { productId: true, qty: true } } },
  });

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
          <div className="empty"><h3>No orders yet</h3><p><Link href="/shop" style={{ color: "var(--green)" }}>Place your first order</Link></p></div>
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
                      <Link href={`/shop/orders/${o.id}`} className="order-no"><span>#</span>{o.number}</Link>
                      <div className="dim" style={{ fontSize: 11.5 }}>
                        {o.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {o.lines.length} items
                      </div>
                    </td>
                    <td className="hide-sm muted">
                      {o.deliveryDate?.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) ?? "—"}
                    </td>
                    <td><StatusChip status={o.status} /></td>
                    <td className="right num" style={{ fontWeight: 600 }}>{formatMoney(o.subtotalCents)}</td>
                    <td className="right"><ReorderButton restaurantId={s.restaurantId} lines={o.lines} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
