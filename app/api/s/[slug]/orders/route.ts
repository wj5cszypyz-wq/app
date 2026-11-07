import { after } from "next/server";
import { badRequest } from "@/lib/auth";
import type { Params } from "@/lib/api-input";
import { respond } from "@/lib/data/errors";
import { placeOrder } from "@/lib/data/orders";
import { isoDate, parseOrderInput } from "@/lib/orders";
import { BUY, storeApi } from "@/lib/scope";
import { syncOrderToQuickBooks } from "@/lib/sync";

// A customer places an order. The invoice is pushed to QuickBooks right after we respond.
export async function POST(req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, BUY);
  if (ctx instanceof Response) return ctx;

  const input = parseOrderInput(await req.json().catch(() => null), isoDate(new Date()));
  if ("error" in input) return badRequest(input.error);

  return respond(
    () => placeOrder(ctx, input),
    (placed) => {
      after(() => syncOrderToQuickBooks(placed.id));
      return Response.json(placed, { status: 201 });
    },
  );
}
