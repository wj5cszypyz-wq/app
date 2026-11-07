import { readJson, str } from "@/lib/api-input";
import { finishTwoStepLogin } from "@/lib/data/two-step";
import { clientIp, hit } from "@/lib/rate-limit";
import { completeSignIn } from "@/lib/sign-in";

export async function POST(req: Request) {
  if (hit(`two-step:${clientIp(req)}`, 30, 15 * 60_000)) return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const b = await readJson(req);
  const r = await finishTwoStepLogin(str(b, "ticket"), str(b, "code"));
  if (!r.ok) return Response.json({ error: r.error }, { status: 401 });
  return completeSignIn(r.userId, b.next);
}
