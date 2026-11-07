import { describe, expect, it } from "vitest";
import { db } from "../../lib/db";

describe("integration harness", () => {
  it("uses the isolated test database, never dev.db", () => {
    expect(process.env.DATABASE_URL).toBe("file:./test.db");
  });

  it("talks to the test database", async () => {
    const rows = await db.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    expect(Number(rows[0].ok)).toBe(1);
  });
});

describe("two-store fixtures", () => {
  it("creates a store with an owner, staff and two buyers", async () => {
    const { makeStore } = await import("../helpers/fixtures");
    const s = await makeStore("fixture-check");
    const roles = (await db.membership.findMany({ where: { storeId: s.store.id } })).map((m) => m.role).sort();
    expect(roles).toEqual(["buyer", "buyer", "owner", "staff"]);
    expect(s.orderA.customerId).toBe(s.customerA.id);
    expect(s.tokens.owner.length).toBeGreaterThan(20);
  });
});
