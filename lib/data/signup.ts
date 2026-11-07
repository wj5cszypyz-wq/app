// A seller opens a store: new account + store (unverified until they confirm their email).
import { db } from "../db";
import { appUrl, sendEmail } from "../email";
import { emailProblem, hashPassword, passwordProblem } from "../passwords";
import { normalizeSlug } from "../scope";
import { consumeToken, issueToken, revokeTokens, TTL } from "../tokens";

export const RESERVED_SLUGS = new Set([
  "admin", "api", "login", "logout", "signup", "stores", "verify", "reset", "forgot", "invite", "account", "join", "s",
  "help", "support", "www", "app", "static", "assets",
]);

export type SignUpInput = { name: string; email: string; password: string; storeName: string; slug: string };
export type SignUpResult = { ok: true } | { ok: false; error: string };

export function slugProblem(raw: string): string | null {
  const slug = normalizeSlug(raw);
  if (!slug || slug.length < 3) return "Use 3 to 48 letters, numbers or dashes for the web address.";
  if (RESERVED_SLUGS.has(slug)) return "That web address is reserved. Try another.";
  return null;
}

export async function sendVerification(userId: string, email: string) {
  await revokeTokens({ purpose: "verify_email", userId });
  const token = await issueToken({ purpose: "verify_email", userId, email, ttlMs: TTL.verify_email });
  await sendEmail({
    to: email,
    subject: "Confirm your email to open your store",
    text: `Confirm your email to open your store to customers:\n\n${appUrl(`/verify?token=${token}`)}\n\nThis link works once and expires in 24 hours. If you didn't sign up, ignore this email.`,
  });
}

export async function signUpSeller(input: SignUpInput): Promise<SignUpResult> {
  const name = input.name.trim();
  const storeName = input.storeName.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || name.length > 120) return { ok: false, error: "Add your name." };
  if (!storeName || storeName.length > 120) return { ok: false, error: "Add your store's name." };
  const bad = emailProblem(email) ?? passwordProblem(input.password) ?? slugProblem(input.slug);
  if (bad) return { ok: false, error: bad };
  const slug = normalizeSlug(input.slug)!;

  if (await db.store.findUnique({ where: { slug }, select: { id: true } })) {
    return { ok: false, error: "That web address is taken. Try another." };
  }

  // Never reveal whether an email already has an account: answer the same, and tell the owner by email.
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    await sendEmail({
      to: email,
      subject: "Someone tried to sign up with your email",
      text: `Someone tried to open a new store with this email address. You already have an account.\n\nSign in: ${appUrl("/login")}\nForgot your password? ${appUrl("/forgot")}\n\nIf this wasn't you, you can ignore this email.`,
    });
    return { ok: true };
  }

  const passwordHash = await hashPassword(input.password);
  try {
    const user = await db.$transaction(async (tx) => {
      const store = await tx.store.create({ data: { slug, name: storeName, status: "unverified" } });
      return tx.user.create({
        data: { email, name, passwordHash, memberships: { create: { storeId: store.id, role: "owner" } } },
      });
    });
    await sendVerification(user.id, email);
    return { ok: true };
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      // Lost a race for the same web address or email.
      return { ok: false, error: "That web address is taken. Try another." };
    }
    throw err;
  }
}

/** Confirms the email from the link; opens every unverified store this person owns. */
export async function verifyEmail(token: string): Promise<{ ok: true; slug: string | null } | { ok: false }> {
  const row = await consumeToken(token, "verify_email");
  if (!row?.userId) return { ok: false };
  const user = await db.user.update({
    where: { id: row.userId },
    data: { emailVerifiedAt: new Date() },
    include: { memberships: { where: { role: "owner" }, include: { store: true } } },
  });
  const unverified = user.memberships.filter((m) => m.store.status === "unverified").map((m) => m.storeId);
  if (unverified.length) await db.store.updateMany({ where: { id: { in: unverified } }, data: { status: "active" } });
  return { ok: true, slug: user.memberships[0]?.store.slug ?? null };
}

/** After sign-up: the new owner's id and store address if this email was just created (else null). */
export async function freshSignup(email: string): Promise<{ userId: string; slug: string } | null> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, emailVerifiedAt: true, createdAt: true, memberships: { select: { store: { select: { slug: true } } } } },
  });
  const fresh = user && !user.emailVerifiedAt && Date.now() - user.createdAt.getTime() < 60_000 && user.memberships.length === 1;
  return fresh ? { userId: user.id, slug: user.memberships[0].store.slug } : null;
}

/** Sends the confirmation email again if this person hasn't confirmed yet. */
export async function resendVerification(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
  if (!user.emailVerifiedAt) await sendVerification(userId, user.email);
}
