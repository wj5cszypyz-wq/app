# Larder → store builder for any seller: design

Status: approved by owner · 2026-11-07

## 1. Intent and why

Today Larder is one wholesale ordering app for food suppliers and restaurants. The owner wants it to become a
**store template any seller can fill in themselves**: a produce wholesaler, a lamp maker, a university-supply
seller, any niche. Each seller gets **their own separate store** (not a shared marketplace) with their own
products, prices, inventory and look. Their customers open the store on their phone and order whenever and
wherever they are, instead of calling. **Every order becomes a correct invoice in the seller's QuickBooks
Online**, which is the main reason a business would pick this over a generic store builder.

How it reaches sellers: the owner visits suppliers in person; the seller signs up and fills in their own store
(the owner can help). Sellers pay a monthly subscription; their customers use it free.

## 2. Goals

1. Any seller can sign up, answer a short setup (store name, what they sell, look, units), and have a working
   store the same day.
2. Products in any niche, with the right units for the kind of item (weight, liquid, paper, length, single items,
   packed goods), clear pack sizes, and price shown with its unit.
3. "Smart" product entry: typing a product name suggests category, unit type, unit, pack size and an icon.
4. QuickBooks: connect, **import existing items and customers without duplicates**, link store products to
   real QuickBooks items, convert sell units to the unit QuickBooks counts in, create correct invoices, never
   create a duplicate invoice, customer or item.
5. Undo and redo for mistakes, plus a change history.
6. Security: no one can see or change another store's data, sign-in is hardened, no exploitable back-end paths.
7. Plain, neat design that each seller can personalize without breaking it. Nothing overflows or runs off the
   page on phone or desktop.

## 3. Non-goals (this build)

- A shared marketplace where buyers browse many sellers.
- Card/ACH payments at checkout (Stripe Connect is a later phase). Buyers are invoiced, as today.
- Billing sellers for their subscription (later phase). Until then a store goes live once its owner verifies
  their email; the platform admin can suspend any store.
- Custom domains / subdomains (needs hosting + DNS; stores live at `/s/<store-name>` for now, built so
  subdomains can be added later without changing data).
- QuickBooks Desktop.
- Free-form custom CSS/HTML from sellers (it would open cross-site-scripting holes and break layouts).

## 4. Anti-goals (failure even if it "works")

- One store seeing or changing another store's data, by any route, URL, ID guessing or API call.
- Duplicate items, customers or invoices in a seller's QuickBooks.
- A wrong quantity or unit on an invoice (e.g. "1" deducted from stock that is counted in pounds).
- A design that looks futuristic/dark, cluttered, or that a seller's choices can make unreadable.
- Losing an order or an edit with no way back.

## 5. Approaches considered

| Approach | Trade-off | Verdict |
|---|---|---|
| **A. Evolve this codebase into one platform hosting many stores** (one app, one database, every row tagged with its store) | Keeps the tested sign-in, security and QuickBooks code; one place to fix bugs and ship upgrades; isolation must be enforced in code and tested | **Chosen** |
| B. A separate copy of the app (and database) per seller | Strong isolation by default, but every upgrade and fix must be rolled out N times, hosting cost per seller, no self-signup | Rejected: doesn't scale past a handful of sellers |
| C. Start over on a new stack or on Shopify's platform | Throws away working, tested code; Shopify apps can't control invoicing as directly and add Shopify's fees | Rejected |

The owner handed over the "how"; A is the builder's call.

## 6. Design

### 6.1 Who's who

- **Platform admin** (the owner): sees a list of stores, can suspend/reactivate a store. Cannot browse a store's
  customers or orders without the store owner adding them as staff (keeps the "never market to your customers"
  promise auditable).
- **Store owner / staff**: manage one store. Owner can invite staff. A person can belong to several stores
  (membership table), and picks the store after sign-in.
- **Buyer**: belongs to a customer account of one store, added or approved by the seller. Sees only that store,
  their own prices and their own orders.

Data: `Store` (replaces `Supplier`), `Membership(userId, storeId, role: owner|staff|buyer, customerId?)`,
`Customer` (replaces `Restaurant`: any business or person who buys), `Category` per store, `Product`,
`CustomerPrice`, `Order`, `OrderLine`, `ChangeLog`, `ImportBatch`, `Upload`. Existing demo data becomes the
"Harbor Fresh" store using the Fresh Market look.

### 6.2 Store isolation (the most important rule)

