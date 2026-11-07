import { readJson, str } from "@/lib/api-input";
import { resetPassword } from "@/lib/data/account";

export async function POST(req: Request) {
  const b = await readJson(req);
  const r = await resetPassword(str(b, "token"), typeof b.password === "string" ? b.password : "");
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  return Response.json({ message: "Password changed. You've been signed out everywhere; sign in with your new password." });
}
