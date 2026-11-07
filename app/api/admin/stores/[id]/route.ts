import { getSession, unauthorized } from "@/lib/auth";
import { readJson } from "@/lib/api-input";
import { setStoreStatus } from "@/lib/data/admin";
import { notFoundResponse } from "@/lib/data/errors";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!s.isPlatformAdmin) return notFoundResponse();
  const { status } = await readJson(req);
  if (status !== "active" && status !== "suspended") return Response.json({ error: "Unknown status." }, { status: 400 });
  const ok = await setStoreStatus((await params).id, status);
  return ok ? Response.json({ ok: true, status }) : notFoundResponse("Store not found.");
}
