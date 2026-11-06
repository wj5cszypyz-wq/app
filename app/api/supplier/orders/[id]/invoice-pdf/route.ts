import { apiSession, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoicePdf, QboError } from "@/lib/qbo";

// Streams QuickBooks' own PDF of the invoice, exactly as QuickBooks would print it.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("supplier");
  if (!s) return unauthorized();
  const { id } = await params;
  const order = await db.order.findFirst({ where: { id, supplierId: s.supplierId }, include: { supplier: true } });
  if (!order?.qboInvoiceId) return Response.json({ error: "This order isn't in QuickBooks yet." }, { status: 404 });

  try {
    const pdf = await invoicePdf(order.supplier, order.qboInvoiceId);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${order.qboDocNumber ?? order.number}.pdf"`,
      },
    });
  } catch (err) {
    const status = err instanceof QboError && err.status ? err.status : 502;
    return Response.json({ error: err instanceof Error ? err.message : "QuickBooks error" }, { status });
  }
}
