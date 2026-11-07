// Units of measure for any kind of product. A product picks a kind, then a unit it's sold by,
// and optionally what's inside (e.g. a case of 24 × 12 fl oz).
import { formatMoney } from "./money";

export type UnitKind = "weight" | "liquid" | "paper" | "length" | "count" | "packed";

export const UNIT_KINDS: Record<UnitKind, { label: string; hint: string; units: string[] }> = {
  weight: { label: "Sold by weight", hint: "produce, meat, coffee, hardware by the pound", units: ["oz", "lb", "g", "kg"] },
  liquid: { label: "Liquid", hint: "milk, oil, drinks, cleaning supplies", units: ["fl oz", "cup", "pint", "quart", "gallon", "mL", "L"] },
  paper: { label: "Paper", hint: "printer paper, napkins, towels", units: ["sheet", "ream", "roll", "pack", "carton"] },
  length: { label: "Length or area", hint: "fabric, rope, cable, flooring", units: ["inch", "foot", "yard", "meter", "sq ft", "sq m"] },
  count: { label: "Single items", hint: "lamps, tools, furniture", units: ["each", "pair", "set", "dozen"] },
  packed: { label: "Packed goods", hint: "anything sold by the case, box or bag", units: ["case", "box", "bag", "bottle", "jar", "pallet"] },
};

export const KIND_ORDER: UnitKind[] = ["count", "packed", "weight", "liquid", "paper", "length"];

export const ALL_UNITS = KIND_ORDER.flatMap((k) => UNIT_KINDS[k].units);

const MEASURED: UnitKind[] = ["weight", "liquid", "length"];

export function isUnitKind(v: unknown): v is UnitKind {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(UNIT_KINDS, v);
}

export function kindOf(unit: string): UnitKind | null {
  for (const k of KIND_ORDER) if (UNIT_KINDS[k].units.includes(unit)) return k;
  return null;
}

/** Measured units (lb, gallon, yard...) can be ordered in fractions; counted ones can't. */
export function allowsDecimal(unit: string): boolean {
  const k = kindOf(unit);
  return k !== null && MEASURED.includes(k);
}

const PLURAL: Record<string, string> = { sheet: "sheets", roll: "rolls", pack: "packs", carton: "cartons", ream: "reams", pair: "pairs", set: "sets", bottle: "bottles", jar: "jars", bag: "bags", box: "boxes", case: "cases", cup: "cups", pint: "pints", quart: "quarts", gallon: "gallons", inch: "inches", foot: "feet", yard: "yards", meter: "meters" };

export type Pack = { count: number | null; amount: number | null; unit: string | null };

const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3))));

/** "24 × 12 fl oz", "40 lb", "500 sheets", "6 ct"; null when nothing is set. */
export function packLabel(p: Pack): string | null {
  const unitText = (amount: number, unit: string) => `${num(amount)} ${amount !== 1 && PLURAL[unit] ? PLURAL[unit] : unit}`;
  if (p.amount && p.unit) {
    const inner = unitText(p.amount, p.unit);
    return p.count && p.count > 1 ? `${p.count} × ${inner}` : inner;
  }
  if (p.count && p.count > 0) return `${p.count} ct`;
  return null;
}

/** "$42.00 per case of 24 × 12 fl oz", "$3.20 per lb", "$180.00 each". */
export function priceLabel(priceCents: number, unit: string, pack: string | null): string {
  const price = formatMoney(priceCents);
  if (unit === "each") return pack ? `${price} each (${pack})` : `${price} each`;
  return pack ? `${price} per ${unit} of ${pack}` : `${price} per ${unit}`;
}
