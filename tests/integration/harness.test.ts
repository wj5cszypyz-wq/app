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
