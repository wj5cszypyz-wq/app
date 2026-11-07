import { badRequest } from "@/lib/auth";
import type { Params } from "@/lib/api-input";
import { respond } from "@/lib/data/errors";
import { createProduct, type NewProduct } from "@/lib/data/products";
import { parseProductInput } from "@/lib/product-input";
import { MANAGE, storeApi } from "@/lib/scope";

export async function POST(req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const input = parseProductInput(await req.json().catch(() => null), false);
  if ("error" in input) return badRequest(input.error);
  return respond(
    () => createProduct(ctx, input as NewProduct),
    (product) => Response.json({ product }, { status: 201 }),
  );
}
