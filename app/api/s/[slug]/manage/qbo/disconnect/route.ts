import type { Params } from "@/lib/api-input";
import { getStoreForCtx } from "@/lib/data/stores";
import { disconnect } from "@/lib/qbo";
import { OWNER, storeApi } from "@/lib/scope";

export async function POST(_req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, OWNER);
  if (ctx instanceof Response) return ctx;
  await disconnect(await getStoreForCtx(ctx));
  return Response.json({ ok: true });
}
