import { describe, expect, it } from "vitest";
import "../helpers/request";
import { db } from "../../lib/db";
import { outbox } from "../../lib/email";

const base = { name: "Rosa Chen", password: "a-long-password-1", storeName: "Glow Works" };

function linkFrom(text: string, path: string): string {
  const m = new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`).exec(text);
  if (!m) throw new Error(`no ${path} link in: ${text}`);
  return m[1];
}

describe("seller sign-up", () => {
  it("creates an unverified store owned by the new user and emails a confirmation link", async () => {
    const { signUpSeller } = await import("../../lib/data/signup");
    const r = await signUpSeller({ ...base, email: "Rosa@Glow.test", slug: "glow-works" });
    expect(r).toEqual({ ok: true });
    const store = await db.store.findUniqueOrThrow({ where: { slug: "glow-works" }, include: { memberships: { include: { user: true } } } });
    expect(store.status).toBe("unverified");
    expect(store.memberships).toHaveLength(1);
    expect(store.memberships[0]).toMatchObject({ role: "owner" });
    expect(store.memberships[0].user).toMatchObject({ email: "rosa@glow.test", emailVerifiedAt: null });
    expect(outbox.at(-1)?.to).toBe("rosa@glow.test");
  });

  it("confirming the email opens the store", async () => {
    const { verifyEmail } = await import("../../lib/data/signup");
    const token = linkFrom(outbox.at(-1)!.text, "/verify");
    expect(await verifyEmail(token)).toEqual({ ok: true, slug: "glow-works" });
    expect((await db.store.findUniqueOrThrow({ where: { slug: "glow-works" } })).status).toBe("active");
    expect((await db.user.findUniqueOrThrow({ where: { email: "rosa@glow.test" } })).emailVerifiedAt).not.toBeNull();
    expect(await verifyEmail(token)).toEqual({ ok: false });
  });

  it("slug taken", async () => {
    const { signUpSeller } = await import("../../lib/data/signup");
    const r = await signUpSeller({ ...base, email: "other@glow.test", slug: "glow-works" });
    expect(r).toEqual({ ok: false, error: "That web address is taken. Try another." });
    expect(await db.user.findUnique({ where: { email: "other@glow.test" } })).toBeNull();
  });

  it("reserved and invalid web addresses are refused", async () => {
    const { signUpSeller } = await import("../../lib/data/signup");
    for (const slug of ["admin", "api", "login", "Bad Slug", "-x"]) {
      const r = await signUpSeller({ ...base, email: `x-${slug.length}@glow.test`, slug });
      expect(r.ok, slug).toBe(false);
    }
  });

  it("an existing email gets the same answer, no new account, and a heads-up email", async () => {
    const { signUpSeller } = await import("../../lib/data/signup");
    const before = await db.user.count();
    const r = await signUpSeller({ ...base, email: "rosa@glow.test", slug: "glow-two" });
    expect(r).toEqual({ ok: true });
    expect(await db.user.count()).toBe(before);
    expect(await db.store.findUnique({ where: { slug: "glow-two" } })).toBeNull();
    expect(outbox.at(-1)?.subject).toMatch(/sign up/i);
  });

  it("weak passwords are refused", async () => {
    const { signUpSeller } = await import("../../lib/data/signup");
    const r = await signUpSeller({ ...base, password: "short", email: "weak@glow.test", slug: "weak-store" });
    expect(r).toEqual({ ok: false, error: "Use a password of at least 10 characters." });
  });
});

describe("unverified stores", () => {
  it("let the owner in but not buyers", async () => {
    const { resolveMembership } = await import("../../lib/scope");
    const store = await db.store.create({ data: { slug: "unverified-shop", name: "U", status: "unverified" } });
    const owner = await db.user.create({ data: { email: "o@unv.test", name: "O", passwordHash: "x" } });
    const buyer = await db.user.create({ data: { email: "b@unv.test", name: "B", passwordHash: "x" } });
    const customer = await db.customer.create({ data: { storeId: store.id, name: "C" } });
    await db.membership.createMany({
      data: [
        { userId: owner.id, storeId: store.id, role: "owner" },
        { userId: buyer.id, storeId: store.id, role: "buyer", customerId: customer.id },
      ],
    });
    expect((await resolveMembership(owner.id, "unverified-shop"))?.role).toBe("owner");
    expect(await resolveMembership(buyer.id, "unverified-shop")).toBeNull();
  });
});
