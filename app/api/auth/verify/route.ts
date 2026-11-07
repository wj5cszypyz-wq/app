import { readJson, str } from "@/lib/api-input";
import { verifyEmail } from "@/lib/data/signup";

export async function POST(req: Request) {
  const r = await verifyEmail(str(await readJson(req), "token"));
  if (!r.ok) return Response.json({ error: "This link has expired or was already used. Sign in and send a new one." }, { status: 400 });
  return Response.json({ redirect: r.slug ? `/s/${r.slug}/manage` : "/stores" });
}
