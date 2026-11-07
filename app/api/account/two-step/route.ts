import { getSession, unauthorized } from "@/lib/auth";
import { readJson, str } from "@/lib/api-input";
import { disableTwoStep, enableTwoStep, startTwoStep } from "@/lib/data/two-step";
import { hit } from "@/lib/rate-limit";

// action: "start" (new secret + QR), "enable" (confirm a code), "disable" (needs a code)
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (hit(`two-step-setup:${s.userId}`, 20, 15 * 60_000)) return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const b = await readJson(req);
  const action = str(b, "action");
  if (action === "start") {
    try {
      const { secret, qrSvg } = await startTwoStep(s.userId);
      return Response.json({ secret, qrSvg });
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : "Couldn't start." }, { status: 400 });
    }
  }
  if (action === "enable") {
    const r = await enableTwoStep(s.userId, str(b, "code"));
    return r.ok ? Response.json({ recoveryCodes: r.recoveryCodes }) : Response.json({ error: r.error }, { status: 400 });
  }
  if (action === "disable") {
    const r = await disableTwoStep(s.userId, str(b, "code"));
    return r.ok ? Response.json({ ok: true }) : Response.json({ error: r.error }, { status: 400 });
  }
  return Response.json({ error: "Unknown action." }, { status: 400 });
}
