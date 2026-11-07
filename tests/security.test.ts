import { beforeAll, describe, expect, it } from "vitest";
import { clientIp, hit, reset } from "../lib/rate-limit";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-that-is-definitely-longer-than-32-chars";
});

describe("token encryption (QuickBooks tokens at rest)", () => {
  it("round-trips and never stores plaintext", async () => {
    const { encrypt, decrypt } = await import("../lib/crypto");
    const stored = encrypt("refresh-token-abc");
    expect(stored).not.toContain("refresh-token-abc");
    expect(decrypt(stored)).toBe("refresh-token-abc");
  });

  it("uses a fresh IV so the same token encrypts differently each time", async () => {
    const { encrypt } = await import("../lib/crypto");
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects tampered ciphertext", async () => {
    const { encrypt, decrypt } = await import("../lib/crypto");
    const parts = encrypt("secret").split(".");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
});

describe("session tokens", () => {
  it("stores only a one-way hash of the browser token", async () => {
    const { hashToken } = await import("../lib/session");
    const h = hashToken("abc");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("abc");
  });

  it("session cookie is HttpOnly and SameSite", async () => {
    const { cookieOptions } = await import("../lib/session");
    expect(cookieOptions()).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });
});

describe("login rate limit", () => {
  it("blocks after the limit and resets", () => {
    const key = "test:user@example.com";
    for (let i = 0; i < 3; i++) expect(hit(key, 3, 60_000)).toBe(0);
    expect(hit(key, 3, 60_000)).toBeGreaterThan(0);
    reset(key);
    expect(hit(key, 3, 60_000)).toBe(0);
  });

  it("reads the client IP from the entry our own proxy appended (the last one)", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9" } });
    expect(clientIp(req)).toBe("203.0.113.9");
  });
});
