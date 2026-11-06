import type { Metadata } from "next";
import Link from "next/link";
import { requireSupplier } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { AddCustomer } from "./add-customer";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const s = await requireSupplier();
  const restaurants = await db.restaurant.findMany({
    where: { supplierId: s.supplierId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { orders: true, prices: true } },
      orders: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  const totals = await db.order.groupBy({
    by: ["restaurantId"],
    where: { supplierId: s.supplierId, status: { not: "cancelled" } },
    _sum: { subtotalCents: true },
  });
  const spend = new Map(totals.map((t) => [t.restaurantId, t._sum.subtotalCents ?? 0]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p>Restaurants that order from you. Each one gets its own login and, if you want, its own prices.</p>
        </div>
        <AddCustomer />
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Restaurant</th>
                <th className="hide-sm">Contact</th>
                <th className="right">Orders</th>
                <th className="right hide-sm">Lifetime</th>
                <th className="hide-sm">Pricing</th>
                <th className="hide-sm">QuickBooks</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/supplier/customers/${r.id}`} style={{ fontWeight: 600 }}>{r.name}</Link>
                    <div className="dim" style={{ fontSize: 11.5 }}>
                      {r.orders[0] ? `Last order ${r.orders[0].createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "No orders yet"}
                    </div>
                  </td>
                  <td className="hide-sm">
                    <div>{r.contactName}</div>
                    <div className="dim" style={{ fontSize: 11.5 }}>{r.email}</div>
                  </td>
                  <td className="right num">{r._count.orders}</td>
                  <td className="right num hide-sm">{formatMoney(spend.get(r.id) ?? 0)}</td>
                  <td className="hide-sm">
                    <Link href={`/supplier/customers/${r.id}`} className="btn btn-sm">
                      {r._count.prices ? `${r._count.prices} custom prices` : "List prices"}
                    </Link>
                  </td>
                  <td className="hide-sm">
                    <span className={`sync ${r.qboCustomerId ? "sync-synced" : "sync-not_connected"}`}>
                      {r.qboCustomerId ? "Linked" : "Created on first order"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {restaurants.length === 0 && <div className="empty"><h3>No customers yet</h3><p>Add your first restaurant to give them a login.</p></div>}
        </div>
      </div>
    </>
  );
}
