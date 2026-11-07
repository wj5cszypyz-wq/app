import type { Params } from "@/lib/api-input";
import { notFoundResponse } from "@/lib/data/errors";
import { undoImport } from "@/lib/data/qbo-import";
import { MANAGE, storeApi } from "@/lib/scope";

export async function POST(_req: Request, { params }: Params<{ id: string }>) {
  const { slug, id } = await params;
  const ctx = await storeApi(slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const r = await undoImport(ctx, id);
  return r ? Response.json({ ok: true, ...r }) : notFoundResponse("That import was already undone or doesn't exist.");
}
