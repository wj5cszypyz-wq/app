import { getSession } from "@/lib/auth";
import { resendVerification } from "@/lib/data/signup";
import { hit } from "@/lib/rate-limit";

export async function POST() {
  const s = await getSession();
  if (!s) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (hit(`resend:${s.userId}`, 3, 60 * 60_000)) return Response.json({ error: "Email already sent. Check your inbox (and spam)." }, { status: 429 });
  await resendVerification(s.userId);
  return Response.json({ ok: true });
}
