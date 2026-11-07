import { getSession, unauthorized } from "@/lib/auth";
import { signOutOtherSessions } from "@/lib/data/account";

export async function POST() {
  const s = await getSession();
  if (!s) return unauthorized();
  await signOutOtherSessions(s.userId, s.sessionId);
  return Response.json({ message: "Signed out on every other device." });
}
