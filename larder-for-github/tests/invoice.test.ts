import { describe, expect, it } from "vitest";
import { buildInvoicePayload, qboItemName, qboQuote } from "../lib/invoice";

describe("buildInvoicePayload", () => {
  const payload = buildInvoicePayload({
    orderNumber: 1042,
    customerId: "58",
    txnDate: "2026-11-05",
    dueDate: "2026-11-06",
    notes: "Back door please",
    lines: [
      { itemId: "11", description: "Romaine Hearts · 24 ct · per case", qty: 3, unitPriceCents: 3500, lineTotalCents: 10500 },
      { itemId: "12", description: "Chicken Thighs · per lb", qty: 12.35, unitPriceCents: 315, lineTotalCents: 3890 },
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
