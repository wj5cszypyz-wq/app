import { cookies } from "next/headers";
import { cookieOptions, destroySession, SESSION_COOKIE } from "@/lib/session";

// Deletes the session on the server (a copied cookie stops working) and clears the cookie.
export async function POST() {
  const jar = await cookies();
  await destroySession(jar.get(SESSION_COOKIE)?.value);
  jar.set(SESSION_COOKIE, "", cookieOptions(0));
  return Response.json({ redirect: "/login" });
}
