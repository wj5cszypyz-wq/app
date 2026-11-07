# Phase 3: Setup questions, looks, photos and units Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Any seller can describe their store, pick a plain look, add photos, and list products in any niche with the right units; customers see a neat store in that seller's look.

**Architecture:** Units are a fixed table in `lib/units.ts`; products store a unit kind, sell unit and structured pack contents, and the display text (`packSize`) is generated from them so orders, printouts and invoices keep working. Categories become per-store rows with an emoji. Looks are four token sets selected by `data-look` on the store's wrapper plus an accent color checked for contrast. Uploads are re-encoded by `sharp` to WebP, stored outside `public/`, and served by a route that checks store membership.

**Tech Stack:** as before + `sharp` (already present through Next.js; pinned as a direct dependency).

**Spec:** `docs/superpowers/specs/2026-11-07-multi-niche-stores-design.md` (§6.4, §6.5, §6.7, §6.9)

## Global Constraints

- Phase 1–2 constraints.
- Units/kinds exactly per spec §6.5 table. Price shown as "$X per <unit>" or "$X per <unit> of <pack>".
- Photos: JPEG/PNG/WebP only (checked by file content, not name), ≤ 8 MB, re-encoded to WebP, longest side ≤ 1600 px (logo ≤ 512, banner ≤ 2000×600 cover), metadata stripped; up to 4 per product.
- Uploaded files live in `uploads/` (git-ignored), never under `public/`; served only to members of the owning store.
- Looks: `fresh` (current green), `clean` (white/charcoal), `craft` (cream/terracotta), `classic` (white/navy). Accent: `#rrggbb`; darkened until contrast with white ≥ 4.5:1, and the seller is told.
- No seller-supplied HTML/CSS anywhere. Emoji fields: max 8 chars.
- Signed-in pages (`/s`, `/stores`, `/account`, `/admin`, `/invite`) send `Cache-Control: private, no-store`.

## Review Focus

- A file renamed to `.jpg` that is really HTML/SVG → rejected (Task 4 test `disguised file`).
- A buyer of store B requests store A's photo by id → 404 (Task 4 test `photo of another store`).
- Accent color that's unreadable (e.g. `#ffff00`) → stored darkened, readable (Task 3 test `contrast`).
- Product with a very long name, pack and price on a 390 px phone → no overflow (Task 7 e2e).
- Weighed product (by actual weight) ordered as 2.5 lb → accepted; "each" item 2.5 → rejected (Task 1 test).

---

### Task 0: Cache headers for the new addresses
- Modify `next.config.ts`; Test `tests/headers.test.ts`: `headers()` includes `private, no-store` for `/s/:path*`, `/stores`, `/account`, `/admin`, `/invite`.

### Task 1: Units and pack contents
- Create `lib/units.ts`: `UNIT_KINDS: Record<Kind, { label: string; units: string[] }>` with kinds `weight | liquid | paper | length | count | packed`; `kindOf(unit)`, `allowsDecimal(unit)` (weight, liquid, length units), `packLabel({ count, amount, unit })` ("24 × 12 fl oz", "40 lb", "500 sheet" → "500 sheets"), `priceLabel(priceCents, unit, pack)` ("$42.00 per case of 24 × 12 fl oz").
- Schema `Product`: `unitKind String @default("count")`, `packCount Int?`, `packAmount Float?`, `packUnit String?`, `byWeight Boolean @default(false)`, `description String?`. `packSize` stays (generated). `isValidQty` in `lib/catalog.ts` uses `allowsDecimal`.
- Tests `tests/units.test.ts`: labels, decimals allowed for lb/kg/gal not each/case, priceLabel strings.

### Task 2: Per-store categories and full product editing
- Schema `Category { id, storeId, name, emoji, sort; @@unique([storeId, name]) }`; seed both stores' categories.
- `lib/data/categories.ts`: `listCategories(ctx)`, `ensureCategory(ctx, name, emoji?)`.
- `lib/data/products.ts`: `createProduct`/`updateProduct` accept the full product shape (name, description, sku, category, unitKind, unit, pack fields, byWeight, priceCents, inStock, imageIds); validation in `lib/product-input.ts` `parseProductInput(body, partial): ProductInput | { error }`.
- Routes: products POST/PATCH use it; categories GET/POST `api/s/[slug]/manage/categories` (MANAGE) in matrix.
- Catalog page: product form (create + edit in a side panel) with kind → unit list, pack contents, category picker with "New category" (name + emoji), photos (Task 4).
- Tests: categories isolated per store; product with unknown unit rejected; category auto-created on save; another store's category name doesn't leak.

### Task 3: Store profile and looks
- Schema `Store`: `look String @default("fresh")`, `accent String?`, `logoId String?`, `bannerId String?`, `fulfillment String @default("delivery") /* delivery|pickup|both */`, `about String?`, `setupDoneAt DateTime?`, `unitKinds String?` (JSON list).
- `lib/color.ts`: `readableAccent(hex): { hex; adjusted: boolean }` (WCAG contrast vs #fff ≥ 4.5).
- `lib/data/store-profile.ts`: `getProfile(ctx)`, `updateProfile(ctx(owner), patch)`; route `api/s/[slug]/manage/store` PATCH extended (OWNER).
- CSS: `[data-look="clean|craft|classic"]` token overrides; `--accent` from store.
- Buyer layout and seller shell render store logo/name and `data-look` + accent.
- Tests: `contrast`; invalid look/fulfillment rejected; staff can't change profile.

### Task 4: Uploads
- Schema `Upload { id, storeId, kind "logo"|"banner"|"product", path, width, height, bytes, createdAt }`; `Product.imageIds String?` (JSON, ≤ 4, must belong to the store).
- `lib/uploads.ts`: `sniffImageType(buf)`, `processImage(buf, kind)`; `lib/data/uploads.ts`: `saveUpload(ctx, kind, buf)`, `readUpload(userId, id)` (membership check via the upload's store).
- Routes: `api/s/[slug]/manage/uploads` POST (multipart, MANAGE), `api/files/[id]` GET (any member of that store; `Cache-Control: private, max-age=3600`).
- Tests: `disguised file` (HTML/SVG bytes named .jpg → 400), oversized → 400, PNG → WebP saved with metadata stripped, `photo of another store` → 404, product imageIds from another store rejected.

### Task 5: Setup questions (onboarding)
- `app/s/[slug]/manage/setup/page.tsx`: steps 1 Store basics (name, what you sell, about, phone/email/address, delivery/pickup), 2 Look (look, accent, logo, banner), 3 What you sell by (unit kinds checkboxes → default unit kind in product form), 4 QuickBooks (link), 5 Products (link to catalog), 6 Customers (link + request toggle). Each step saves on its own; "Finish" sets `setupDoneAt`.
- Today page shows a "Finish setting up your store" card linking to setup until `setupDoneAt`; sign-up redirects to setup. Nav item "Store" (setup page doubles as settings).

### Task 6: Niche-neutral storefront
- Storefront uses store categories/emoji, product photos (fixed square frame, object-fit cover; emoji tile fallback), `priceLabel`, description; search placeholder "Search products"; fulfillment wording ("Delivery date"/"Pickup date"); status label "Delivered"/"Picked up".
- Printouts and order pages show pack text unchanged (generated `packSize`).

### Task 7: Gate and handoff
- e2e: long-name product at 390 px no overflow; lamp store shows photos/emoji tiles; setup page loads; overflow checks on new pages. Build, audit, docs, push.
