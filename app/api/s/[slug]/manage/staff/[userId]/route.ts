import type { Params } from "@/lib/api-input";
import { notFoundResponse, respond } from "@/lib/data/errors";
import { removeStaff } from "@/lib/data/invites";
import { OWNER, storeApi } from "@/lib/scope";

export async function DELETE(_req: Request, { params }: Params<{ userId: string }>) {
  const { slug, userId } = await params;
  const ctx = await storeApi(slug, OWNER);
  if (ctx instanceof Response) return ctx;
  return respond(() => removeStaff(ctx, userId), (ok) => (ok ? Response.json({ ok: true }) : notFoundResponse("Staff member not found.")));
}
