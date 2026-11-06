import { after } from "next/server";
import { apiSession, badRequest, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildLines, isoDate, parseOrderInput, type PricedProduct } from "@/lib/orders";
import { syncOrderToQuickBooks } from "@/lib/sync";

// A restaurant places an order. The invoice is pushed to QuickBooks right after we respond.
export async function POST(req: Request) {
  const s = await apiSession("buyer");
  if (!s || !s.restaurantId) return unauthorized();
  const restaurantId = s.restaurantId;

  const input = parseOrderInput(await req.json().catch(() => null), isoDate(new Date()));
  if ("error" in input) return badRequest(input.error);

  const ids = input.lines.map((l) => l.productId);
  const [products, overrides] = await Promise.all([
    db.product.findMany({ where: { id: { in: ids }, supplierId: s.supplierId, active: true } }),
    db.customerPrice.findMany({ where: { restaurantId, productId: { in: ids } } }),
  ]);
  const custom = new Map(overrides.map((o) => [o.productId, o.priceCents]));
  const priced = new Map<string, PricedProduct>(
    products.map((p) => [p.id, { ...p, priceCents: custom.get(p.id) ?? p.priceCents }]),
  );

  const built = buildLines(input.lines, priced);
  if ("error" in built) return badRequest(built.error);

  // Two restaurants ordering at the same instant could grab the same order number; the unique index
  // rejects the second one, so we simply retry with the next number.
  let order: { id: string; number: number } | null = null;
  for (let attempt = 0; attempt < 5 && !order; attempt++) {
    try {
      order = await db.$transaction(async (tx) => {
        const last = await tx.order.findFirst({
          where: { supplierId: s.supplierId },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        return tx.order.create({
          data: {
            supplierId: s.supplierId,
            restaurantId,
            number: (last?.number ?? 1000) + 1,
            deliveryDate: input.deliveryDate ? new Date(`${input.deliveryDate}T12:00:00`) : null,
            notes: input.notes,
            subtotalCents: built.subtotalCents,
            lines: { create: built.lines },
          },
          select: { id: true, number: true },
        });
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "P2002" || attempt === 4) throw err;
    }
  }
  if (!order) return Response.json({ error: "Couldn't place the order. Please try again." }, { status: 503 });

  const placed = order;
  after(() => syncOrderToQuickBooks(placed.id));
  return Response.json({ id: placed.id, number: placed.number }, { status: 201 });
}
