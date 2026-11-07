// One-time tokens for emailed links and two-step sign-in. The person gets a random 256-bit value;
// we keep only its SHA-256, so a copy of the database can't be used to click anyone's link.
import { randomBytes } from "node:crypto";
import type { AuthToken } from "@prisma/client";
import { db } from "./db";
import { hashToken } from "./session";

export type TokenPurpose = "verify_email" | "reset_password" | "invite" | "two_step";

export const TTL = {
  verify_email: 24 * 3_600_000,
  reset_password: 30 * 60_000,
  invite: 7 * 24 * 3_600_000,
  two_step: 5 * 60_000,
} as const;

export async function issueToken(data: {
  purpose: TokenPurpose;
  userId?: string;
  email?: string;
  storeId?: string;
  customerId?: string;
  role?: string;
  ttlMs: number;
}): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  const { ttlMs, ...rest } = data;
  await db.authToken.create({ data: { ...rest, id: hashToken(raw), expiresAt: new Date(Date.now() + ttlMs) } });
  return raw;
}

function valid(raw: string): boolean {
  return typeof raw === "string" && raw.length >= 20 && raw.length <= 100;
}

/** Reads a token without using it up (e.g. to show who an invite is for). */
export async function peekToken(raw: string, purpose: TokenPurpose): Promise<AuthToken | null> {
  if (!valid(raw)) return null;
  const row = await db.authToken.findUnique({ where: { id: hashToken(raw) } });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;
  return row;
}

/** Uses a token up. Safe against double clicks and races: only one caller can ever get it. */
export async function consumeToken(raw: string, purpose: TokenPurpose): Promise<AuthToken | null> {
  if (!valid(raw)) return null;
  const id = hashToken(raw);
  const now = new Date();
  const claimed = await db.authToken.updateMany({
    where: { id, purpose, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) return null;
  return db.authToken.findUnique({ where: { id } });
}

/** Cancels earlier unused links of one kind (e.g. older password-reset emails). */
export async function revokeTokens(where: { purpose: TokenPurpose; userId?: string; email?: string }) {
  await db.authToken.updateMany({ where: { ...where, usedAt: null }, data: { usedAt: new Date() } });
}
