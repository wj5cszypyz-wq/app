import { apiSession, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { disconnect } from "@/lib/qbo";

export async function POST() {
  const s = await apiSession("supplier");
  if (!s) return unauthorized();
  const supplier = await db.supplier.findUniqueOrThrow({ where: { id: s.supplierId } });
  await disconnect(supplier);
  return Response.json({ ok: true });
}
