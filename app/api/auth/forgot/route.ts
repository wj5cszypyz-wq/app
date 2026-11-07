import { readJson, str } from "@/lib/api-input";
import { requestPasswordReset } from "@/lib/data/account";
import { clientIp, hit } from "@/lib/rate-limit";

const SAME_ANSWER = "If that email has an account, a reset link is on its way. It expires in 30 minutes.";

export async function POST(req: Request) {
  const email = str(await readJson(req), "email").toLowerCase().slice(0, 254);
  const wait = Math.max(hit(`forgot-ip:${clientIp(req)}`, 20, 3_600_000), hit(`forgot:${email}`, 5, 3_600_000));
  if (wait) return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  if (email) await requestPasswordReset(email);
  return Response.json({ message: SAME_ANSWER });
}
