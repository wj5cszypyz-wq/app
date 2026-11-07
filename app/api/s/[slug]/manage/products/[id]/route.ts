import { badRequest } from "@/lib/auth";
import type { Params } from "@/lib/api-input";
import { notFoundResponse, respond } from "@/lib/data/errors";
import { updateProduct } from "@/lib/data/products";
import { parseProductInput } from "@/lib/product-input";
import { MANAGE, storeApi } from "@/lib/scope";

export async function PATCH(req: Request, { params }: Params<{ id: string }>) {
  const { slug, id } = await params;
  const ctx = await storeApi(slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const patch = parseProductInput(await req.json().catch(() => null), true);
  if ("error" in patch) return badRequest(patch.error);
  return respond(
    () => updateProduct(ctx, id, patch),
    (r) => (r ? Response.json({ ok: true, ...r }) : notFoundResponse("Product not found.")),
  );
}
