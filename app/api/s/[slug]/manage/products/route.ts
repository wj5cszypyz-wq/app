import { badRequest } from "@/lib/auth";
import { moneyInput, readJson, str, type Params } from "@/lib/api-input";
import { CATEGORIES, UNITS } from "@/lib/catalog";
import { respond } from "@/lib/data/errors";
import { createProduct } from "@/lib/data/products";
import { parseMoney } from "@/lib/money";
import { MANAGE, storeApi } from "@/lib/scope";

export async function POST(req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const b = await readJson(req);

  const sku = str(b, "sku").toUpperCase();
  const name = str(b, "name");
  const category = str(b, "category");
  const unit = str(b, "unit");
  const packSize = str(b, "packSize") || null;
  const priceCents = parseMoney(moneyInput(b.price));

  if (!sku || sku.length > 40) return badRequest("Add a SKU (up to 40 characters).");
  if (!name || name.length > 120) return badRequest("Add a product name (up to 120 characters).");
  if (!(CATEGORIES as readonly string[]).includes(category)) return badRequest("Pick a category.");
  if (!(UNITS as readonly string[]).includes(unit)) return badRequest("Pick a unit.");
  if (packSize && packSize.length > 60) return badRequest("Pack size is too long (up to 60 characters).");
  if (priceCents === null || priceCents === 0) return badRequest("Enter a price.");

  return respond(
    () => createProduct(ctx, { sku, name, category, unit, packSize, priceCents }),
    (product) => Response.json({ product }, { status: 201 }),
  );
}
