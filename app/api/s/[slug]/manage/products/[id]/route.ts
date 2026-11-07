import { badRequest } from "@/lib/auth";
import { moneyInput, readJson, type Params } from "@/lib/api-input";
import { notFoundResponse } from "@/lib/data/errors";
import { updateProduct, type ProductPatch } from "@/lib/data/products";
import { parseMoney } from "@/lib/money";
import { MANAGE, storeApi } from "@/lib/scope";

export async function PATCH(req: Request, { params }: Params<{ id: string }>) {
  const { slug, id } = await params;
  const ctx = await storeApi(slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const b = await readJson(req);

  const patch: ProductPatch = {};
  if (b.price !== undefined) {
    const cents = parseMoney(moneyInput(b.price));
    if (cents === null || cents === 0) return badRequest("Enter a valid price.");
    patch.priceCents = cents;
  }
  if (typeof b.inStock === "boolean") patch.inStock = b.inStock;
  if (typeof b.active === "boolean") patch.active = b.active;
  if (Object.keys(patch).length === 0) return badRequest("Nothing to update.");

  const result = await updateProduct(ctx, id, patch);
  return result ? Response.json({ ok: true, ...result }) : notFoundResponse("Product not found.");
}
