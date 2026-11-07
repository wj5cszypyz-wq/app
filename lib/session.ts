// Server-side sessions.
// - The browser gets a random 256-bit token in an HttpOnly cookie: JavaScript can't read it, and it
//   contains no user data, so there is nothing to decode or "retrace".
// - The database stores only SHA-256(token). A leaked database can't be used to sign in.
// - Signing out deletes the session on the server, so a copied cookie stops working immediately.
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

export { SESSION_COOKIE } from "./cookie-name";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days, renewed while in use

// Who is signed in. Which stores they can use is checked per request in lib/scope.ts.
export type Session = {
  sessionId: string;
  userId: string;
  name: string;
  isPlatformAdmin: boolean;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function cookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000) },
  });
  // Housekeeping: drop expired sessions.
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return token;
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const id = hashToken(token);
  const row = await db.session.findUnique({ where: { id }, include: { user: true } });
  if (!row) return null;

  const now = Date.now();
  if (row.expiresAt.getTime() <= now) {
    await db.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  // Sliding renewal once half the lifetime has passed.
  if (row.expiresAt.getTime() - now < (SESSION_TTL_SECONDS * 1000) / 2) {
    await db.session
      .update({ where: { id }, data: { expiresAt: new Date(now + SESSION_TTL_SECONDS * 1000) } })
      .catch(() => {});
  }

  const u = row.user;
  return { sessionId: id, userId: u.id, name: u.name, isPlatformAdmin: u.isPlatformAdmin };
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}
