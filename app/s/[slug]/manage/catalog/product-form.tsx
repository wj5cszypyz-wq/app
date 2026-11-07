"use client";
// Add or edit one product: what it is, how it's sold (unit + pack contents), price and category.
import { useMemo, useState, type FormEvent } from "react";
import { IconX } from "@/components/icons";
import { Spinner } from "@/components/status";
import { useStorePaths } from "@/components/use-store";
import { ALL_UNITS, KIND_ORDER, packLabel, priceLabel, UNIT_KINDS, type UnitKind } from "@/lib/units";
import { parseMoney } from "@/lib/money";
import { PhotoPicker } from "./photo-picker";
import { photoIds, type Category, type Product } from "./types";

const NEW = "__new__";

export function ProductForm(props: {
  initial?: Product;
  categories: Category[];
  defaultKind: UnitKind;
  onSaved: (p: Product) => void;
  onClose: () => void;
}) {
  const paths = useStorePaths();
  const p = props.initial;
  const [f, setF] = useState({
    name: p?.name ?? "",
    sku: p?.sku ?? "",
    description: p?.description ?? "",
    category: p?.category ?? props.categories[0]?.name ?? NEW,
    newCategory: "",
    newEmoji: "",
    unitKind: (p?.unitKind as UnitKind) ?? props.defaultKind,
    unit: p?.unit ?? UNIT_KINDS[props.defaultKind].units[0],
    packCount: p?.packCount ? String(p.packCount) : "",
    packAmount: p?.packAmount ? String(p.packAmount) : "",
    packUnit: p?.packUnit ?? "",
    byWeight: p?.byWeight ?? false,
    price: p ? (p.priceCents / 100).toFixed(2) : "",
    qboFactor: p ? String(p.qboUnitFactor) : "1",
    qboLabel: p?.qboUnitLabel ?? "",
  });
  const [images, setImages] = useState<string[]>(p ? photoIds(p) : []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const pack = packLabel({
    count: Number(f.packCount) || null,
    amount: Number(f.packAmount) || null,
    unit: f.packAmount ? f.packUnit || null : null,
  });
  const preview = useMemo(() => {
    const cents = parseMoney(f.price);
    return cents ? priceLabel(cents, f.unit, pack) : null;
  }, [f.price, f.unit, pack]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const isNew = f.category === NEW;
    const body = {
      name: f.name,
      sku: f.sku,
      description: f.description,
      category: isNew ? f.newCategory : f.category,
      ...(isNew && f.newEmoji ? { categoryEmoji: f.newEmoji } : {}),
      unitKind: f.unitKind,
      unit: f.unit,
      packCount: f.packCount || null,
      packAmount: f.packAmount || null,
      packUnit: f.packAmount ? f.packUnit || null : null,
      byWeight: f.byWeight,
      price: f.price,
      imageIds: images,
      ...(p?.qboItemId ? { qboUnitFactor: f.qboFactor || "1", qboUnitLabel: f.qboLabel } : {}),
    };
    const res = await fetch(paths.api(p ? `/manage/products/${p.id}` : "/manage/products"), {
      method: p ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Couldn't save.");
    props.onSaved(
      p
        ? { ...p, ...body, qboUnitFactor: Number(f.qboFactor) || 1, qboUnitLabel: f.qboLabel || null, description: f.description || null, category: body.category, packCount: Number(f.packCount) || null, packAmount: Number(f.packAmount) || null, packUnit: body.packUnit, packSize: pack, priceCents: parseMoney(f.price) ?? p.priceCents, sku: f.sku.trim().toUpperCase(), imageIds: JSON.stringify(images) }
        : (json.product as Product),
    );
  }

  return (
    <form className="panel panel-pad stack product-form" style={{ marginBottom: 16 }} onSubmit={submit}>
      <div className="row-between">
        <h2>{p ? `Edit ${p.name}` : "New product"}</h2>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Close" onClick={props.onClose}><IconX /></button>
      </div>

      <div className="grid-form">
        <div className="field span-2"><label htmlFor="pf-name">Product name</label><input id="pf-name" className="input" required maxLength={120} value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="field"><label htmlFor="pf-sku">SKU</label><input id="pf-sku" className="input mono" required maxLength={40} value={f.sku} onChange={(e) => set("sku", e.target.value)} /></div>

        <div className="field">
          <label htmlFor="pf-cat">Category</label>
          <select id="pf-cat" className="select" value={f.category} onChange={(e) => set("category", e.target.value)}>
            {props.categories.map((c) => <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>)}
            <option value={NEW}>+ New category…</option>
          </select>
        </div>
        {f.category === NEW && (
          <>
            <div className="field"><label htmlFor="pf-newcat">New category name</label><input id="pf-newcat" className="input" required maxLength={60} value={f.newCategory} onChange={(e) => set("newCategory", e.target.value)} /></div>
            <div className="field"><label htmlFor="pf-emoji">Icon (one emoji, optional)</label><input id="pf-emoji" className="input" maxLength={8} value={f.newEmoji} onChange={(e) => set("newEmoji", e.target.value)} /></div>
          </>
        )}

        <div className="field">
          <label htmlFor="pf-kind">What kind of item?</label>
          <select
            id="pf-kind"
            className="select"
            value={f.unitKind}
            onChange={(e) => {
              const k = e.target.value as UnitKind;
              setF((x) => ({ ...x, unitKind: k, unit: UNIT_KINDS[k].units[0], byWeight: k === "weight" || k === "packed" ? x.byWeight : false }));
            }}
          >
            {KIND_ORDER.map((k) => <option key={k} value={k}>{UNIT_KINDS[k].label}</option>)}
          </select>
          <div className="dim" style={{ fontSize: 12 }}>e.g. {UNIT_KINDS[f.unitKind].hint}</div>
        </div>
        <div className="field">
          <label htmlFor="pf-unit">Sold by the</label>
          <select id="pf-unit" className="select" value={f.unit} onChange={(e) => set("unit", e.target.value)}>
            {UNIT_KINDS[f.unitKind].units.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pf-price">{f.unit === "each" ? "Price (each)" : `Price per ${f.unit}`}</label>
          <input id="pf-price" className="input input-money" required inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" />
        </div>

        <div className="field">
          <label htmlFor="pf-count">Items inside (optional)</label>
          <input id="pf-count" className="input" inputMode="numeric" value={f.packCount} onChange={(e) => set("packCount", e.target.value.replace(/[^\d]/g, ""))} placeholder="e.g. 24" />
        </div>
        <div className="field">
          <label htmlFor="pf-amount">Each holds (optional)</label>
          <div className="row" style={{ gap: 6 }}>
            <input id="pf-amount" className="input" inputMode="decimal" value={f.packAmount} onChange={(e) => set("packAmount", e.target.value.replace(/[^\d.]/g, ""))} placeholder="e.g. 12" />
            <select className="select" aria-label="Unit inside" value={f.packUnit} onChange={(e) => set("packUnit", e.target.value)} style={{ maxWidth: 120 }}>
              <option value="">unit</option>
              {ALL_UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
        {(f.unitKind === "weight" || f.unitKind === "packed") && (
          <label className="field check-row">
            <input type="checkbox" checked={f.byWeight} onChange={(e) => set("byWeight", e.target.checked)} />
            <span>Billed by actual weight (the final amount may change when it&apos;s weighed)</span>
          </label>
        )}

        {p?.qboItemId && (
          <div className="field span-3">
            <label htmlFor="pf-qbo">How QuickBooks counts it</label>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: 13.5 }}>1 {f.unit} =</span>
              <input id="pf-qbo" className="input" style={{ width: 90 }} inputMode="decimal" value={f.qboFactor} onChange={(e) => set("qboFactor", e.target.value.replace(/[^\d.]/g, ""))} />
              <input className="input" style={{ width: 120 }} aria-label="QuickBooks unit" placeholder={f.unit} maxLength={20} value={f.qboLabel} onChange={(e) => set("qboLabel", e.target.value)} />
              <span className="dim" style={{ fontSize: 12 }}>in QuickBooks. Leave 1 if QuickBooks counts it the same way.</span>
            </div>
          </div>
        )}
        <div className="field span-3">
          <label htmlFor="pf-desc">Description (optional)</label>
          <textarea id="pf-desc" className="input" rows={2} maxLength={2000} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="field span-3">
          <label>Photos (up to 4)</label>
          <PhotoPicker ids={images} onChange={setImages} />
        </div>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
      <div className="row-between" style={{ flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 13 }}>{preview ? <>Customers see: <b>{preview}</b></> : "Enter a price to preview."}</span>
        <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : p ? "Save changes" : "Add product"}</button>
      </div>
    </form>
  );
}
