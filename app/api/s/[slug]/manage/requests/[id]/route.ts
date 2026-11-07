import { badRequest } from "@/lib/auth";
import { readJson, type Params } from "@/lib/api-input";
import { notFoundResponse, respond } from "@/lib/data/errors";
import { approveRequest, declineRequest } from "@/lib/data/requests";
import { MANAGE, storeApi } from "@/lib/scope";

export async function POST(req: Request, { params }: Params<{ id: string }>) {
  const { slug, id } = await params;
  const ctx = await storeApi(slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const { action } = await readJson(req);
  if (action !== "approve" && action !== "decline") return badRequest("Unknown action.");
  return respond(
    () => (action === "approve" ? approveRequest(ctx, id) : declineRequest(ctx, id)),
    (ok) => (ok ? Response.json({ ok: true }) : notFoundResponse("Request not found.")),
  );
}
