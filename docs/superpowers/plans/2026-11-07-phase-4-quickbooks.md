# Phase 4: QuickBooks import, linking and safe invoicing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A seller can bring their existing QuickBooks items, customers and (optionally) past invoices into their store without duplicates, undo an import, convert sell units to the unit QuickBooks counts in, and never get a duplicate invoice, customer or item.

**Architecture:** All QuickBooks calls stay in `lib/qbo.ts`. Tests run against `tests/helpers/fake-qbo.ts`, an in-memory QuickBooks that answers the same HTTP calls (OAuth token, query, create item/customer/invoice with `requestid` idempotency, void, PDF) and enforces QuickBooks' rules: unique names across Customer/Vendor/Employee, `Amount = Qty × UnitPrice`, and rejects a repeated `requestid` by returning the first result. Imports are recorded in `ImportBatch` so they can be undone.

**Spec:** `docs/superpowers/specs/2026-11-07-multi-niche-stores-design.md` (§6.6)

## Global Constraints

- Phase 1–3 constraints. Undo never deletes anything in QuickBooks.
- `(storeId, qboItemId)`, `(storeId, qboCustomerId)`, `(storeId, qboInvoiceId)` unique in our database.
- Never create a QuickBooks item/customer that already exists by name (active or inactive); link instead or explain.
- Invoice `Amount` per line always equals the order line total to the cent.
- Not testable here: real Intuit responses. Everything is tested against the fake; the owner's sandbox test confirms.

## Review Focus

- Two "Retry" clicks at once on the same order → one invoice (Task 1 test `concurrent sync`).
- Two requests refresh the token at once → one refresh call, both succeed (Task 1 test `single refresh`).
- Re-running an import → updates, never duplicates (Task 3 test `re-import`).
- Unit conversion where `qty × rate` wouldn't round back to the line total → falls back so QuickBooks accepts it (Task 2 test `amount reconciles`).
- Undo an import after an imported product was ordered → archived, not deleted; orders keep their lines (Task 3 test `undo keeps ordered products`).

---

### Task 1: Fake QuickBooks, sync claim, refresh lock
- Create `tests/helpers/fake-qbo.ts` (`installFakeQbo(): FakeQbo` stubbing global `fetch` for Intuit hosts; state: items, customers, vendors, invoices, tokens, call log).
- Schema: `Order.qboAttempt Int @default(0)`, `@@unique([storeId, qboInvoiceId])` on Order; `Store.qboTokenVersion Int @default(0)`.
- `lib/sync.ts`: claim with `updateMany where { id, qboInvoiceId: null, OR: [status not syncing, syncing older than 5 min] } → syncing`; `requestid = order-<id>-<attempt>`.
- `lib/qbo.ts`: per-store single-flight refresh + version compare-and-swap.
- Tests (`tests/integration/qbo-sync.test.ts`): happy path creates customer, item, invoice once; `concurrent sync` (two parallel syncs → 1 invoice call); `single refresh` (expired token, two parallel requests → 1 token call); retry after a QuickBooks failure succeeds without duplicate.

### Task 2: Linking rules and unit conversion
- `ensureCustomer`/`ensureItem`: query includes inactive (`Active IN (true, false)`); inactive match → clear error; name taken by vendor/employee (fault 6240) → clear error.
- Schema `Product.qboUnitFactor Float @default(1)`, `Product.qboUnitLabel String?`.
- `lib/invoice.ts` `qboLineQty(qtySold, factor, lineTotalCents): { qty: number; rate: number; converted: boolean }` — QuickBooks qty = qty × factor; rate rounded to 5 decimals; if `round2(qty × rate) ≠ total` → fall back to sell units (`converted: false`). Description says what was ordered ("1 case (40 lb)").
- Product form: "In QuickBooks, 1 <unit> = [N] [label]" shown when linked.
- Tests: `amount reconciles`; inactive item → error mentions "inactive"; vendor-name clash → error mentions "vendor".

### Task 3: Import items and customers (preview, import, undo)
- Schema `ImportBatch { id, storeId, kind "items"|"customers"|"invoices", createdAt, undoneAt, created String /* JSON ids */, updated String /* JSON [{id, before}] */ }`; `Product @@unique([storeId, qboItemId])`, `Customer @@unique([storeId, qboCustomerId])`.
- `lib/qbo.ts`: `listAllItems(store)`, `listAllCustomers(store)` (paged 1000).
- `lib/data/qbo-import.ts`: `previewItems(ctx)` → rows with status `new | linked | will-link-by-sku`; `importItems(ctx, qboIds[])`; `previewCustomers`, `importCustomers`; `undoImport(ctx, batchId)`.
- Routes `api/s/[slug]/manage/qbo/import` (GET preview `?kind=`, POST import, OWNER+staff), `api/s/[slug]/manage/qbo/import/[id]/undo` POST.
- UI: QuickBooks page "Bring in from QuickBooks" with preview table and checkboxes; recent imports with Undo.
- Tests: `re-import` updates not duplicates; SKU match links existing product; `undo keeps ordered products`; customers keyed by QuickBooks id; another store's batch can't be undone.

### Task 4: Past invoices (optional)
- Schema `PastInvoice { id, storeId, customerId, qboInvoiceId, docNumber, txnDate, totalCents, lines String, batchId; @@unique([storeId, qboInvoiceId]) }`.
- `importPastInvoices(ctx, sinceIso)` for linked customers; buyer history shows them read-only with Reorder for lines linked to active products.
- Tests: no duplicates on re-run; buyer sees only their own; undo removes them.

### Task 5: Void on cancel, reissue on reopen
- `voidInvoice(store, invoiceId)` (read SyncToken, `POST invoice?operation=void`). Cancelling an invoiced order voids it (`qboSyncStatus: "voided"`); reopening bumps `qboAttempt`, clears the link, invoice number `ORD-<n>-<attempt+1>`.
- Tests: cancel → void called once, order shows voided; reopen → new invoice with new requestid.

### Task 6: Gate and handoff (tests, tsc, build, audit, e2e, docs, push)
