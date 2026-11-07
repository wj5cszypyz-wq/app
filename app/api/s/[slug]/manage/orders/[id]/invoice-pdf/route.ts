import type { Params } from "@/lib/api-input";
import { notFoundResponse } from "@/lib/data/errors";
import { getOrderForStore } from "@/lib/data/orders";
import { getStoreForCtx } from "@/lib/data/stores";
import { invoicePdf, QboError } from "@/lib/qbo";
import { MANAGE, storeApi } from "@/lib/scope";

// Streams QuickBooks' own PDF of the invoice, exactly as QuickBooks would print it.
export async function GET(_req: Request, { params }: Params<{ id: string }>) {
  const { slug, id } = await params;
  const ctx = await storeApi(slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const order = await getOrderForStore(ctx, id);
  if (!order) return notFoundResponse("Order not found.");
  if (!order.qboInvoiceId) return Response.json({ error: "This order isn't in QuickBooks yet." }, { status: 409 });

  try {
    const pdf = await invoicePdf(await getStoreForCtx(ctx), order.qboInvoiceId);
    const name = String(order.qboDocNumber ?? order.number).replace(/[^A-Za-z0-9-]/g, "");
    return new Response(pdf, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="invoice-${name}.pdf"` },
    });
  } catch (err) {
    const status = err instanceof QboError && err.status ? err.status : 502;
    return Response.json({ error: err instanceof Error ? err.message : "QuickBooks error" }, { status });
  }
}
