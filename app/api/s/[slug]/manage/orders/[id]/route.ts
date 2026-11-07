import { readJson, type Params } from "@/lib/api-input";
import { notFoundResponse, respond } from "@/lib/data/errors";
import { setOrderStatus } from "@/lib/data/orders";
import { MANAGE, storeApi } from "@/lib/scope";
import { after } from "next/server";
import { syncOrderToQuickBooks } from "@/lib/sync";

export async function PATCH(req: Request, { params }: Params<{ id: string }>) {
  const { slug, id } = await params;
  const ctx = await storeApi(slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const body = await readJson(req);
  return respond(
    () => setOrderStatus(ctx, id, typeof body.status === "string" ? body.status : ""),
    (r) => {
      if (!r) return notFoundResponse("Order not found.");
      if ("resync" in r) after(() => syncOrderToQuickBooks(id));
      return Response.json({ ok: true, status: r.status });
    },
  );
}
