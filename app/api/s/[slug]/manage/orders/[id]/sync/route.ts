import type { Params } from "@/lib/api-input";
import { notFoundResponse } from "@/lib/data/errors";
import { getOrderForStore } from "@/lib/data/orders";
import { MANAGE, storeApi } from "@/lib/scope";
import { syncOrderToQuickBooks } from "@/lib/sync";

// "Retry" button: sends the order to QuickBooks now and reports the result.
export async function POST(_req: Request, { params }: Params<{ id: string }>) {
  const { slug, id } = await params;
  const ctx = await storeApi(slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const owned = await getOrderForStore(ctx, id);
  if (!owned) return notFoundResponse("Order not found.");

  const order = await syncOrderToQuickBooks(owned.id);
  return Response.json({
    qboSyncStatus: order?.qboSyncStatus,
    qboDocNumber: order?.qboDocNumber ?? null,
    qboInvoiceId: order?.qboInvoiceId ?? null,
    qboError: order?.qboError ?? null,
  });
}
