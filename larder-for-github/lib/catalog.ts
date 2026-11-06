export const CATEGORIES = [
  "Produce",
  "Dairy & Eggs",
  "Meat & Poultry",
  "Seafood",
  "Bakery",
  "Dry Goods",
  "Paper & Disposables",
] as const;

/** Simple picture for each aisle so staff can scan the list at a glance. */
export const CATEGORY_ICON: Record<string, string> = {
  Produce: "🥬",
  "Dairy & Eggs": "🧀",
  "Meat & Poultry": "🥩",
  Seafood: "🐟",
  Bakery: "🍞",
  "Dry Goods": "🫙",
  "Paper & Disposables": "🧻",
};

export const UNITS =["case", "lb", "each", "dozen", "gal"] as const;
export type Unit = (typeof UNITS)[number];

export const ORDER_STATUSES = ["new", "packing", "ready", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  packing: "Packing",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** The next step in the fulfillment pipeline, or null at the end. */
export function nextStatus(s: string): OrderStatus | null {
  const flow: OrderStatus[] = ["new", "packing", "ready", "delivered"];
  const i = flow.indexOf(s as OrderStatus);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
}

/** Weighed items (lb) can be ordered in hundredths; everything else in whole units. */
export function isValidQty(unit: string, qty: number): boolean {
  if (!Number.isFinite(qty) || qty <= 0 || qty > 10_000) return false;
  if (unit === "lb") return Math.abs(qty * 100 - Math.round(qty * 100)) < 1e-9;
  return Number.isInteger(qty);
}
