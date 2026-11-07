import type { Metadata } from "next";
import Link from "next/link";
import { listCustomers } from "@/lib/data/customers";
import { formatMoney } from "@/lib/money";
import { MANAGE, requireStorePage } from "@/lib/scope";
import { AddCustomer } from "./add-customer";
import { ResendInvite } from "./resend-invite";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStorePage((await params).slug, MANAGE);
  const customers = await listCustomers(ctx);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p>Businesses and people who order from you. Each one gets its own login and, if you want, its own prices.</p>
        </div>
        <AddCustomer />
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="hide-sm">Contact</th>
                <th className="right">Orders</th>
                <th className="right hide-sm">Lifetime</th>
                <th className="hide-sm">Pricing</th>
                <th className="hide-sm">QuickBooks</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/s/${ctx.slug}/manage/customers/${r.id}`} style={{ fontWeight: 600 }}>{r.name}</Link>
                    <div className="dim" style={{ fontSize: 11.5 }}>
                      {r.orders[0] ? `Last order ${r.orders[0].createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "No orders yet"}
                    </div>
                  </td>
                  <td className="hide-sm">
                    <div>{r.contactName}</div>
                    <div className="dim" style={{ fontSize: 11.5, overflowWrap: "anywhere" }}>{r.email}</div>
                    {!r.hasLogin && <div style={{ marginTop: 6 }}><ResendInvite customerId={r.id} /></div>}
                  </td>
                  <td className="right num">{r._count.orders}</td>
                  <td className="right num hide-sm">{formatMoney(r.spendCents)}</td>
                  <td className="hide-sm">
                    <Link href={`/s/${ctx.slug}/manage/customers/${r.id}`} className="btn btn-sm">
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
          {customers.length === 0 && <div className="empty"><h3>No customers yet</h3><p>Add your first customer to give them a login.</p></div>}
        </div>
      </div>
    </>
  );
}
