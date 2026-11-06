import { apiSession, unauthorized } from "@/lib/auth";
import { loadBoard } from "@/lib/queries";

// Polled every few seconds by the supplier's live board.
export async function GET(req: Request) {
  const s = await apiSession("supplier");
  if (!s) return unauthorized();
  const filter = new URL(req.url).searchParams.get("filter") ?? "open";
  return Response.json(await loadBoard(s.supplierId, filter));
}
