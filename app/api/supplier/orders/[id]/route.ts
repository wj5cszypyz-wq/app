import { apiSession, badRequest, unauthorized } from "@/lib/auth";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/catalog";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("supplier");
  if (!s) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: unknown };
  if (typeof body.status !== "string" || !ORDER_STATUSES.includes(body.status as OrderStatus)) {
    return badRequest("Unknown status.");
  }
  const result = await db.order.updateMany({ where: { id, supplierId: s.supplierId }, data: { status: body.status } });
  if (result.count === 0) return Response.json({ error: "Order not found." }, { status: 404 });
  return Response.json({ ok: true, status: body.status });
}
