import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { readSession, SESSION_COOKIE, type Session } from "./session";

/** Looks the session up in the database (once per request). */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value);
});

/** For pages: only supplier staff get through. */
export async function requireSupplier(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "supplier") redirect("/shop");
  return s;
}

/** For pages: only restaurant staff get through. */
export async function requireBuyer(): Promise<Session & { restaurantId: string }> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "buyer" || !s.restaurantId) redirect("/supplier");
  return s as Session & { restaurantId: string };
}

/** For API routes: the session if it has the given role, else null. */
export async function apiSession(role: Session["role"]): Promise<Session | null> {
  const s = await getSession();
  return s && s.role === role ? s : null;
}

export function unauthorized() {
  return Response.json({ error: "Please sign in again." }, { status: 401 });
}

export function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}
