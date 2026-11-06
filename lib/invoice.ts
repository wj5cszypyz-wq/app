// Builds the JSON body for QuickBooks Online's "Create an invoice" endpoint.
// Kept free of I/O so it can be unit tested.

export type InvoiceLineInput = {
  itemId: string;
  description: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type InvoiceInput = {
  orderNumber: number;
  customerId: string;
  txnDate: string; // YYYY-MM-DD
  dueDate?: string | null;
  notes?: string | null;
  lines: InvoiceLineInput[];
};

export function buildInvoicePayload(input: InvoiceInput) {
  return {
    DocNumber: `ORD-${input.orderNumber}`.slice(0, 21),
    TxnDate: input.txnDate,
    ...(input.dueDate ? { DueDate: input.dueDate } : {}),
    CustomerRef: { value: input.customerId },
    PrivateNote: `Created automatically from online order #${input.orderNumber}`,
    ...(input.notes ? { CustomerMemo: { value: input.notes.slice(0, 1000) } } : {}),
    Line: input.lines.map((l, i) => ({
      LineNum: i + 1,
      DetailType: "SalesItemLineDetail",
      Amount: l.lineTotalCents / 100,
      Description: l.description.slice(0, 4000),
      SalesItemLineDetail: {
        ItemRef: { value: l.itemId },
        Qty: l.qty,
        UnitPrice: l.unitPriceCents / 100,
      },
    })),
  };
}

/** QuickBooks item names can't contain ":" (it means sub-item) and max out at 100 chars. */
export function qboItemName(name: string, sku: string): string {
  const clean = `${name} (${sku})`.replace(/:/g, "-").replace(/\s+/g, " ").trim();
  return clean.slice(0, 100);
}

/** Escapes a value for a QuickBooks query string literal. */
export function qboQuote(v: string): string {
  return `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
