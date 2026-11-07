import { beforeAll, describe, expect, it } from "vitest";
import "../helpers/request";
import { db } from "../../lib/db";
import { base32Decode, totpAt } from "../../lib/totp";

let userId: string;
let secret: string;
const nowS = () => Date.now() / 1000;

beforeAll(async () => {
  userId = (await db.user.create({ data: { email: "two-step@test.local", name: "Two Step", passwordHash: "x", emailVerifiedAt: new Date() } })).id;
});

describe("two-step setup", () => {
  it("start gives a secret and an authenticator link, but doesn't turn it on", async () => {
    const { startTwoStep } = await import("../../lib/data/two-step");
    const r = await startTwoStep(userId);
    secret = r.secret;
    expect(r.uri).toMatch(/^otpauth:\/\/totp\/.+secret=[A-Z2-7]+/);
    expect(r.qrSvg).toContain("<svg");
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u.totpEnabledAt).toBeNull();
    expect(u.totpSecret).not.toContain(secret);
  });

  it("enable needs a correct code and returns 10 one-time recovery codes", async () => {
    const { enableTwoStep } = await import("../../lib/data/two-step");
    expect(await enableTwoStep(userId, "000000")).toEqual({ ok: false, error: "That code isn't right. Check your app and try again." });
    const r = await enableTwoStep(userId, totpAt(base32Decode(secret), nowS()));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.recoveryCodes).toHaveLength(10);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).totpEnabledAt).not.toBeNull();
  });
});

describe("signing in with two-step on", () => {
  it("password alone does not sign in when two-step is on", async () => {
    const { beginTwoStepLogin } = await import("../../lib/data/two-step");
    const before = await db.session.count({ where: { userId } });
    const ticket = await beginTwoStepLogin(userId);
    expect(ticket.length).toBeGreaterThan(20);
    expect(await db.session.count({ where: { userId } })).toBe(before);
  });

  it("a code that was already used can't be used again", async () => {
    const { beginTwoStepLogin, finishTwoStepLogin } = await import("../../lib/data/two-step");
    await db.user.update({ where: { id: userId }, data: { totpLastStep: null } });
    const code = totpAt(base32Decode(secret), nowS());
    expect(await finishTwoStepLogin(await beginTwoStepLogin(userId), code)).toEqual({ ok: true, userId });
    expect((await finishTwoStepLogin(await beginTwoStepLogin(userId), code)).ok).toBe(false);
  });

  it("wrong code count limit: after 8 wrong codes the ticket is dead", async () => {
    const { beginTwoStepLogin, finishTwoStepLogin } = await import("../../lib/data/two-step");
    await db.user.update({ where: { id: userId }, data: { totpLastStep: null } });
    const ticket = await beginTwoStepLogin(userId);
    for (let i = 0; i < 8; i++) expect((await finishTwoStepLogin(ticket, "111111")).ok).toBe(false);
    const good = totpAt(base32Decode(secret), nowS());
    expect(await finishTwoStepLogin(ticket, good)).toEqual({ ok: false, error: "This sign-in expired. Start again." });
  });

  it("recovery code works once", async () => {
    const { enableTwoStep, startTwoStep, beginTwoStepLogin, finishTwoStepLogin } = await import("../../lib/data/two-step");
    await db.user.update({ where: { id: userId }, data: { totpEnabledAt: null, totpLastStep: null } });
    const s = await startTwoStep(userId);
    const r = await enableTwoStep(userId, totpAt(base32Decode(s.secret), nowS()));
    if (!r.ok) throw new Error("enable failed");
    const code = r.recoveryCodes[0];
    expect(await finishTwoStepLogin(await beginTwoStepLogin(userId), code)).toEqual({ ok: true, userId });
    expect((await finishTwoStepLogin(await beginTwoStepLogin(userId), code)).ok).toBe(false);
  });

  it("disable needs a valid code", async () => {
    const { disableTwoStep } = await import("../../lib/data/two-step");
    expect((await disableTwoStep(userId, "000000")).ok).toBe(false);
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const { decrypt } = await import("../../lib/crypto");
    await db.user.update({ where: { id: userId }, data: { totpLastStep: null } });
    expect(await disableTwoStep(userId, totpAt(base32Decode(decrypt(u.totpSecret!)), nowS()))).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).totpEnabledAt).toBeNull();
  });
});
