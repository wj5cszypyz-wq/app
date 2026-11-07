// Reads and checks a product from a form. Used for both "add" (everything required) and "edit"
// (only the fields sent are checked and changed).
import { parseMoney } from "./money";
import { ALL_UNITS, isUnitKind, packLabel, UNIT_KINDS, type UnitKind } from "./units";

export type ProductInput = {
  sku?: string;
  name?: string;
  description?: string | null;
  category?: string;
  categoryEmoji?: string | null;
  unitKind?: UnitKind;
  unit?: string;
  packCount?: number | null;
  packAmount?: number | null;
  packUnit?: string | null;
  packSize?: string | null;
  byWeight?: boolean;
  priceCents?: number;
  inStock?: boolean;
  active?: boolean;
  imageIds?: string[];
  qboUnitFactor?: number;
  qboUnitLabel?: string | null;
};

const has = (b: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(b, k) && b[k] !== undefined;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const numOrNull = (v: unknown): number | null | "bad" => {
  if (v === null || v === "" || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : "bad";
};

export function parseProductInput(body: unknown, partial: boolean): ProductInput | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const out: ProductInput = {};
  const need = (k: string) => !partial || has(b, k);

  if (need("sku")) {
    const sku = text(b.sku).toUpperCase();
    if (!sku || sku.length > 40) return { error: "Add a SKU (up to 40 characters)." };
    out.sku = sku;
  }
  if (need("name")) {
    const name = text(b.name);
    if (!name || name.length > 120) return { error: "Add a product name (up to 120 characters)." };
    out.name = name;
  }
  if (has(b, "description")) {
    const d = text(b.description);
    if (d.length > 2000) return { error: "Description is too long (up to 2,000 characters)." };
    out.description = d || null;
  }
  if (need("category")) {
    const c = text(b.category);
    if (!c || c.length > 60) return { error: "Pick or add a category." };
    out.category = c;
  }
  if (has(b, "categoryEmoji")) {
    const e = text(b.categoryEmoji);
    if ([...e].length > 8) return { error: "Use one emoji for the category." };
    out.categoryEmoji = e || null;
  }
  if (need("unitKind")) {
    if (!isUnitKind(b.unitKind)) return { error: "Pick what kind of item this is." };
    out.unitKind = b.unitKind;
  }
  if (need("unit")) {
    const u = text(b.unit);
    if (!ALL_UNITS.includes(u)) return { error: "Pick a unit that fits this kind of item." };
    if (out.unitKind && !UNIT_KINDS[out.unitKind].units.includes(u)) return { error: "Pick a unit that fits this kind of item." };
    out.unit = u;
  }
  const packKeys = ["packCount", "packAmount", "packUnit"];
  if (!partial || packKeys.some((k) => has(b, k))) {
    const count = numOrNull(b.packCount);
    const amount = numOrNull(b.packAmount);
    const unit = text(b.packUnit) || null;
    if (count === "bad" || (count !== null && (!Number.isInteger(count) || count > 100_000))) return { error: "Items per pack must be a whole number." };
    if (amount === "bad" || (amount !== null && amount > 1_000_000)) return { error: "Enter a valid amount for the pack." };
    if (unit && !ALL_UNITS.includes(unit)) return { error: "Pick a valid unit for the pack." };
    if ((amount === null) !== (unit === null)) return { error: "Enter both the amount and its unit, e.g. 12 fl oz." };
    out.packCount = count;
    out.packAmount = amount;
    out.packUnit = unit;
    out.packSize = packLabel({ count, amount, unit });
  }
  if (has(b, "byWeight") || !partial) out.byWeight = b.byWeight === true;
  if (need("price")) {
    const cents = parseMoney(typeof b.price === "string" || typeof b.price === "number" ? b.price : "");
    if (cents === null || cents === 0) return { error: "Enter a price." };
    out.priceCents = cents;
  }
  if (typeof b.inStock === "boolean") out.inStock = b.inStock;
  if (typeof b.active === "boolean") out.active = b.active;
  if (has(b, "imageIds")) {
    if (!Array.isArray(b.imageIds) || b.imageIds.length > 4 || !b.imageIds.every((x) => typeof x === "string" && x.length < 40)) {
      return { error: "Up to 4 photos per product." };
    }
    out.imageIds = b.imageIds as string[];
  }
  if (has(b, "qboUnitFactor")) {
    const f = Number(b.qboUnitFactor);
    if (!Number.isFinite(f) || f <= 0 || f > 100_000) return { error: "Enter how many QuickBooks units one item is (e.g. 40)." };
    out.qboUnitFactor = f;
  }
  if (has(b, "qboUnitLabel")) {
    const l = text(b.qboUnitLabel);
    if (l.length > 20) return { error: "QuickBooks unit name is too long." };
    out.qboUnitLabel = l || null;
  }
  if (partial && Object.keys(out).length === 0) return { error: "Nothing to update." };
  return out;
}
