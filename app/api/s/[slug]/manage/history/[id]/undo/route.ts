import type { Params } from "@/lib/api-input";
import { notFoundResponse } from "@/lib/data/errors";
import { undoChange } from "@/lib/data/history";
import { MANAGE, storeApi } from "@/lib/scope";

// Undo one change (or redo it, when the change is itself an undo).
export async function POST(_req: Request, { params }: Params<{ id: string }>) {
  const { slug, id } = await params;
  const ctx = await storeApi(slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const r = await undoChange(ctx, id);
  if (!r) return notFoundResponse("Change not found.");
  return r.ok ? Response.json(r) : Response.json({ error: r.error }, { status: 409 });
}
