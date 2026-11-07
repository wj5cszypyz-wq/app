import { describe, expect, it } from "vitest";
import { contrastWithWhite, readableAccent } from "../lib/color";

describe("accent colors", () => {
  it("keeps readable colors as they are", () => {
    expect(readableAccent("#2e7d4a")).toEqual({ hex: "#2e7d4a", adjusted: false });
  });

  it("contrast: darkens unreadable colors until white text reads well on them", () => {
    const r = readableAccent("#ffff00")!;
    expect(r.adjusted).toBe(true);
    expect(contrastWithWhite(r.hex)).toBeGreaterThanOrEqual(4.5);
  });

  it("rejects anything that isn't a #rrggbb color", () => {
    for (const bad of ["red", "#fff", "#12345g", "url(x)", "#1234567"]) expect(readableAccent(bad)).toBeNull();
  });
});
