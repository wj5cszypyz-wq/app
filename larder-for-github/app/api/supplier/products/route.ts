import { apiSession, badRequest, unauthorized } from "@/lib/auth";
import { CATEGORIES, UNITS } from "@/lib/catalog";
import { db } from "@/lib/db";
import { parseMoney } from "@/lib/money";

export async function POST(req: Request) {
  const s = await apiSession("supplier");
  if (!s) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const sku = typeof b.sku === "string" ? b.sku.trim().toUpperCase() : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const category = typeof b.category === "string" ? b.category : "";
  const unit = typeof b.unit === "string" ? b.unit : "";
  const packSize = typeof b.packSize === "string" && b.packSize.trim() ? b.packSize.trim() : null;
  const priceCents = parseMoney(typeof b.price === "string" || typeof b.price === "number" ? b.price : "");

  if (!sku || sku.length > 40) return badRequest("Add a SKU (up to 40 characters).");
  if (!name || name.length > 120) return badRequest("Add a product name (up to 120 characters).");
  if (!(CATEGORIES as readonly string[]).includes(category)) return badRequest("Pick a category.");
  if (!(UNITS as readonly string[]).includes(unit)) return badRequest("Pick a unit.");
  if (priceCents === null || priceCents === 0) return badRequest("Enter a price.");

  const exists = await db.product.findUnique({ where: { supplierId_sku: { supplierId: s.supplierId, sku } } });
  if (exists) return badRequest(`SKU ${sku} is already in your catalog.`);

  const product = await db.product.create({
    data: { supplierId: s.supplierId, sku, name, category, unit, packSize, priceCents },
  });
  return Response.json({ product }, { status: 201 });
}
