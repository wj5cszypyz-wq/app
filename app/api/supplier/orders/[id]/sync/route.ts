import { apiSession, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncOrderToQuickBooks } from "@/lib/sync";

// "Retry" button: sends the order to QuickBooks now and reports the result.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("supplier");
  if (!s) return unauthorized();
  const { id } = await params;
  const owned = await db.order.findFirst({ where: { id, supplierId: s.supplierId }, select: { id: true } });
  if (!owned) return Response.json({ error: "Order not found." }, { status: 404 });

  const order = await syncOrderToQuickBooks(id);
  return Response.json({
    qboSyncStatus: order?.qboSyncStatus,
    qboDocNumber: order?.qboDocNumber ?? null,
    qboInvoiceId: order?.qboInvoiceId ?? null,
    qboError: order?.qboError ?? null,
  });
}
