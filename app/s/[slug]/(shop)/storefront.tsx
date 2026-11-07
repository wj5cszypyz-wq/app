"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconArrow, IconCart, IconPlus, IconSearch, IconX } from "@/components/icons";
import { Spinner } from "@/components/status";
import { useToast } from "@/components/toast";
import { loadCart, saveCart, type Cart } from "@/lib/cart";
import { CATEGORY_ICON, categoriesOf, isValidQty } from "@/lib/catalog";
import { formatMoney, formatQty } from "@/lib/money";
import { lineTotal } from "@/lib/orders";
import type { StoreProduct } from "@/lib/data/storefront";
import { useStorePaths } from "@/components/use-store";

const USUAL = "Order again";
const icon = (category: string) => (category === USUAL ? "🔁" : CATEGORY_ICON[category] ?? "📦");

function Stepper({ p, qty, onChange }: { p: StoreProduct; qty: number; onChange: (q: number) => void }) {
  const [text, setText] = useState(formatQty(qty));
  useEffect(() => setText(formatQty(qty)), [qty]);
  const step = 1;

  function commit(raw: string) {
    const n = Math.round(Number(raw) * 100) / 100;
    if (!raw.trim() || n <= 0) return onChange(0);
    if (isValidQty(p.unit, n)) onChange(n);
    else setText(formatQty(qty));
  }

  return (
    <div className="stepper active">
      <button aria-label={`Less ${p.name}`} onClick={() => onChange(Math.max(0, Math.round((qty - step) * 100) / 100))}>−</button>
      <input
        aria-label={`Quantity of ${p.name}`}
        inputMode={p.unit === "lb" ? "decimal" : "numeric"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <button aria-label={`More ${p.name}`} onClick={() => onChange(Math.round((qty + step) * 100) / 100)}>+</button>
    </div>
  );
}

export function Storefront(props: {
  cartKey: string;
  firstName: string;
  products: StoreProduct[];
  usualIds: string[];
  today: string;
  defaultDelivery: string;
}) {
  const router = useRouter();
  const paths = useStorePaths();
  const notify = useToast();
  const [cart, setCart] = useState<Cart>({});
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [delivery, setDelivery] = useState(props.defaultDelivery);
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(props.products.map((p) => [p.id, p])), [props.products]);

  useEffect(() => {
    const saved = loadCart(props.cartKey);
    // Drop anything no longer sold.
    setCart(Object.fromEntries(Object.entries(saved).filter(([id]) => byId.has(id))));
    setLoaded(true);
  }, [props.cartKey, byId]);
  useEffect(() => {
    if (loaded) saveCart(props.cartKey, cart);
  }, [cart, loaded, props.cartKey]);

  // "/" focuses search, like a pro tool.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") setCartOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  const categories = useMemo(() => categoriesOf(props.products), [props.products]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (p: StoreProduct) => !needle || `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(needle);
    const out: { name: string; items: StoreProduct[] }[] = [];
    const usual = props.usualIds.map((id) => byId.get(id)).filter((p): p is StoreProduct => Boolean(p && match(p)));
    if (!needle && usual.length && (!cat || cat === USUAL)) out.push({ name: USUAL, items: usual });
    for (const c of categories) {
      if (cat && cat !== c) continue;
      const items = props.products.filter((p) => p.category === c && match(p));
      if (items.length) out.push({ name: c, items });
    }
    return out;
  }, [props.products, props.usualIds, byId, q, cat, categories]);

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ p: byId.get(id)!, qty }))
    .filter((l) => l.p);
  const subtotal = lines.reduce((s, l) => s + lineTotal(l.qty, l.p.priceCents), 0);
  const count = lines.length;
  const blocked = lines.some((l) => !l.p.inStock);

  async function place() {
    setPlacing(true);
    try {
      const res = await fetch(paths.api("/orders"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => ({ productId: l.p.id, qty: l.qty })),
          deliveryDate: delivery,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't place the order.");
      setCart({});
      saveCart(props.cartKey, {});
      router.push(paths.shop(`/orders/${json.id}?placed=1`));
    } catch (e) {
      notify("error", "Order not placed", e instanceof Error ? e.message : undefined);
      setPlacing(false);
    }
  }

  const railCounts = useMemo(() => {
    const m = new Map<string, number>();
    props.products.forEach((p) => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return m;
  }, [props.products]);

  return (
    <div className="store">
      <nav className="rail" aria-label="Categories">
        <div className="rail-title">Categories</div>
        <button aria-pressed={cat === null} onClick={() => setCat(null)}>
          <span className="emoji">🛒</span>Everything <span className="count">{props.products.length}</span>
        </button>
        {props.usualIds.length > 0 && (
          <button aria-pressed={cat === USUAL} onClick={() => setCat(USUAL)}>
            <span className="emoji">{icon(USUAL)}</span>{USUAL} <span className="count">{props.usualIds.length}</span>
          </button>
        )}
        {categories.filter((c) => railCounts.get(c)).map((c) => (
          <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>
            <span className="emoji">{icon(c)}</span>{c} <span className="count">{railCounts.get(c)}</span>
          </button>
        ))}
      </nav>

      <section style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 14 }}>
          <h1>What do you need today, {props.firstName}?</h1>
          <p className="muted" style={{ margin: "6px 0 16px" }}>Prices shown are your prices.</p>
          <div className="search">
            <IconSearch />
            <input
              ref={searchRef}
              className="input"
              type="search"
              placeholder="Search products, e.g. romaine or butter"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search products"
            />
          </div>
        </div>

        <div className="chips" role="group" aria-label="Categories">
          <button aria-pressed={cat === null} onClick={() => setCat(null)}>All</button>
          {props.usualIds.length > 0 && (
            <button aria-pressed={cat === USUAL} onClick={() => setCat(USUAL)}>{icon(USUAL)} {USUAL}</button>
          )}
          {categories.filter((c) => railCounts.get(c)).map((c) => (
            <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{icon(c)} {c}</button>
          ))}
        </div>

        {groups.length === 0 && (
          <div className="panel empty"><h3>No matches for "{q}"</h3><p>Try a shorter word or the SKU.</p></div>
        )}

        {groups.map((g) => (
          <div key={g.name}>
            <div className="cat-head">
              <span className="emoji" aria-hidden>{icon(g.name)}</span>
              <h2>{g.name}</h2>
              <span className="dim" style={{ fontSize: 13 }}>{g.items.length}</span>
            </div>
            <div className="panel plist">
              {g.items.map((p) => {
                const qty = cart[p.id] ?? 0;
                const deal = p.priceCents < p.listPriceCents;
                return (
                  <div key={`${g.name}-${p.id}`} className={`pitem ${qty ? "in-cart" : ""} ${p.inStock ? "" : "out"}`}>
                    <div className="ptile" aria-hidden>{icon(p.category)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="pname">{p.name}</div>
                      <div className="pmeta">
                        {p.packSize && <span>{p.packSize}</span>}
                        <span className="dim">#{p.sku}</span>
                        {!p.inStock && <span className="oos">Out of stock</span>}
                      </div>
                    </div>
                    <div className="pprice">
                      <div className="num">{formatMoney(p.priceCents)}</div>
                      <div className="per">per {p.unit}</div>
                      {deal && <div className="deal">Save {formatMoney(p.listPriceCents - p.priceCents)}</div>}
                    </div>
                    <div className="pact">
                      {!p.inStock ? (
                        <button className="btn add-btn" disabled>Unavailable</button>
                      ) : qty ? (
                        <Stepper p={p} qty={qty} onChange={(n) => setQty(p.id, n)} />
                      ) : (
                        <button className="btn btn-primary add-btn" onClick={() => setQty(p.id, 1)}>
                          <IconPlus /> Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <aside className={`panel cart ${cartOpen ? "open" : ""}`} aria-label="Cart">
        <div className="panel-head">
          <div className="row"><IconCart style={{ width: 20, height: 20, color: "var(--green)" }} /><h2>Your order</h2></div>
          <div className="row">
            <span className="muted" style={{ fontSize: 12.5 }}>{count} {count === 1 ? "item" : "items"}</span>
            {cartOpen && <button className="btn btn-ghost btn-sm btn-icon" aria-label="Close cart" onClick={() => setCartOpen(false)}><IconX /></button>}
          </div>
        </div>

        {count === 0 ? (
          <div className="empty" style={{ padding: "40px 20px" }}>
            <h3>Cart is empty</h3>
            <p>Tap <b>Add</b> on anything you need.</p>
          </div>
        ) : (
          <div className="cart-lines">
            {lines.map(({ p, qty }) => (
              <div key={p.id} className="cart-line">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 550, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <small className="mono">{formatQty(qty)} {p.unit} × {formatMoney(p.priceCents)}</small>
                  <div><button onClick={() => setQty(p.id, 0)}>Remove</button></div>
                </div>
                <div className="num" style={{ fontWeight: 600 }}>{formatMoney(lineTotal(qty, p.priceCents))}</div>
              </div>
            ))}
          </div>
        )}

        <div className="cart-foot">
          <div className="grid-form" style={{ gridTemplateColumns: "1fr" }}>
            <div className="field">
              <label htmlFor="delivery">Delivery date</label>
              <input id="delivery" className="input" type="date" min={props.today} value={delivery} onChange={(e) => setDelivery(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="notes">Note for the seller</label>
              <textarea id="notes" className="textarea" rows={2} placeholder="Back door after 7am, ripe avocados please…" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            </div>
          </div>
          <div className="cart-total">
            <span className="eyebrow">Estimated total</span>
            <span className="num">{formatMoney(subtotal)}</span>
          </div>
          <button className="btn btn-primary btn-lg btn-block" disabled={!count || placing || blocked} onClick={place}>
            {placing ? <Spinner /> : <>Place order <IconArrow /></>}
          </button>
          <div className="dim" style={{ fontSize: 11.5, textAlign: "center" }}>
            Weighed items are billed on actual weight. Tax, if any, appears on the invoice.
          </div>
        </div>
      </aside>

      {count > 0 && !cartOpen && (
        <button className="btn btn-primary btn-lg mobile-cart" onClick={() => setCartOpen(true)}>
          <IconCart /> Review order · {count} · <span className="mono">{formatMoney(subtotal)}</span>
        </button>
      )}
    </div>
  );
}
