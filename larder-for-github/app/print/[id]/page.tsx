import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSupplier } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { db } from "@/lib/db";
import { formatMoney, formatQty } from "@/lib/money";
import { PrintToolbar } from "./toolbar";
import "../print.css";

export const metadata: Metadata = { title: "Print" };

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const s = await requireSupplier();
  const { id } = await params;
  const { doc } = await searchParams;
  const packing = doc === "packing";

  const order = await db.order.findFirst({
    where: { id, supplierId: s.supplierId },
    include: { lines: true, restaurant: true, supplier: true },
  });
  if (!order) notFound();

  const date = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const invoiceNo = order.qboDocNumber ?? `ORD-${order.number}`;

  return (
    <>
      <PrintToolbar orderId={order.id} packing={packing} />
      <article className="doc-page">
        <header className="doc-head">
          <div className="doc-from">
            <b>{order.supplier.name}</b>
            {order.supplier.address && <div>{order.supplier.address}</div>}
            {order.supplier.phone && <div>{order.supplier.phone}</div>}
            {order.supplier.email && <div>{order.supplier.email}</div>}
          </div>
          <div className="doc-title">
            <h1>{packing ? "PACKING SLIP" : "INVOICE"}</h1>
            <dl className="doc-meta">
              <dt>{packing ? "Order" : "Invoice"}</dt>
              <dd className="mono">{packing ? `#${order.number}` : invoiceNo}</dd>
              <dt>Date</dt>
              <dd>{date(order.createdAt)}</dd>
              {order.deliveryDate && (<><dt>{packing ? "Deliver" : "Due"}</dt><dd>{date(order.deliveryDate)}</dd></>)}
              {!packing && (<><dt>Order</dt><dd className="mono">#{order.number}</dd></>)}
            </dl>
          </div>
        </header>

        <section className="doc-parties">
          <div>
            <div className="doc-label">{packing ? "Deliver to" : "Bill to"}</div>
            <b>{order.restaurant.name}</b>
            {order.restaurant.contactName && <div>Attn: {order.restaurant.contactName}</div>}
            {order.restaurant.address && <div>{order.restaurant.address}</div>}
            {order.restaurant.phone && <div>{order.restaurant.phone}</div>}
          </div>
          <div>
            <div className="doc-label">{packing ? "Packed by" : "Ship to"}</div>
            {packing ? <span className="write" style={{ display: "inline-block", width: 180, borderBottom: "1px solid #999", height: 18 }} /> : (
              <>
                <b>{order.restaurant.name}</b>
                {order.restaurant.address && <div>{order.restaurant.address}</div>}
              </>
            )}
          </div>
        </section>

        <table className="doc-table">
          <thead>
            {packing ? (
              <tr><th style={{ width: 30 }}>✓</th><th>SKU</th><th>Item</th><th className="r">Ordered</th><th className="r">Packed</th></tr>
            ) : (
              <tr><th>SKU</th><th>Description</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr>
            )}
          </thead>
          <tbody>
            {order.lines.map((l) =>
              packing ? (
                <tr key={l.id}>
                  <td><span className="check" /></td>
                  <td className="mono">{l.sku}</td>
                  <td>{l.name}{l.packSize ? <span style={{ color: "#666" }}> · {l.packSize}</span> : null}</td>
                  <td className="r num"><b>{formatQty(l.qty)}</b> {l.unit}</td>
                  <td className="r"><span className="write" /></td>
                </tr>
              ) : (
                <tr key={l.id}>
                  <td className="mono">{l.sku}</td>
                  <td>{l.name}{l.packSize ? <span style={{ color: "#666" }}> · {l.packSize}</span> : null}</td>
                  <td className="r num">{formatQty(l.qty)} {l.unit}</td>
                  <td className="r num">{formatMoney(l.unitPriceCents)}</td>
                  <td className="r num">{formatMoney(l.lineTotalCents)}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>

        {!packing && (
          <div className="doc-total">
            <table>
              <tbody>
                <tr><td>Subtotal</td><td className="r num" style={{ textAlign: "right" }}>{formatMoney(order.subtotalCents)}</td></tr>
                <tr className="grand"><td>Balance due</td><td className="num" style={{ textAlign: "right" }}>{formatMoney(order.subtotalCents)}</td></tr>
              </tbody>
            </table>
          </div>
        )}

        {order.notes && <div className="doc-note"><b>Note:</b> {order.notes}</div>}

        {packing ? (
          <div className="doc-sign"><div>Received by (print &amp; sign)</div><div>Date / time</div></div>
        ) : (
          <div className="doc-foot">
            {order.qboDocNumber ? `QuickBooks invoice ${order.qboDocNumber}` : "Invoice generated from online order"} · Thank you for your business.
          </div>
        )}
        <div className="doc-foot" style={{ marginTop: 10 }}>Ordered online with {APP_NAME}</div>
      </article>
    </>
  );
}
