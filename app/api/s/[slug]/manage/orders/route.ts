import type { Params } from "@/lib/api-input";
import { loadBoard, type BoardFilter } from "@/lib/data/orders";
import { MANAGE, storeApi } from "@/lib/scope";

// Polled every few seconds by the seller's live board.
export async function GET(req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const raw = new URL(req.url).searchParams.get("filter");
  const filter: BoardFilter = raw === "all" || raw === "done" ? raw : "open";
  return Response.json(await loadBoard(ctx, filter));
}
