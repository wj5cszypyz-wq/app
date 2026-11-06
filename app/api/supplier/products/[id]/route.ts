import { apiSession, badRequest, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseMoney } from "@/lib/money";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("supplier");
  if (!s) return unauthorized();
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const data: { priceCents?: number; inStock?: boolean; active?: boolean } = {};
  if (b.price !== undefined) {
    const cents = parseMoney(typeof b.price === "string" || typeof b.price === "number" ? b.price : "");
    if (cents === null || cents === 0) return badRequest("Enter a valid price.");
    data.priceCents = cents;
  }
  if (typeof b.inStock === "boolean") data.inStock = b.inStock;
  if (typeof b.active === "boolean") data.active = b.active;
  if (Object.keys(data).length === 0) return badRequest("Nothing to update.");

  const result = await db.product.updateMany({ where: { id, supplierId: s.supplierId }, data });
  if (result.count === 0) return Response.json({ error: "Product not found." }, { status: 404 });
  return Response.json({ ok: true, ...data });
}
