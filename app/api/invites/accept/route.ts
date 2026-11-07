import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { readJson, str } from "@/lib/api-input";
import { acceptInvite } from "@/lib/data/invites";
import { clientIp, hit } from "@/lib/rate-limit";
import { cookieOptions, createSession, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  if (hit(`invite:${clientIp(req)}`, 20, 15 * 60_000)) return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const b = await readJson(req);
  const session = await getSession();
  const r = await acceptInvite(str(b, "token"), {
    sessionUserId: session?.userId ?? null,
    name: str(b, "name"),
    password: typeof b.password === "string" ? b.password : "",
  });
  if (!r.ok) return Response.json({ error: r.error === "sign_in_required" ? "You already have an account. Sign in first." : r.error }, { status: 400 });
  if (r.newUser) {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, await createSession(r.userId), cookieOptions());
  }
  return Response.json({ redirect: r.home });
}
