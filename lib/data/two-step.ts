// Optional two-step sign-in: after the password, a 6-digit code from an authenticator app
// (or a one-time recovery code). Secrets are stored encrypted; recovery codes only as hashes.
import { createHash, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { APP_NAME } from "../brand";
import { decrypt, encrypt } from "../crypto";
import { db } from "../db";
import { consumeToken, issueToken, peekToken, TTL } from "../tokens";
import { base32Encode, verifyTotp } from "../totp";

const MAX_ATTEMPTS = 8;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const normalizeRecovery = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Step 1 of turning it on: a new secret (not active until a code is confirmed). */
export async function startTwoStep(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, totpEnabledAt: true, emailVerifiedAt: true } });
  if (user.totpEnabledAt) throw new Error("Two-step sign-in is already on.");
  // Stops someone who signed up with a stranger's email from locking the real owner out later.
  if (!user.emailVerifiedAt) throw new Error("Confirm your email first, then turn on two-step sign-in.");
  const secret = base32Encode(randomBytes(20));
  await db.user.update({ where: { id: userId }, data: { totpSecret: encrypt(secret), totpLastStep: null } });
  const label = encodeURIComponent(`${APP_NAME}:${user.email}`);
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(APP_NAME)}&algorithm=SHA1&digits=6&period=30`;
  const qrSvg = await QRCode.toString(uri, { type: "svg", margin: 1, width: 180 });
  return { secret, uri, qrSvg };
}

async function checkCode(userId: string, code: string): Promise<boolean> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { totpSecret: true, totpLastStep: true, recoveryCodes: true } });
  const clean = code.replace(/\s/g, "");
  if (/^\d{6}$/.test(clean) && user.totpSecret) {
    const step = verifyTotp(decrypt(user.totpSecret), clean);
    if (step === null) return false;
    // Each code can be used once: only accept a step newer than the last one used.
    const r = await db.user.updateMany({
      where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return r.count === 1;
  }
  const hashes: string[] = user.recoveryCodes ? JSON.parse(user.recoveryCodes) : [];
  const h = sha(normalizeRecovery(clean));
  if (!hashes.includes(h)) return false;
  const r = await db.user.updateMany({
    where: { id: userId, recoveryCodes: user.recoveryCodes },
    data: { recoveryCodes: JSON.stringify(hashes.filter((x) => x !== h)) },
  });
  return r.count === 1;
}

/** Step 2: confirm with a code; turns it on and returns recovery codes (shown once). */
export async function enableTwoStep(userId: string, code: string): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { totpSecret: true, totpEnabledAt: true } });
  if (user.totpEnabledAt || !user.totpSecret) return { ok: false, error: "Start the setup again." };
  const step = verifyTotp(decrypt(user.totpSecret), code.replace(/\s/g, ""));
  if (step === null) return { ok: false, error: "That code isn't right. Check your app and try again." };
  const recoveryCodes = Array.from({ length: 10 }, () => {
    const raw = base32Encode(randomBytes(5)).toLowerCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
  await db.user.update({
    where: { id: userId },
    data: {
      totpEnabledAt: new Date(),
      totpLastStep: step,
      recoveryCodes: JSON.stringify(recoveryCodes.map((c) => sha(normalizeRecovery(c)))),
    },
  });
  return { ok: true, recoveryCodes };
}

export async function disableTwoStep(userId: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await checkCode(userId, code))) return { ok: false, error: "That code isn't right." };
  await db.user.update({
    where: { id: userId },
    data: { totpEnabledAt: null, totpSecret: null, totpLastStep: null, recoveryCodes: null },
  });
  return { ok: true };
}

/** After a correct password: a short-lived ticket instead of a session. */
export async function beginTwoStepLogin(userId: string): Promise<string> {
  return issueToken({ purpose: "two_step", userId, ttlMs: TTL.two_step });
}

const PER_USER_FAILURES = 20;
const failures = new Map<string, { count: number; until: number }>();

/** Wrong codes across all of a person's sign-in attempts: after 20 in 15 minutes, two-step is locked for 15 minutes. */
function lockedOut(userId: string): boolean {
  const f = failures.get(userId);
  return Boolean(f && f.until > Date.now() && f.count >= PER_USER_FAILURES);
}
function noteFailure(userId: string) {
  const now = Date.now();
  const f = failures.get(userId);
  if (!f || f.until <= now) failures.set(userId, { count: 1, until: now + 15 * 60_000 });
  else f.count++;
}

export async function finishTwoStepLogin(ticket: string, code: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const expired = { ok: false as const, error: "This sign-in expired. Start again." };
  const row = await peekToken(ticket, "two_step");
  if (!row?.userId) return expired;
  if (lockedOut(row.userId)) return { ok: false, error: "Too many wrong codes. Wait 15 minutes, then sign in again." };
  // Count the attempt before checking it, atomically, so parallel guesses can't get past the limit.
  const counted = await db.authToken.updateMany({
    where: { id: row.id, usedAt: null, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count !== 1) {
    await consumeToken(ticket, "two_step");
    return expired;
  }
  if (!(await checkCode(row.userId, typeof code === "string" ? code : ""))) {
    noteFailure(row.userId);
    return { ok: false, error: "That code isn't right." };
  }
  const used = await consumeToken(ticket, "two_step");
  if (used) failures.delete(row.userId);
  return used ? { ok: true, userId: row.userId } : expired;
}
