import { badRequest } from "@/lib/auth";
import { moneyInput, readJson, type Params } from "@/lib/api-input";
import { setCustomerPrices } from "@/lib/data/customers";
import { notFoundResponse, respond } from "@/lib/data/errors";
import { parseMoney } from "@/lib/money";
import { MANAGE, storeApi } from "@/lib/scope";

// Saves this customer's special prices. A blank price means "use the list price".
export async function PUT(req: Request, { params }: Params<{ id: string }>) {
  const { slug, id } = await params;
  const ctx = await storeApi(slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const b = await readJson(req);
  if (!Array.isArray(b.prices) || b.prices.length > 2000) return badRequest("Invalid prices.");

  const upserts: { productId: string; priceCents: number }[] = [];
  const removals: string[] = [];
  for (const raw of b.prices) {
    const row = (raw ?? {}) as { productId?: unknown; price?: unknown };
    if (typeof row.productId !== "string") return badRequest("Unknown product.");
    if (row.price === null || row.price === "") {
      removals.push(row.productId);
      continue;
    }
    const cents = parseMoney(moneyInput(row.price));
    if (cents === null || cents === 0) return badRequest("One of the prices isn't valid.");
    upserts.push({ productId: row.productId, priceCents: cents });
  }

  return respond(
    () => setCustomerPrices(ctx, id, upserts, removals),
    (r) => (r ? Response.json({ ok: true, ...r }) : notFoundResponse("Customer not found.")),
  );
}
