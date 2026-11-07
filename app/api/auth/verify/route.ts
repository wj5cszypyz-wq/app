import { cookies } from "next/headers";
import { readJson, str } from "@/lib/api-input";
import { verifyEmail } from "@/lib/data/signup";
import { cookieOptions, createSession, SESSION_COOKIE } from "@/lib/session";

// Confirms the email and signs the person in: only they could have opened the emailed link.
export async function POST(req: Request) {
  const r = await verifyEmail(str(await readJson(req), "token"));
  if (!r.ok) return Response.json({ error: "This link has expired or was already used. Sign in and send a new one." }, { status: 400 });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSession(r.userId), cookieOptions());
  return Response.json({ redirect: r.slug ? `/s/${r.slug}/manage/setup` : "/stores" });
}