- The store ID used by any query comes **only from the signed-in session's membership**, never from a URL,
  form field or request body. A URL like `/s/brightline/...` only picks which membership to use; if the user has
  no membership there, they get a 404 (not 403, so store existence isn't confirmed).
- All data access goes through one module (`lib/scope.ts`) whose functions require a verified store context;
  route handlers don't call the database directly. A lint/test check fails the build if a route imports the raw
  database client.
- Every lookup by ID is `where { id, storeId }`, so guessing IDs from another store returns nothing.
- Buyer queries are also filtered by their `customerId`.
- Automated tests create two stores and, for **every** API route and page, try to read/change store B's data as
  store A's owner, staff and buyer, and as a signed-out visitor. All must fail.

### 6.3 Sign-in and accounts

Kept from today: random 256-bit session token in an HttpOnly cookie (only its SHA-256 stored), server-side
logout, login rate limits, CSRF Origin check, CSP and security headers, bcrypt passwords.

Added:
- Seller sign-up with **email verification** before the store can go live.
- **Password reset** by email (single-use, 30-minute, hashed tokens) and **change password** (signs out other
  sessions).
- Staff and buyer **invites** by email link (single-use, expiring, hashed).
- Optional **two-step sign-in** (authenticator app, TOTP) for store owners and staff, with one-time recovery codes.
- Minimum password length 10; same generic error for "no such email" and "wrong password".
- Sessions are invalidated when a membership is removed or a store is suspended.
- Email sending through a transactional email provider (builder picks; key in `.env`). In local development,
  emails are printed to the terminal instead of sent.

### 6.4 Setup questions (onboarding)

A short step-by-step setup after sign-up, each step skippable and editable later in Settings:
1. Store name and web address (`/s/<name>`; checked for uniqueness, letters/numbers/hyphens only).
2. What you sell (free text, e.g. "lamps and lampshades"). Used to suggest categories and default units.
3. Look: pick a style (see 6.7), accent color, logo.
4. Connect QuickBooks (optional, can do later).
5. Import from QuickBooks or add first products.
6. Add customers (import from QuickBooks or invite by email; optionally turn on "request an account").

### 6.5 Products and units

Each product has: name, description, SKU, category, photos (up to 4), **unit kind**, **sell unit**, optional
**pack contents** (count × amount × unit, e.g. 24 × 12 fl oz), price per sell unit, "billed by actual weight"
flag, in stock / out of stock (or live stock count when QuickBooks tracks inventory), archived flag.

Unit kinds and units (fixed list in code, can grow):

| Kind | Units |
|---|---|
| Weight | oz, lb, g, kg |
| Liquid | fl oz, cup, pint, quart, gallon, mL, L |
| Paper | sheet, ream (500 sheets), roll, pack, carton |
| Length / area | inch, foot, yard, meter, sq ft, sq m |
| Single items | each, pair, set, dozen |
| Packed | case, box, bag, bottle, jar, pallet (+ pack contents) |

Shown to buyers as e.g. "$3.20 per lb", "$42.00 per case of 24 × 12 fl oz". A store's setup answer preselects
likely unit kinds; any unit stays available.

**Smart entry**: as the seller types a product name (and optionally description), the server asks Claude for a
suggestion: category (from the store's categories, or a new one), unit kind, sell unit, pack contents, emoji.
Suggestions appear as pre-filled fields the seller can change; nothing is saved until they press Save. Calls are
server-side only (key never reaches the browser), rate-limited per store, and the form works fully without it
(no key, error or timeout → plain empty fields). Product text sent to the AI is only the name/description being
entered. Cost per suggestion is to be measured during build and reported.

### 6.6 QuickBooks

Facts the design relies on (verify in sandbox during build):
- QuickBooks Online has **no unit-of-measure field** on items; units must be expressed in our app and in the
  invoice line description.
- Stock tracking (Inventory-type items, quantity on hand) exists only on **Plus and Advanced** plans (or with
  Intuit's add-on). Simple Start/Essentials have Non-inventory and Service items only.

Rules:
- **Import items**: read all active items (Inventory, Non-inventory, Service; skip Category, Group/Bundle in v1),
  paged. Show a preview list with checkboxes. Each imported product stores the QuickBooks item ID; that ID is
  **unique per store**, so re-importing updates instead of duplicating. Each import is an `ImportBatch` that can
  be undone (removes products it created that have no orders, archives those that do; reverts fields it changed).
- **Import customers** the same way, keyed by QuickBooks customer ID.
- **Import past invoices (optional, seller's choice)**: the seller can pull past invoices for imported customers
  over a date range they pick (default: last 12 months). They appear to the seller and to that buyer as
  read-only "Past orders (from QuickBooks)" with a Reorder button for lines whose items are linked to store
  products. Keyed by QuickBooks invoice ID (unique per store), so running it again never duplicates. Past
  invoices are never sent back to QuickBooks and don't count toward order numbers. Undoable like other imports.
- **Link, don't create**: a product linked to a QuickBooks item is invoiced against that item. Only products with
  no link get a new Non-inventory item, after first searching QuickBooks by name (including inactive items) to
  link instead of duplicating. Same for customers (search by name including inactive; if the name is taken by a
  vendor/employee, show a clear message asking the seller to pick or rename).
- **Unit conversion**: each linked product stores "1 [sell unit] = N [QuickBooks unit]" (default 1). The invoice
  line uses QuickBooks quantity = ordered qty × N and rate = price ÷ N (amounts reconciled to the cent so
  QuickBooks' amount check passes), with the description stating what was ordered, e.g.
  "Chicken thighs · 1 case (about 40 lb)". Weighed items carry the "billed by actual weight" note.
- **No duplicate invoices**: existing `requestid` idempotency kept; an order is claimed for syncing with an atomic
  status change so two clicks/two servers can't send it twice; `DocNumber` unique per store; database unique
  constraint on (store, QuickBooks invoice ID).
- **Token refresh** done under a per-store lock so two requests can't refresh at once and lose the rotated token.
- **Cancel an order that has an invoice**: asks for confirmation, then voids the invoice in QuickBooks (kept for
  audit, amount zeroed). Reopening creates a fresh invoice.
- Sync status with exact error and Retry stays on every order.

### 6.7 Look and personalization

- One plain base design (current Larder layout: off-white background, white cards, clear type), with **4 styles**
  that only change design tokens: *Fresh Market* (current green), *Clean* (white/charcoal), *Warm Craft*
  (cream/terracotta), *Classic* (white/navy). Plus seller's accent color, logo and an optional banner photo.
- Accent colors are checked for readable contrast; if too light/dark, the app adjusts the shade and tells the
  seller.
- Category icons: emoji chosen per category (suggested by smart entry). Products without a photo show a neat
  tile with the category emoji on a soft tint. No bundled stock art (licensing).
- Photos: JPEG/PNG/WebP only, max 8 MB, re-encoded on the server (strips hidden data, blocks disguised files),
  resized to fixed sizes and shown in fixed-ratio frames so nothing stretches or overflows. Stored on local disk
  in development, S3-compatible storage in production.
- Layout checks: automated browser test at phone (390 px) and desktop (1280 px) widths on every page fails if
  anything is wider than the screen or text overflows its box, with long product names/prices as test data.

### 6.8 Undo, redo and history

- Every change to products, categories, prices, customers and store settings is recorded in `ChangeLog`
  (who, when, before, after).
- After any change, a toast shows **Undo** (10 seconds). A **History** page lists recent changes with Undo on
  each; undoing is itself recorded, so it can be redone.
- Delete = archive. Archived products/customers can be restored from an Archived view.
- Orders: status changes reversible as today; a buyer can cancel their own order until the seller starts packing.
- Undo of a QuickBooks import works per 6.6. Undo never deletes anything in QuickBooks.

### 6.9 Ordering (buyer side)

Same as today's Larder storefront, made niche-neutral: store's look, categories, search, "Order again", cart
(product IDs and quantities only in the browser), delivery/pickup date, note, confirmation, history, reorder.
Wording comes from the store (e.g. "delivery" vs "pickup"), not hard-coded food words.

## 7. Constraints

- Next.js 15, TypeScript, Prisma; SQLite in development, Postgres in production (no SQLite-only features).
- No secrets in browser code; nothing sensitive in browser storage; `.env` and databases never committed.
- `npm audit` = 0, `tsc` clean, all tests pass, `next build` passes before each push.
- Plain language in the interface.

## 8. Build order (each phase ends tested and reviewable)

1. Multi-store foundation: data model, store isolation layer, roles, migration of demo data, cross-store tests.
2. Accounts: sign-up, email verification, reset/change password, invites, two-step sign-in.
3. Onboarding, looks, uploads, niche-neutral storefront and seller pages, units and pack contents.
4. QuickBooks: import with preview and undo, linking, conversion, duplicate protection, voiding, refresh lock.
5. Smart entry.
6. Undo/redo + history + archive.
7. Full security review, layout checks, click-through, then a local preview link for the owner.

## 9. Left to the builder

File layout, library choices (TOTP, image processing, email provider), exact copy, test structure, migration
mechanics, the exact AI model and prompt.

## 10. Owner decisions

- Q1. Import past QuickBooks invoices as history: **yes, optional** per seller (see 6.6).
- Q2. Buyer accounts: seller invites, and an optional "request an account" form on the store page that the
  seller approves (off by default, seller turns it on in Settings).
- The build may be split across several sessions; each phase in §8 is self-contained and ends tested, committed
  and pushed, with notes in HANDOFF.md so the next session can pick up.
