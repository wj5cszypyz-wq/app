import { describe, expect, it } from "vitest";
import { buildInvoicePayload, qboItemName, qboLineQty, qboQuote } from "../lib/invoice";

describe("buildInvoicePayload", () => {
  const payload = buildInvoicePayload({
    orderNumber: 1042,
    customerId: "58",
    txnDate: "2026-11-05",
    dueDate: "2026-11-06",
    notes: "Back door please",
    lines: [
      { itemId: "11", description: "Romaine Hearts · 24 ct · per case", qty: 3, rate: 35, lineTotalCents: 10500 },
      { itemId: "12", description: "Chicken Thighs · per lb", qty: 12.35, rate: 3.15, lineTotalCents: 3890 },
    ],
  });

  it("references the QuickBooks customer and numbers the invoice after the order", () => {
    expect(payload.CustomerRef).toEqual({ value: "58" });
    expect(payload.DocNumber).toBe("ORD-1042");
    expect(payload.TxnDate).toBe("2026-11-05");
    expect(payload.DueDate).toBe("2026-11-06");
    expect(payload.CustomerMemo).toEqual({ value: "Back door please" });
  });

  it("writes sales item lines in dollars", () => {
    expect(payload.Line[0]).toEqual({
      LineNum: 1,
      DetailType: "SalesItemLineDetail",
      Amount: 105,
      Description: "Romaine Hearts · 24 ct · per case",
      SalesItemLineDetail: { ItemRef: { value: "11" }, Qty: 3, UnitPrice: 35 },
    });
    expect(payload.Line[1].Amount).toBe(38.9);
    expect(payload.Line[1].SalesItemLineDetail.Qty).toBe(12.35);
  });

  it("omits optional fields when absent", () => {
    const p = buildInvoicePayload({ orderNumber: 1, customerId: "1", txnDate: "2026-01-01", lines: [] });
    expect("DueDate" in p).toBe(false);
    expect("CustomerMemo" in p).toBe(false);
  });
});

describe("QuickBooks naming rules", () => {
  it("strips colons (sub-item separator) and caps length", () => {
    expect(qboItemName("Wine: Red", "BV-1")).toBe("Wine- Red (BV-1)");
    expect(qboItemName("x".repeat(200), "S").length).toBe(100);
  });

  it("escapes quotes in query literals", () => {
    expect(qboQuote("Joe's Diner")).toBe("'Joe\\'s Diner'");
  });
});

describe("qboLineQty (unit conversion)", () => {
  it("leaves lines alone when QuickBooks counts in the same unit", () => {
    expect(qboLineQty(3, 1, 3500, 10500)).toEqual({ qty: 3, rate: 35, converted: false });
  });

  it("converts cases to the pounds QuickBooks counts in", () => {
    // 2 cases at $120, 1 case = 40 lb → 80 lb at $3.00
    expect(qboLineQty(2, 40, 12000, 24000)).toEqual({ qty: 80, rate: 3, converted: true });
  });

  it("amount reconciles: falls back to the sold unit when the converted rate can't add up to the cent", () => {
    // 10,000 × 1¢ = $100.00; 1 unit = 3 in QuickBooks → 30,000 × $0.00333 = $99.90 (wrong) → don't convert
    expect(qboLineQty(10_000, 3, 1, 10_000)).toEqual({ qty: 10_000, rate: 0.01, converted: false });
  });

  it("every result multiplies back to the line total", () => {
    for (const [q, f, p] of [[1.5, 40, 3199], [7, 0.5, 1999], [3, 12, 4999], [12.35, 1, 315]] as const) {
      const total = Math.round(q * p);
      const r = qboLineQty(q, f, p, total);
      expect(Math.round(r.qty * r.rate * 100), `${q}×${f}×${p}`).toBe(total);
    }
  });
});
