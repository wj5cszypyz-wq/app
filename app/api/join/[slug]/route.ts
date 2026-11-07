import { readJson, str } from "@/lib/api-input";
import { submitAccountRequest } from "@/lib/data/requests";
import { clientIp, hit } from "@/lib/rate-limit";

// Public: a new customer asks a store for an account (only if the store turned this on).
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (hit(`join:${clientIp(req)}`, 5, 3_600_000)) return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  const b = await readJson(req);
  const r = await submitAccountRequest((await params).slug, {
    businessName: str(b, "businessName"),
    contactName: str(b, "contactName"),
    email: str(b, "email"),
    phone: str(b, "phone"),
    message: str(b, "message"),
  });
  if (r.ok) return Response.json({ message: "Thanks! The store will review your request and email you an invite." });
  if ("notFound" in r) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ error: r.error }, { status: 400 });
}
