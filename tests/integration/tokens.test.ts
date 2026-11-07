import { describe, expect, it } from "vitest";
import { db } from "../../lib/db";

describe("one-time tokens", () => {
  it("stores only a hash of the token", async () => {
    const { issueToken } = await import("../../lib/tokens");
    const raw = await issueToken({ purpose: "verify_email", email: "a@test.local", ttlMs: 60_000 });
    expect(raw.length).toBeGreaterThanOrEqual(40);
    expect(await db.authToken.findUnique({ where: { id: raw } })).toBeNull();
    expect(await db.authToken.count({ where: { email: "a@test.local" } })).toBe(1);
  });

  it("can be used once", async () => {
    const { issueToken, consumeToken } = await import("../../lib/tokens");
    const raw = await issueToken({ purpose: "reset_password", email: "b@test.local", ttlMs: 60_000 });
    expect((await consumeToken(raw, "reset_password"))?.email).toBe("b@test.local");
    expect(await consumeToken(raw, "reset_password")).toBeNull();
  });

  it("is rejected when expired", async () => {
    const { issueToken, consumeToken } = await import("../../lib/tokens");
    const raw = await issueToken({ purpose: "invite", email: "c@test.local", ttlMs: -1 });
    expect(await consumeToken(raw, "invite")).toBeNull();
  });

  it("is rejected for the wrong purpose or a made-up value", async () => {
    const { issueToken, consumeToken, peekToken } = await import("../../lib/tokens");
    const raw = await issueToken({ purpose: "invite", email: "d@test.local", ttlMs: 60_000 });
    expect(await consumeToken(raw, "reset_password")).toBeNull();
    expect(await consumeToken("not-a-real-token", "invite")).toBeNull();
    expect(await consumeToken("", "invite")).toBeNull();
    expect((await peekToken(raw, "invite"))?.email).toBe("d@test.local");
    expect((await consumeToken(raw, "invite"))?.email).toBe("d@test.local");
  });
});

describe("email", () => {
  it("keeps sent emails in the dev outbox and builds links from APP_URL", async () => {
    const { sendEmail, outbox, appUrl } = await import("../../lib/email");
    await sendEmail({ to: "e@test.local", subject: "Hello", text: "Body" });
    expect(outbox.at(-1)).toMatchObject({ to: "e@test.local", subject: "Hello" });
    expect(appUrl("/verify?t=x")).toBe("http://localhost:3000/verify?t=x");
  });
});
