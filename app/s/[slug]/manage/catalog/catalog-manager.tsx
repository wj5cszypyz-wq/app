"use client";

import { useMemo, useState, type FormEvent } from "react";
import { IconPlus, IconSearch, IconX } from "@/components/icons";
import { Spinner } from "@/components/status";
import { useToast } from "@/components/toast";
import { CATEGORIES, UNITS, categoriesOf } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { useStorePaths } from "@/components/use-store";

type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  packSize: string | null;
  priceCents: number;
  inStock: boolean;
};

async function patch(url: string, body: object) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Update failed");
  return json;
}

function PriceCell({ p, onSaved }: { p: Product; onSaved: (cents: number) => void }) {
  const notify = useToast();
  const paths = useStorePaths();
  const [value, setValue] = useState((p.priceCents / 100).toFixed(2));
  const [saving, setSaving] = useState(false);

  async function commit() {
    const cents = Math.round(Number(value) * 100);
    if (cents === p.priceCents) return;
    if (!Number.isFinite(cents) || cents <= 0) {
      setValue((p.priceCents / 100).toFixed(2));
      return notify("error", "Enter a valid price");
    }
    setSaving(true);
    try {
      await patch(paths.api(`/manage/products/${p.id}`), { price: value });
      onSaved(cents);
      notify("success", `${p.name}`, `Price set to ${formatMoney(cents)} / ${p.unit}`);
    } catch (e) {
      setValue((p.priceCents / 100).toFixed(2));
      notify("error", "Couldn't save price", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
      <span className="dim mono">$</span>
      <input
        className="input input-money"
        style={{ width: 96, height: 34, opacity: saving ? 0.5 : 1 }}
        inputMode="decimal"
        aria-label={`Price for ${p.name}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <span className="dim" style={{ fontSize: 12, width: 38 }}>/{p.unit}</span>
    </div>
  );
}

export function CatalogManager({ initial }: { initial: Product[] }) {
  const notify = useToast();
  const paths = useStorePaths();
  const [products, setProducts] = useState(initial);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ sku: "", name: "", category: CATEGORIES[0] as string, unit: "case", packSize: "", price: "" });

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter(
      (p) => (cat === "All" || p.category === cat) && (!needle || `${p.name} ${p.sku}`.toLowerCase().includes(needle)),
    );
  }, [products, q, cat]);

  const update = (id: string, change: Partial<Product>) =>
    setProducts((all) => all.map((p) => (p.id === id ? { ...p, ...change } : p)));

  async function toggleStock(p: Product) {
    update(p.id, { inStock: !p.inStock });
    try {
      await patch(paths.api(`/manage/products/${p.id}`), { inStock: !p.inStock });
      notify("success", p.name, !p.inStock ? "Back in stock" : "Marked out of stock. Customers can't order it.");
    } catch (e) {
      update(p.id, { inStock: p.inStock });
      notify("error", "Couldn't update stock", e instanceof Error ? e.message : undefined);
    }
  }

  async function archive(p: Product) {
    if (!confirm(`Remove ${p.name} from your catalog? Past orders keep it.`)) return;
    try {
      await patch(paths.api(`/manage/products/${p.id}`), { active: false });
      setProducts((all) => all.filter((x) => x.id !== p.id));
      notify("success", "Product removed", p.name);
    } catch (e) {
      notify("error", "Couldn't remove product", e instanceof Error ? e.message : undefined);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(paths.api("/manage/products"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return notify("error", "Couldn't add product", json.error);
    setProducts((all) => [...all, json.product].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));
    setForm({ ...form, sku: "", name: "", packSize: "", price: "" });
    notify("success", "Product added", json.product.name);
  }

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return m;
  }, [products]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Catalog</h1>
          <p>{products.length} products. Prices here are your list prices; set special prices per customer under Customers.</p>
        </div>
        <button className={`btn ${adding ? "" : "btn-primary"}`} onClick={() => setAdding((a) => !a)}>
          {adding ? <><IconX /> Close</> : <><IconPlus /> Add product</>}
        </button>
      </div>

      {adding && (
        <form className="panel panel-pad stack" style={{ marginBottom: 16 }} onSubmit={add}>
          <div className="grid-form">
            <div className="field"><label>SKU</label><input className="input mono" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="PR-120" /></div>
            <div className="field" style={{ gridColumn: "span 2" }}><label>Product name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Baby Spinach" /></div>
            <div className="field"><label>Category</label>
              <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Sold by</label>
              <select className="select" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="field"><label>Pack size</label><input className="input" value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} placeholder="4 lb" /></div>
            <div className="field"><label>Price ($ per unit)</label><input className="input input-money" required inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" /></div>
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : "Save product"}</button>
          </div>
        </form>
      )}

      <div className="panel">
        <div className="panel-head wrap">
          <div className="search grow" style={{ maxWidth: 420 }}>
            <IconSearch />
            <input className="input" style={{ height: 38, fontSize: 14 }} placeholder="Search name or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="select" style={{ width: 210 }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
            <option value="All">All categories ({products.length})</option>
            {categoriesOf(products).map((c) => <option key={c} value={c}>{c} ({counts.get(c) ?? 0})</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="hide-sm">Category</th>
                <th className="right">List price</th>
                <th>In stock</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 550 }}>{p.name}</div>
                    <div className="dim mono" style={{ fontSize: 11.5 }}>{p.sku}{p.packSize ? ` · ${p.packSize}` : ""}</div>
                  </td>
                  <td className="hide-sm muted">{p.category}</td>
                  <td><PriceCell p={p} onSaved={(c) => update(p.id, { priceCents: c })} /></td>
                  <td>
                    <button className="switch" role="switch" aria-checked={p.inStock} aria-label={`${p.name} in stock`} onClick={() => toggleStock(p)} />
                  </td>
                  <td className="right">
                    <button className="btn btn-ghost btn-sm" onClick={() => archive(p)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <div className="empty"><h3>No matches</h3><p>Try a different search or category.</p></div>}
        </div>
      </div>
    </>
  );
}
