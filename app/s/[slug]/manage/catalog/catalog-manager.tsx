"use client";

import { useMemo, useState } from "react";
import { IconPlus, IconSearch } from "@/components/icons";
import { Spinner } from "@/components/status";
import { useToast } from "@/components/toast";
import { categoriesOf } from "@/lib/catalog";
import type { UnitKind } from "@/lib/units";
import { ProductForm } from "./product-form";
import type { Category, Product } from "./types";
import { formatMoney } from "@/lib/money";
import { useStorePaths } from "@/components/use-store";

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

export function CatalogManager({ initial, categories: initialCategories, defaultKind }: { initial: Product[]; categories: Category[]; defaultKind: UnitKind }) {
  const notify = useToast();
  const paths = useStorePaths();
  const [products, setProducts] = useState(initial);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [categories, setCategories] = useState(initialCategories);

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

  async function refreshCategories() {
    const res = await fetch(paths.api("/manage/categories"), { cache: "no-store" });
    if (res.ok) setCategories((await res.json()).categories);
  }

  function saved(p: Product) {
    const isNew = editing === "new";
    setProducts((all) =>
      (isNew ? [...all, p] : all.map((x) => (x.id === p.id ? p : x))).sort(
        (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
      ),
    );
    setEditing(null);
    refreshCategories();
    notify("success", isNew ? "Product added" : "Saved", p.name);
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
          <h1>Products</h1>
          <p>{products.length} products. Prices here are your list prices; set special prices per customer under Customers.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          <IconPlus /> Add product
        </button>
      </div>

      {editing && (
        <ProductForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? undefined : editing}
          categories={categories}
          defaultKind={defaultKind}
          onSaved={saved}
          onClose={() => setEditing(null)}
        />
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
                    <div style={{ fontWeight: 550, overflowWrap: "anywhere" }}>{p.name}</div>
                    <div className="dim" style={{ fontSize: 11.5 }}><span className="mono">{p.sku}</span> · per {p.unit}{p.packSize ? ` of ${p.packSize}` : ""}</div>
                  </td>
                  <td className="hide-sm muted">{p.category}</td>
                  <td><PriceCell p={p} onSaved={(c) => update(p.id, { priceCents: c })} /></td>
                  <td>
                    <button className="switch" role="switch" aria-checked={p.inStock} aria-label={`${p.name} in stock`} onClick={() => toggleStock(p)} />
                  </td>
                  <td className="right nowrap">
                    <button className="btn btn-sm" onClick={() => { setEditing(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>{" "}
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
