import { describe, expect, it } from "vitest";
import config from "../next.config";

describe("cache headers", () => {
  it("signed-in pages are never cached", async () => {
    const rules = await config.headers!();
    const noStore = rules.filter((r) => r.headers.some((h) => h.key === "Cache-Control" && h.value.includes("no-store")));
    const sources = noStore.map((r) => r.source);
    for (const path of ["/s/:path*", "/stores", "/account", "/admin", "/invite", "/api/:path*"]) {
      expect(sources, path).toContain(path);
    }
  });
});
