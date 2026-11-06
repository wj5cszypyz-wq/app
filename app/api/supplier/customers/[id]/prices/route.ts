import { apiSession, badRequest, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseMoney } from "@/lib/money";

// Saves this restaurant's custom prices. A blank price means "use the list price".
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("supplier");
  if (!s) return unauthorized();
  const { id } = await params;

  const restaurant = await db.restaurant.findFirst({ where: { id, supplierId: s.supplierId } });
  if (!restaurant) return Response.json({ error: "Customer not found." }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as { prices?: unknown };
  if (!Array.isArray(b.prices)) return badRequest("Invalid prices.");

  const ownProducts = new Set(
    (await db.product.findMany({ where: { supplierId: s.supplierId }, select: { id: true } })).map((p) => p.id),
  );

  const upserts: { productId: string; priceCents: number }[] = [];
  const removals: string[] = [];
  for (const raw of b.prices) {
    const row = raw as { productId?: unknown; price?: unknown };
    if (typeof row.productId !== "string" || !ownProducts.has(row.productId)) return badRequest("Unknown product.");
    if (row.price === null || row.price === "") {
      removals.push(row.productId);
      continue;
    }
    const cents = parseMoney(typeof row.price === "string" || typeof row.price === "number" ? row.price : "");
    if (cents === null || cents === 0) return badRequest("One of the prices isn't valid.");
    upserts.push({ productId: row.productId, priceCents: cents });
  }

  await db.$transaction([
    db.customerPrice.deleteMany({ where: { restaurantId: id, productId: { in: removals } } }),
    ...upserts.map((u) =>
      db.customerPrice.upsert({
        where: { restaurantId_productId: { restaurantId: id, productId: u.productId } },
        create: { restaurantId: id, ...u },
        update: { priceCents: u.priceCents },
      }),
    ),
  ]);
  return Response.json({ ok: true, saved: upserts.length, cleared: removals.length });
}
