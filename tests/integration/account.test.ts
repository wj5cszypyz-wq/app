import bcrypt from "bcryptjs";
import { beforeAll, describe, expect, it } from "vitest";
import "../helpers/request";
import { db } from "../../lib/db";
import { outbox } from "../../lib/email";
import { createSession, hashToken } from "../../lib/session";

let userId: string;
const EMAIL = "reset-me@test.local";

const tokenIn = (text: string) => /token=([A-Za-z0-9_-]+)/.exec(text)![1];

beforeAll(async () => {
  userId = (await db.user.create({ data: { email: EMAIL, name: "Reset Me", passwordHash: await bcrypt.hash("old-password-123", 10) } })).id;
});

describe("forgot password", () => {
  it("answers the same for unknown emails and sends nothing", async () => {
    const { requestPasswordReset } = await import("../../lib/data/account");
    const before = outbox.length;
    await requestPasswordReset("nobody-here@test.local");
    expect(outbox.length).toBe(before);
  });

  it("emails a reset link to a known email", async () => {
    const { requestPasswordReset } = await import("../../lib/data/account");
    await requestPasswordReset(EMAIL.toUpperCase());
    expect(outbox.at(-1)).toMatchObject({ to: EMAIL });
    expect(outbox.at(-1)!.text).toContain("/reset?token=");
  });

  it("reset token is single use, and resetting signs out every session", async () => {
    const { requestPasswordReset, resetPassword } = await import("../../lib/data/account");
    await createSession(userId);
    await requestPasswordReset(EMAIL);
    const token = tokenIn(outbox.at(-1)!.text);
    expect(await resetPassword(token, "brand-new-password-1")).toEqual({ ok: true });
    expect(await db.session.count({ where: { userId } })).toBe(0);
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await bcrypt.compare("brand-new-password-1", user.passwordHash)).toBe(true);
    expect(await resetPassword(token, "another-password-2")).toEqual({ ok: false, error: "This link has expired or was already used." });
  });

  it("a newer reset email cancels the older link", async () => {
    const { requestPasswordReset, resetPassword } = await import("../../lib/data/account");
    await requestPasswordReset(EMAIL);
    const older = tokenIn(outbox.at(-1)!.text);
    await requestPasswordReset(EMAIL);
    const newer = tokenIn(outbox.at(-1)!.text);
    expect((await resetPassword(older, "password-from-old-link")).ok).toBe(false);
    expect((await resetPassword(newer, "password-from-new-link")).ok).toBe(true);
  });

  it("refuses a weak new password without using up the link", async () => {
    const { requestPasswordReset, resetPassword } = await import("../../lib/data/account");
    await requestPasswordReset(EMAIL);
    const token = tokenIn(outbox.at(-1)!.text);
    expect(await resetPassword(token, "short")).toEqual({ ok: false, error: "Use a password of at least 10 characters." });
    expect((await resetPassword(token, "long-enough-password")).ok).toBe(true);
  });
});

describe("change password and sign out everywhere", () => {
  it("needs the current password, keeps this session, ends the others", async () => {
    const { changePassword } = await import("../../lib/data/account");
    const here = hashToken(await createSession(userId));
    await createSession(userId);
    expect(await changePassword(userId, here, "wrong-current-pass", "next-password-123")).toEqual({ ok: false, error: "Your current password isn't right." });
    expect(await changePassword(userId, here, "long-enough-password", "next-password-123")).toEqual({ ok: true });
    const left = await db.session.findMany({ where: { userId } });
    expect(left.map((s) => s.id)).toEqual([here]);
  });

  it("sign out everywhere else keeps only this session", async () => {
    const { signOutOtherSessions } = await import("../../lib/data/account");
    const here = hashToken(await createSession(userId));
    await createSession(userId);
    await createSession(userId);
    await signOutOtherSessions(userId, here);
    expect((await db.session.findMany({ where: { userId } })).map((s) => s.id)).toEqual([here]);
  });
});
