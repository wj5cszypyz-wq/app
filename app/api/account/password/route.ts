import { getSession, unauthorized } from "@/lib/auth";
import { readJson } from "@/lib/api-input";
import { changePassword } from "@/lib/data/account";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const b = await readJson(req);
  const r = await changePassword(
    s.userId,
    s.sessionId,
    typeof b.current === "string" ? b.current : "",
    typeof b.password === "string" ? b.password : "",
  );
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  return Response.json({ message: "Password changed. Other devices have been signed out." });
}
