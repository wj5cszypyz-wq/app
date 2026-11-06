"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { IconSearch } from "@/components/icons";
import { Spinner } from "@/components/status";
import { useToast } from "@/components/toast";
import { formatMoney } from "@/lib/money";

type Product = { id: string; sku: string; name: string; category: string; unit: string; packSize: string | null; priceCents: number };

const toInput = (cents: number | undefined) => (cents === undefined ? "" : (cents / 100).toFixed(2));

export function PriceEditor(props: { restaurantId: string; products: Product[]; custom: Record<string, number> }) {
  const router = useRouter();
  const notify = useToast();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(props.products.map((p) => [p.id, toInput(props.custom[p.id])])),
  );
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const changed = props.products.filter((p) => values[p.id] !== toInput(props.custom[p.id]));
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return props.products.filter((p) => !n || `${p.name} ${p.sku}`.toLowerCase().includes(n));
  }, [props.products, q]);

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/supplier/customers/${props.restaurantId}/prices`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prices: changed.map((p) => ({ productId: p.id, price: values[p.id].trim() || null })) }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return notify("error", "Couldn't save prices", json.error);
    notify("success", "Prices saved", "New orders from this restaurant use them right away.");
    router.refresh();
  }

  return (
    <div className="panel">
      <div className="panel-head wrap">
        <div className="search grow" style={{ maxWidth: 420 }}>
          <IconSearch />
          <input className="input" style={{ height: 38, fontSize: 14 }} placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="row">
          <span className="muted" style={{ fontSize: 12.5 }}>{changed.length ? `${changed.length} unsaved` : "Leave blank to use list price"}</span>
          <button className="btn btn-primary" disabled={!changed.length || busy} onClick={save}>
            {busy ? <Spinner /> : "Save prices"}
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="right">List price</th>
              <th className="right">Their price</th>
              <th className="right hide-sm">Difference</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const v = values[p.id];
              const cents = v.trim() ? Math.round(Number(v) * 100) : null;
              const diff = cents !== null && Number.isFinite(cents) ? cents - p.priceCents : null;
              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 550 }}>{p.name}</div>
                    <div className="dim mono" style={{ fontSize: 11.5 }}>{p.sku} · per {p.unit}</div>
                  </td>
                  <td className="right num muted">{formatMoney(p.priceCents)}</td>
                  <td className="right">
                    <input
                      className="input input-money"
                      style={{ width: 110, height: 34, marginLeft: "auto", borderColor: v !== toInput(props.custom[p.id]) ? "var(--green)" : undefined }}
                      inputMode="decimal"
                      placeholder={(p.priceCents / 100).toFixed(2)}
                      aria-label={`Custom price for ${p.name}`}
                      value={v}
                      onChange={(e) => setValues({ ...values, [p.id]: e.target.value })}
                    />
                  </td>
                  <td className="right num hide-sm" style={{ color: diff === null ? "var(--dim)" : diff < 0 ? "var(--green)" : diff > 0 ? "var(--orange)" : "var(--muted)" }}>
                    {diff === null ? "—" : `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${formatMoney(Math.abs(diff))}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
