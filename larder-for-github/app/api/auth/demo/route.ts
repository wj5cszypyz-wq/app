import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { DEMO_USERS, demoEnabled } from "@/lib/demo";
import { cookieOptions, createSession, SESSION_COOKIE } from "@/lib/session";

// One-click demo sign-in for local testing. No password ever reaches the browser.
export async function POST(req: Request) {
  if (!demoEnabled()) return Response.json({ error: "Not found." }, { status: 404 });
  const { role } = (await req.json().catch(() => ({}))) as { role?: unknown };
  if (role !== "supplier" && role !== "buyer") return Response.json({ error: "Unknown demo." }, { status: 400 });

  const user = await db.user.findUnique({ where: { email: DEMO_USERS[role] } });
  if (!user) return Response.json({ error: "Demo data missing. Run: npm run setup" }, { status: 404 });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSession(user.id), cookieOptions());
  return Response.json({ redirect: role === "supplier" ? "/supplier" : "/shop" });
}
