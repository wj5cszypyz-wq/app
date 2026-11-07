import { cookies } from "next/headers";
import { cache } from "react";
import { readSession, SESSION_COOKIE, type Session } from "./session";

/** Looks the session up in the database (once per request). */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value);
});

export function unauthorized() {
  return Response.json({ error: "Please sign in again." }, { status: 401 });
}

export function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}
