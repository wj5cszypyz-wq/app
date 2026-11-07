// Emailed invites: a seller invites a customer's contact or a staff member. Accepting creates
// (or reuses) the person's login and gives them access to that one store.
import { db } from "../db";
import { appUrl, sendEmail } from "../email";
import { emailProblem, hashPassword, passwordProblem } from "../passwords";
import type { StoreCtx } from "../scope";
import { consumeToken, issueToken, peekToken, revokeTokens, TTL } from "../tokens";
import { DataError } from "./errors";
import { hit } from "../rate-limit";
import { asManager } from "./guard";

async function sendInvite(opts: { email: string; storeId: string; storeName: string; role: "buyer" | "staff"; customerId?: string }) {
  const store = await db.store.findUnique({ where: { id: opts.storeId }, select: { status: true } });
  if (store?.status !== "active") throw new DataError("Confirm your email first. Invites can be sent once your store is open.");
  if (hit(`invites:${opts.storeId}`, 200, 24 * 3_600_000)) throw new DataError("You've sent a lot of invites today. Try again tomorrow.", 409);
  await db.authToken.updateMany({
    where: { purpose: "invite", email: opts.email, storeId: opts.storeId, usedAt: null },
    data: { usedAt: new Date() },
  });
  const token = await issueToken({
    purpose: "invite",
    email: opts.email,
    storeId: opts.storeId,
    customerId: opts.customerId,
    role: opts.role,
    ttlMs: TTL.invite,
  });
  const what = opts.role === "staff" ? `help run ${opts.storeName}` : `order from ${opts.storeName}`;
  await sendEmail({
    to: opts.email,
    subject: `You're invited to ${what}`,
    text: `You've been invited to ${what}.\n\nAccept the invite:\n${appUrl(`/invite?token=${token}`)}\n\nThe link works once and expires in 7 days.`,
  });
}

/** Emails (or re-emails) a login invite to a customer's contact email. */
export async function inviteCustomerLogin(ctx: StoreCtx, customerId: string): Promise<boolean> {
  const { storeId, storeName } = asManager(ctx);
  const c = await db.customer.findFirst({ where: { id: customerId, storeId }, select: { id: true, email: true } });
  if (!c) return false;
  if (!c.email) throw new DataError("Add an email for this customer first.");
  await sendInvite({ email: c.email, storeId, storeName, role: "buyer", customerId: c.id });
  return true;
}

export async function inviteStaff(ctx: StoreCtx, rawEmail: string): Promise<void> {
  const { storeId, storeName } = asManager(ctx);
  if (ctx.role !== "owner") throw new DataError("Only the store owner can invite staff.");
  const email = rawEmail.trim().toLowerCase();
  const bad = emailProblem(email);
  if (bad) throw new DataError(bad);
  const existing = await db.membership.findFirst({ where: { storeId, user: { email } }, select: { id: true } });
  if (existing) throw new DataError("This email already has access to this store.");
  await sendInvite({ email, storeId, storeName, role: "staff" });
}

/** Removes a staff member's access. The owner can't be removed. */
export async function removeStaff(ctx: StoreCtx, userId: string): Promise<boolean> {
  const { storeId } = asManager(ctx);
  if (ctx.role !== "owner") throw new DataError("Only the store owner can remove staff.");
  const r = await db.membership.deleteMany({ where: { storeId, userId, role: "staff" } });
  return r.count === 1;
}

export async function listTeam(ctx: StoreCtx) {
  const { storeId } = asManager(ctx);
  const [members, pending] = await Promise.all([
    db.membership.findMany({
      where: { storeId, role: { in: ["owner", "staff"] } },
      orderBy: { createdAt: "asc" },
      select: { role: true, user: { select: { id: true, name: true, email: true } } },
    }),
    db.authToken.findMany({
      where: { purpose: "invite", storeId, role: "staff", usedAt: null, expiresAt: { gt: new Date() } },
      select: { email: true, expiresAt: true },
    }),
  ]);
  return { members: members.map((m) => ({ ...m.user, role: m.role })), pending };
}

/** What the invite page shows before accepting. */
export async function inviteDetails(token: string) {
  const row = await peekToken(token, "invite");
  if (!row?.storeId || !row.email) return null;
  const [store, user] = await Promise.all([
    db.store.findUnique({ where: { id: row.storeId }, select: { name: true, status: true } }),
    db.user.findUnique({ where: { email: row.email }, select: { id: true } }),
  ]);
  if (!store || store.status === "suspended") return null;
  return { email: row.email, storeName: store.name, role: row.role as "buyer" | "staff", hasAccount: Boolean(user) };
}

type AcceptResult = { ok: true; userId: string; home: string; newUser: boolean } | { ok: false; error: string };

export async function acceptInvite(
  token: string,
  who: { sessionUserId: string | null; name?: string; password?: string },
): Promise<AcceptResult> {
  const expired = { ok: false as const, error: "This invite has expired or was already used. Ask for a new one." };
  const row = await peekToken(token, "invite");
  if (!row?.storeId || !row.email || (row.role !== "buyer" && row.role !== "staff")) return expired;
  const store = await db.store.findUnique({ where: { id: row.storeId }, select: { slug: true, status: true } });
  if (!store || store.status === "suspended") return expired;
  if (row.role === "buyer") {
    const c = row.customerId ? await db.customer.findFirst({ where: { id: row.customerId, storeId: row.storeId } }) : null;
    if (!c) return expired;
  }

  const existing = await db.user.findUnique({ where: { email: row.email }, select: { id: true } });
  if (who.sessionUserId) {
    if (!existing || existing.id !== who.sessionUserId) {
      return { ok: false, error: `This invite is for ${row.email}. Sign out, then open the link again.` };
    }
  } else if (existing) {
    return { ok: false, error: "sign_in_required" };
  } else {
    const name = (who.name ?? "").trim();
    if (!name || name.length > 120) return { ok: false, error: "Add your name." };
    const bad = passwordProblem(who.password);
    if (bad) return { ok: false, error: bad };
  }

  // Validation passed: now use the invite up (only one request can ever get past this line).
  const used = await consumeToken(token, "invite");
  if (!used) return expired;

  const passwordHash = existing ? null : await hashPassword(who.password!);
  const result = await db.$transaction(async (tx) => {
    const user =
      existing ??
      (await tx.user.create({
        data: { email: row.email!, name: who.name!.trim(), passwordHash: passwordHash!, emailVerifiedAt: new Date() },
        select: { id: true },
      }));
    const already = await tx.membership.findUnique({ where: { userId_storeId: { userId: user.id, storeId: row.storeId! } } });
    if (!already) {
      await tx.membership.create({
        data: {
          userId: user.id,
          storeId: row.storeId!,
          role: row.role!,
          customerId: row.role === "buyer" ? row.customerId : null,
        },
      });
    }
    return { userId: user.id, role: already?.role ?? row.role! };
  });
  await revokeTokens({ purpose: "invite", email: row.email, storeId: row.storeId }); // other stores' invites stay valid
  return {
    ok: true,
    userId: result.userId,
    home: result.role === "buyer" ? `/s/${store.slug}` : `/s/${store.slug}/manage`,
    newUser: !existing,
  };
}
