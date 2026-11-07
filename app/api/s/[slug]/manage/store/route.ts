import { badRequest } from "@/lib/auth";
import { readJson, type Params } from "@/lib/api-input";
import { respond } from "@/lib/data/errors";
import { setAllowAccountRequests } from "@/lib/data/requests";
import { OWNER, storeApi } from "@/lib/scope";

// Store settings the owner can change.
export async function PATCH(req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, OWNER);
  if (ctx instanceof Response) return ctx;
  const b = await readJson(req);
  if (typeof b.allowAccountRequests !== "boolean") return badRequest("Nothing to update.");
  const allow = b.allowAccountRequests;
  return respond(() => setAllowAccountRequests(ctx, allow), () => Response.json({ ok: true, allowAccountRequests: allow }));
}
