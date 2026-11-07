// Finishes a successful sign-in: new session cookie, then the right first page.
import { cookies } from "next/headers";
import { listMembershipsForUser } from "./data/stores";
import { safeNextPath } from "./next-path";
import { cookieOptions, createSession, SESSION_COOKIE } from "./session";

export async function completeSignIn(userId: string, next: unknown): Promise<Response> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSession(userId), cookieOptions());
  const stores = await listMembershipsForUser(userId);
  const home =
    stores.length === 1 ? (stores[0].role === "buyer" ? `/s/${stores[0].slug}` : `/s/${stores[0].slug}/manage`) : "/stores";
  return Response.json({ redirect: safeNextPath(next, stores.map((s) => s.slug)) ?? home });
}
