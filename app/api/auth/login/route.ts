import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { beginTwoStepLogin } from "@/lib/data/two-step";
import { clientIp, hit, reset } from "@/lib/rate-limit";
import { completeSignIn } from "@/lib/sign-in";

// Compared against when the email doesn't exist, so a wrong email takes as long as a wrong password
// (stops attackers from discovering which emails have accounts by timing the response).
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-not-a-real-account", 10);
const WINDOW = 15 * 60_000;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown; next?: unknown };
  if (typeof body.email !== "string" || typeof body.password !== "string" || !body.email || !body.password) {
    return Response.json({ error: "Enter your email and password." }, { status: 400 });
  }
  if (body.email.length > 254 || body.password.length > 200) {
    return Response.json({ error: "That email and password don't match." }, { status: 401 });
  }
  const email = body.email.trim().toLowerCase();

  const ip = clientIp(req);
  const wait = Math.max(hit(`ip:${ip}`, 30, WINDOW), hit(`email:${email}`, 8, WINDOW));
  if (wait) {
    return Response.json(
      { error: `Too many sign-in attempts. Try again in ${Math.ceil(wait / 60)} minutes.` },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(body.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return Response.json({ error: "That email and password don't match." }, { status: 401 });

  if (user.totpEnabledAt) {
    // Password was right, but two-step is on: no session until the code is checked.
    return Response.json({ twoStep: true, ticket: await beginTwoStepLogin(user.id) });
  }
  reset(`email:${email}`); // only once fully signed in; with two-step on, the limit stays until the code is right
  return completeSignIn(user.id, body.next);
}
