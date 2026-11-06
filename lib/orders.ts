import { isValidQty } from "./catalog";

export type OrderInput = {
  lines: { productId: string; qty: number }[];
  deliveryDate: string | null; // YYYY-MM-DD
  notes: string | null;
};

export type PricedProduct = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  packSize: string | null;
  priceCents: number;
  inStock: boolean;
};

export type BuiltLine = {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  packSize: string | null;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export function lineTotal(qty: number, unitPriceCents: number): number {
  return Math.round(qty * unitPriceCents);
}

/** Validates the raw JSON a restaurant sends when placing an order. */
export function parseOrderInput(body: unknown, today: string): OrderInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid order." };
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.lines) || b.lines.length === 0) return { error: "Your cart is empty." };
  if (b.lines.length > 300) return { error: "Too many lines in one order." };

  const merged = new Map<string, number>();
  for (const raw of b.lines) {
    const l = raw as Record<string, unknown>;
    if (typeof l?.productId !== "string" || typeof l?.qty !== "number") return { error: "Invalid line item." };
    merged.set(l.productId, Math.round(((merged.get(l.productId) ?? 0) + l.qty) * 100) / 100);
  }

  let deliveryDate: string | null = null;
  if (b.deliveryDate != null && b.deliveryDate !== "") {
    if (typeof b.deliveryDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.deliveryDate)) {
      return { error: "Pick a valid delivery date." };
    }
    if (b.deliveryDate < today) return { error: "Delivery date can't be in the past." };
    deliveryDate = b.deliveryDate;
  }

  let notes: string | null = null;
  if (typeof b.notes === "string" && b.notes.trim()) notes = b.notes.trim().slice(0, 1000);

  return {
    lines: [...merged].map(([productId, qty]) => ({ productId, qty })),
    deliveryDate,
    notes,
  };
}

/** Turns requested lines into priced lines. Prices always come from the server, never the client. */
export function buildLines(
  input: OrderInput["lines"],
  products: Map<string, PricedProduct>,
): { lines: BuiltLine[]; subtotalCents: number } | { error: string } {
  const lines: BuiltLine[] = [];
  for (const { productId, qty } of input) {
    const p = products.get(productId);
    if (!p) return { error: "One of the items in your cart is no longer available." };
    if (!p.inStock) return { error: `${p.name} is out of stock. Remove it to continue.` };
    if (!isValidQty(p.unit, qty)) return { error: `Invalid quantity for ${p.name}.` };
    lines.push({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      packSize: p.packSize,
      qty,
      unitPriceCents: p.priceCents,
      lineTotalCents: lineTotal(qty, p.priceCents),
    });
  }
  return { lines, subtotalCents: lines.reduce((s, l) => s + l.lineTotalCents, 0) };
}

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
