import { readJson, type Params } from "@/lib/api-input";
import { notFoundResponse, respond } from "@/lib/data/errors";
import { setOrderStatus } from "@/lib/data/orders";
import { MANAGE, storeApi } from "@/lib/scope";

export async function PATCH(req: Request, { params }: Params<{ id: string }>) {
  const { slug, id } = await params;
  const ctx = await storeApi(slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const body = await readJson(req);
  return respond(
    () => setOrderStatus(ctx, id, typeof body.status === "string" ? body.status : ""),
    (r) => (r ? Response.json({ ok: true, ...r }) : notFoundResponse("Order not found.")),
  );
}
