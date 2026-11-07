import { describe, expect, it, vi } from "vitest";
import { cleanSuggestion, suggestProduct, type SuggestClient } from "../lib/suggest";

const fakeClient = (parsed: unknown, stop = "end_turn"): SuggestClient & { calls: unknown[] } => {
  const calls: unknown[] = [];
  return {
    calls,
    messages: { parse: vi.fn(async (body: unknown) => { calls.push(body); return { parsed_output: parsed, stop_reason: stop }; }) },
  } as never;
};

const ctx = { niche: "Dairy and kitchen supplies", categories: ["Dairy & Eggs", "Dry Goods"] };

describe("cleanSuggestion", () => {
  it("keeps a sensible suggestion and reuses an existing category's exact spelling", () => {
    const s = cleanSuggestion(
      { category: "dairy & eggs", emoji: "🥛", unitKind: "packed", unit: "case", packCount: 4, packAmount: 1, packUnit: "gallon", byWeight: false },
      ctx.categories,
    );
    expect(s).toEqual({ category: "Dairy & Eggs", emoji: "🥛", unitKind: "packed", unit: "case", packCount: 4, packAmount: 1, packUnit: "gallon", byWeight: false });
  });

  it("repairs a unit that doesn't fit the kind and drops nonsense pack units", () => {
    const s = cleanSuggestion({ category: "Lighting", emoji: "💡", unitKind: "count", unit: "gallon", packCount: null, packAmount: 3, packUnit: "parsecs", byWeight: true }, []);
    expect(s).toMatchObject({ unitKind: "count", unit: "each", packAmount: null, packUnit: null, byWeight: false });
  });

  it("returns null for garbage", () => {
    expect(cleanSuggestion(null, [])).toBeNull();
    expect(cleanSuggestion({ unitKind: "potions" }, [])).toBeNull();
  });
});

describe("suggestProduct", () => {
  it("returns nothing (and calls nothing) without an API key", async () => {
    const c = fakeClient({});
    expect(await suggestProduct({ name: "Whole milk", description: "" }, ctx, { client: null })).toBeNull();
    expect(c.calls).toHaveLength(0);
  });

  it("sends only the product text and store context, as data, and cleans the answer", async () => {
    const c = fakeClient({ category: "Dairy & Eggs", emoji: "🥛", unitKind: "packed", unit: "case", packCount: 4, packAmount: 1, packUnit: "gallon", byWeight: false });
    const s = await suggestProduct({ name: "Whole milk, 4 x 1 gal", description: "" }, ctx, { client: c });
    expect(s?.unit).toBe("case");
    const body = c.calls[0] as { model: string; messages: { content: string }[]; output_config: { effort: string } };
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.output_config.effort).toBe("low");
    expect(body.messages[0].content).toContain("<product_name>Whole milk, 4 x 1 gal</product_name>");
  });

  it("a refusal, error or timeout means no suggestion, never a crash", async () => {
    expect(await suggestProduct({ name: "x lamp", description: "" }, ctx, { client: fakeClient({ category: "x" }, "refusal") })).toBeNull();
    const broken = { messages: { parse: vi.fn(async () => { throw new Error("timeout"); }) } } as never;
    expect(await suggestProduct({ name: "x lamp", description: "" }, ctx, { client: broken })).toBeNull();
  });

  it("ignores names that are too short or too long", async () => {
    const c = fakeClient({});
    expect(await suggestProduct({ name: "ab", description: "" }, ctx, { client: c })).toBeNull();
    expect(await suggestProduct({ name: "a".repeat(200), description: "" }, ctx, { client: c })).toBeNull();
    expect(c.calls).toHaveLength(0);
  });
});
