// Account security: forgot/reset password, change password, sign out of other devices.
import bcrypt from "bcryptjs";
import { db } from "../db";
import { appUrl, sendEmail } from "../email";
import { hashPassword, passwordProblem } from "../passwords";
import { consumeToken, issueToken, revokeTokens, TTL } from "../tokens";

type Result = { ok: true } | { ok: false; error: string };

/** Emails a reset link if the account exists. Callers always show the same message either way. */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;
  await revokeTokens({ purpose: "reset_password", userId: user.id });
  const token = await issueToken({ purpose: "reset_password", userId: user.id, email, ttlMs: TTL.reset_password });
  await sendEmail({
    to: email,
    subject: "Reset your password",
    text: `Use this link to choose a new password:\n\n${appUrl(`/reset?token=${token}`)}\n\nIt works once and expires in 30 minutes. If you didn't ask for this, ignore this email; your password stays the same.`,
  });
}

/** Sets a new password from an emailed link and signs the account out everywhere. */
export async function resetPassword(token: string, password: string): Promise<Result> {
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };
  const row = await consumeToken(token, "reset_password");
  if (!row?.userId) return { ok: false, error: "This link has expired or was already used." };
  const before = await db.user.findUniqueOrThrow({ where: { id: row.userId }, select: { emailVerifiedAt: true } });
  // First proof that this person owns the email: anything set up before then (e.g. two-step by someone
  // who signed up with their address) is cleared.
  const firstProof = before.emailVerifiedAt ? {} : { totpSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: null };
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date(), ...firstProof } }),
    db.session.deleteMany({ where: { userId: row.userId } }),
  ]);
  return { ok: true };
}

/** Changes the password; keeps this session and signs out every other one. */
export async function changePassword(userId: string, sessionId: string, current: string, next: string): Promise<Result> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (typeof current !== "string" || !(await bcrypt.compare(current, user.passwordHash))) {
    return { ok: false, error: "Your current password isn't right." };
  }
  const problem = passwordProblem(next);
  if (problem) return { ok: false, error: problem };
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } }),
    db.session.deleteMany({ where: { userId, id: { not: sessionId } } }),
  ]);
  return { ok: true };
}

export async function signOutOtherSessions(userId: string, sessionId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId, id: { not: sessionId } } });
}

/** What the account page shows. */
export async function accountSummary(userId: string) {
  const [user, sessions] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, emailVerifiedAt: true, totpEnabledAt: true } }),
    db.session.count({ where: { userId, expiresAt: { gt: new Date() } } }),
  ]);
  return { ...user, sessions };
}
